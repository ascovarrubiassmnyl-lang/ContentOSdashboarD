// ── Tipos del dominio — espejo del esquema de Supabase ──────

export type Period = 'today' | '7d' | '30d';

export interface IgAccount {
  id: string;
  ig_user_id: string;
  username: string;
  account_type: 'MEDIA_CREATOR' | 'BUSINESS';
  token_expires_at: string;
  last_sync_at: string;
  connected: boolean;
}

export interface MetricSnapshot {
  id: string;
  account_id: string;
  snapshot_date: string; // YYYY-MM-DD
  followers: number;
  followers_gained: number;
  followers_lost: number;
  views: number;
  reach: number;
  interactions: number;
  engagement_rate: number;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  reposts: number;
  engaged_accounts: number;
  link_taps: number;
  ctr_bio: number;
  frequency: number;
}

export type MediaType = 'REEL' | 'CAROUSEL' | 'STORY' | 'IMAGE';

export interface MediaPost {
  id: string;
  account_id: string;
  ig_media_id: string;
  media_type: MediaType;
  caption: string;
  hook: string;
  thumbnail_url: string | null;
  permalink: string;
  published_at: string;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  views: number;
  reach: number;
  avg_watch_time_seconds: number | null;
  retention_curve: Record<string, number> | null;
}

export interface StoryMetric {
  id: string;
  title: string;
  views: number;
  exits: number;
  replies: number;
  completion_rate: number;
  published_at: string;
}

export type SourceType =
  | 'transcripcion'
  | 'dm'
  | 'llamada'
  | 'comentario'
  | 'objecion'
  | 'documento';

export interface Source {
  id: string;
  account_id: string;
  type: SourceType;
  title: string;
  content: string;
  file_url: string | null;
  file_name?: string | null;
  file_mime?: string | null;
  file_size?: number | null;
  extract_note?: string | null; // aviso si la extracción fue parcial
  tags: string[];
  created_at: string;
}

export type ScriptFormat = 'reel' | 'carrusel' | 'historia';
export type ScriptStatus = 'borrador' | 'aprobado' | 'publicado';

export interface Script {
  id: string;
  account_id: string;
  title: string;
  hook: string;
  body: string;
  cta: string;
  format: ScriptFormat;
  source_ids: string[];
  metrics_context: Record<string, unknown> | null;
  justification: string;
  status: ScriptStatus;
  score: number;
  created_at: string;
}

export type CalendarFormat = 'reel' | 'carrusel' | 'historia' | 'ad';
export type CalendarStatus = 'idea' | 'en_produccion' | 'listo' | 'publicado';
export type FunnelLevel = 'tofu' | 'mofu' | 'bofu';

export interface CalendarItem {
  id: string;
  account_id: string;
  script_id: string | null;
  title: string;
  format: CalendarFormat;
  nivel?: FunnelLevel | null; // etapa del funnel — colorea la pieza en el calendario
  scheduled_at: string;
  status: CalendarStatus;
  notes: string;
}

export interface Report {
  id: string;
  account_id: string;
  period_start: string;
  period_end: string;
  summary_md: string;
  data: Record<string, unknown>;
  created_at: string;
}

// Banco de ideas — ideas de video por etapa del funnel
export type IdeaStatus = 'pendiente' | 'completada';

export interface Idea {
  id: string;
  account_id: string;
  level: FunnelLevel; // tofu / mofu / bofu
  text: string;
  status: IdeaStatus;
  created_at: string;
}

// Respuesta de /api/connection — describe la CUENTA ACTIVA, no una fija.
export interface ConnectionResponse {
  account: IgAccount | null;
  workspace: { id: string; label: string; username: string };
  source: 'zernio' | 'demo';
  demoMode: boolean;
  realConnected: boolean;
  hasData: boolean;
  syncError: string | null;
}

// ── Payloads agregados que sirven las API routes ────────────

export interface KpiValue {
  key: string;
  label: string;
  value: number;
  delta: number | null; // % vs periodo anterior; null si no aplica
  description: string;
  format: 'int' | 'percent' | 'decimal';
}

export interface MetricsResponse {
  period: Period;
  kpis: KpiValue[];
  followersSeries: {
    date: string;
    total: number;
    gained: number;
    lost: number;
    net: number;
  }[];
  reactions: { name: string; value: number; color: string }[];
  engagementRate: number;
  reachByFormat: { format: string; reach: number }[];
  topPosts: MediaPost[];
  retentionBuckets: { bucket: string; pct: number }[];
  // Distribución de reels por tiempo de visualización (fallback real
  // cuando la fuente no entrega curva de retención por tramo)
  watchDistribution: { bucket: string; count: number }[];
  avgWatchTime: number;
  reelRetention: MediaPost[];
  stories: StoryMetric[];
  funnel: { stage: string; value: number }[];
  heatmap: { day: string; am: number; pm: number }[];
  recentPosts: MediaPost[];
  operation: {
    active: number;
    ready: number;
    avgScore: number;
    blocked: number;
    publishable: number;
  };
}
