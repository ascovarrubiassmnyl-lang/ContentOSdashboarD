-- CONTENT OS · Esquema de producción (Supabase / PostgreSQL)
-- Ejecutar en el SQL Editor de Supabase al pasar de modo demo a producción.

create extension if not exists pgcrypto;

-- Cuenta conectada de Instagram
create table if not exists ig_accounts (
  id uuid primary key default gen_random_uuid(),
  ig_user_id text unique not null,
  username text not null,
  account_type text not null default 'MEDIA_CREATOR',
  access_token_encrypted text,          -- ¡NUNCA en texto plano!
  token_expires_at timestamptz,
  last_sync_at timestamptz,
  created_at timestamptz default now()
);

-- Snapshot diario de métricas de cuenta (histórico)
create table if not exists metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references ig_accounts(id) on delete cascade,
  snapshot_date date not null,
  followers int default 0,
  followers_gained int default 0,
  followers_lost int default 0,
  views int default 0,
  reach int default 0,
  interactions int default 0,
  engagement_rate numeric default 0,
  likes int default 0,
  comments int default 0,
  saves int default 0,
  shares int default 0,
  reposts int default 0,
  engaged_accounts int default 0,
  link_taps int default 0,
  ctr_bio numeric default 0,
  frequency numeric default 0,
  unique(account_id, snapshot_date)
);

-- Posts / media sincronizados
create table if not exists media_posts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references ig_accounts(id) on delete cascade,
  ig_media_id text unique not null,
  media_type text not null,
  caption text,
  hook text,
  thumbnail_url text,
  permalink text,
  published_at timestamptz,
  likes int default 0,
  comments int default 0,
  saves int default 0,
  shares int default 0,
  views int default 0,
  reach int default 0,
  avg_watch_time_seconds numeric,
  retention_curve jsonb
);

-- Banco de fuentes (materia prima)
create table if not exists sources (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references ig_accounts(id) on delete cascade,
  type text not null check (type in ('transcripcion','dm','llamada','comentario','objecion')),
  title text not null,
  content text not null,
  file_url text,
  tags text[] default '{}',
  created_at timestamptz default now()
);

-- Guiones generados por IA
create table if not exists scripts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references ig_accounts(id) on delete cascade,
  title text not null,
  hook text not null,
  body text not null,
  cta text not null,
  format text not null check (format in ('reel','carrusel','historia')),
  source_ids uuid[] default '{}',
  metrics_context jsonb,
  justification text,
  status text not null default 'borrador' check (status in ('borrador','aprobado','publicado')),
  score int default 0 check (score between 0 and 100),
  created_at timestamptz default now()
);

-- Calendario editorial
create table if not exists calendar_items (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references ig_accounts(id) on delete cascade,
  script_id uuid references scripts(id) on delete set null,
  title text not null,
  format text not null check (format in ('reel','carrusel','historia','ad')),
  scheduled_at timestamptz not null,
  status text not null default 'idea' check (status in ('idea','en_produccion','listo','publicado')),
  notes text default ''
);

-- Reportes generados
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references ig_accounts(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  summary_md text not null,
  data jsonb,
  created_at timestamptz default now()
);

-- ── RLS: activado en TODAS las tablas, un solo usuario autorizado ──
alter table ig_accounts enable row level security;
alter table metric_snapshots enable row level security;
alter table media_posts enable row level security;
alter table sources enable row level security;
alter table scripts enable row level security;
alter table calendar_items enable row level security;
alter table reports enable row level security;

-- Política: solo el usuario autenticado (allowlist se maneja en Auth)
do $$
declare t text;
begin
  foreach t in array array['ig_accounts','metric_snapshots','media_posts','sources','scripts','calendar_items','reports']
  loop
    execute format(
      'create policy "owner_all_%s" on %I for all to authenticated using (true) with check (true)',
      t, t
    );
  end loop;
end $$;
