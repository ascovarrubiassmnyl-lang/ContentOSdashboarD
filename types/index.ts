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
  // Seguidores ganados gracias a esta pieza. `null` = la fuente no lo entrega
  // (distinto de 0, que significaría que no trajo ninguno).
  follows: number | null;
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

// ── Agente OS — arnés del agente de IA (planes/2026-08-29-agente-os-fase1-arnes.md) ──

// Clasificación de tamaño de muestra, calculada SIEMPRE en código
// (lib/agent/confidence.ts), nunca inferida por el modelo.
export type ConfidenceTier = 'insuficiente' | 'debil' | 'razonable';

// Forma estándar que devuelve toda tool de datos del agente.
export interface ToolResult<T = number> {
  value: T;
  n: number;
  period: string; // "YYYY-MM-DD/YYYY-MM-DD"
  confidence_tier: ConfidenceTier;
  source: 'zernio';
}

// Salida estructurada obligatoria del agente antes de redactar texto libre
// (Capa 2 del contrato de confianza).
export interface Insight {
  claim: string;
  metric: string;
  n: number;
  confidence_tier: ConfidenceTier;
  source: string;
}

export interface AgentThread {
  id: string;
  account_id: string;
  title?: string;
  created_at: string;
}

export interface AgentMessage {
  id: string;
  thread_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface AuditLogEntry {
  conversation_id: string;
  tool_called: string;
  params: Record<string, unknown>;
  n_returned: number | null;
  confidence_tier: ConfidenceTier | null;
  claim_final: string | null;
  created_at: string;
}

export interface SuccessDefinition {
  metric: string;
  // false = todavía no lo configuró el usuario; el agente usa el default y
  // lo declara explícitamente (ver Decisión #4 del plan de Fase 1).
  configured: boolean;
}

// ── Fase 2 — competencia, voz de marca y memoria ──────────────
// (planes/2026-08-29-agente-os-fase2-competencia-voz-calendario.md)

export interface Competitor {
  id: string;
  account_id: string;
  username: string; // sin @
  label: string;
  notes: string;
  created_at: string;
}

// Una observación puntual de un competidor. NUNCA es un dato medido: o se
// raspó de un perfil público, o lo escribió el usuario a mano. Por eso
// `method` viaja siempre con el dato y el agente no puede presentarlo como
// equivalente a las métricas propias de Zernio.
export interface CompetitorSnapshot {
  id: string;
  account_id: string;
  competitor_id: string;
  observed_at: string;
  method: 'scrape' | 'manual';
  followers: number | null;
  posts_count: number | null;
  // Medias observadas en las publicaciones públicas visibles, cuando el
  // proveedor las expone. `sample_size` es cuántas publicaciones se pudieron
  // ver — es el `n` de esta observación.
  avg_likes: number | null;
  avg_comments: number | null;
  sample_size: number;
}

// Perfil de voz DERIVADO EN CÓDIGO de las piezas con mejor rendimiento real
// (Decisión #5 del plan de Fase 2): son hechos medibles sobre el copy, no una
// descripción que el modelo se invente sobre sí mismo.
export interface VoiceProfile {
  n: number; // publicaciones analizadas
  confidence_tier: ConfidenceTier;
  based_on: string; // qué criterio seleccionó las piezas
  avg_hook_words: number | null;
  avg_caption_chars: number | null;
  hooks_with_question_pct: number | null;
  hooks_with_number_pct: number | null;
  avg_emojis_per_caption: number | null;
  dominant_formats: { media_type: MediaType; count: number }[];
  sample_hooks: string[];
}

// Una cosa estable que el usuario dijo sobre su marca. Guarda de dónde salió
// para que se pueda auditar y borrar (Decisión #6): memoria sin procedencia es
// memoria que nadie puede corregir.
export interface BrandMemoryEntry {
  id: string;
  account_id: string;
  text: string;
  source_conversation_id: string | null;
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
  workspace: {
    id: string;
    label: string;
    username: string;
    platform: 'instagram' | 'facebook';
  };
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
