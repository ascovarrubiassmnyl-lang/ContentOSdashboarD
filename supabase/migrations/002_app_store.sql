-- CONTENT OS · Migración de producción (la que usa la app)
-- Ejecutar en el SQL Editor de Supabase ANTES del primer deploy.
--
-- La app guarda cada colección como un documento jsonb en `app_store`
-- (mismo modelo que el almacén local de archivos JSON — swap directo).
-- El esquema relacional de 001_schema.sql queda como referencia para una
-- futura normalización; NO es necesario para operar.

-- ── Almacén de datos ─────────────────────────────────────────
create table if not exists app_store (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- RLS activo SIN políticas para anon/authenticated:
-- solo el service role (las API routes del servidor) puede leer/escribir.
alter table app_store enable row level security;

-- ── Storage para archivos del Banco de fuentes ───────────────
-- Bucket privado "uploads" (el servidor firma los accesos).
insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', false)
on conflict (id) do nothing;

-- ── Recordatorios de configuración (manual, en el dashboard) ─
-- 1. Authentication → Providers → Email: activar (magic link / OTP).
-- 2. Authentication → URL Configuration → Site URL: la URL de producción
--    (y añadir http://localhost:3333 a Redirect URLs para pruebas).
-- 3. Settings → API: copiar URL + anon key + service_role key al .env.
