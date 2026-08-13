import {
  CalendarItem,
  KpiValue,
  MediaPost,
  MetricSnapshot,
  MetricsResponse,
  Period,
  Script,
  StoryMetric,
} from '@/types';
import { Workspace, hasZernioFor, readFor } from './accounts';
import { seedIfNeeded } from './mock';

const PERIOD_DAYS: Record<Period, number> = { today: 1, '7d': 7, '30d': 30 };

function sum(rows: MetricSnapshot[], key: keyof MetricSnapshot): number {
  return rows.reduce((acc, r) => acc + (r[key] as number), 0);
}

function delta(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

// Snapshot a cero para cuentas sin datos todavía. Conserva los seguidores que
// Zernio ya reportó al conectar la cuenta, aunque no haya analytics por post.
function emptySnapshot(ws: Workspace): MetricSnapshot {
  return {
    id: 'snap_vacio',
    account_id: ws.id,
    snapshot_date: new Date().toISOString().slice(0, 10),
    followers: ws.followers ?? 0,
    followers_gained: 0,
    followers_lost: 0,
    views: 0,
    reach: 0,
    interactions: 0,
    engagement_rate: 0,
    likes: 0,
    comments: 0,
    saves: 0,
    shares: 0,
    reposts: 0,
    engaged_accounts: 0,
    link_taps: 0,
    ctr_bio: 0,
    frequency: 0,
  };
}

export async function buildMetrics(ws: Workspace, period: Period): Promise<MetricsResponse> {
  await seedIfNeeded(ws);
  const isReal = await hasZernioFor(ws);
  const snapshots = (await readFor<MetricSnapshot>(ws, 'metric_snapshots')).sort(
    (a, b) => a.snapshot_date.localeCompare(b.snapshot_date)
  );
  const posts = (await readFor<MediaPost>(ws, 'media_posts')).sort(
    (a, b) => b.published_at.localeCompare(a.published_at)
  );
  const stories = await readFor<StoryMetric>(ws, 'stories');

  const n = PERIOD_DAYS[period];
  const current = snapshots.slice(-n);
  const previous = snapshots.slice(-n * 2, -n);
  // Una cuenta recién añadida (o cuyo sync todavía no ha entrado) no tiene
  // ningún snapshot. Antes esto reventaba con `latest.followers` y devolvía
  // un 500 que dejaba las páginas cargando para siempre: ahora cae a un
  // snapshot en cero y la UI muestra su estado vacío.
  const latest = snapshots[snapshots.length - 1] ?? emptySnapshot(ws);

  const curReach = sum(current, 'reach');
  const prevReach = sum(previous, 'reach');
  const curViews = sum(current, 'views');
  const curInteractions = sum(current, 'interactions');
  const prevInteractions = sum(previous, 'interactions');
  const curER = curReach ? (curInteractions / curReach) * 100 : 0;
  const prevER = prevReach ? (prevInteractions / prevReach) * 100 : 0;
  const curTaps = sum(current, 'link_taps');
  const curEngaged = sum(current, 'engaged_accounts');

  const kpis: KpiValue[] = [
    {
      key: 'views',
      label: 'Vistas',
      value: curViews,
      delta: delta(curViews, sum(previous, 'views')),
      description: `Reproducciones últimos ${n === 1 ? 'día' : n + ' días'}`,
      format: 'int',
    },
    {
      key: 'reach',
      label: 'Alcance',
      value: curReach,
      delta: delta(curReach, prevReach),
      description: 'Cuentas alcanzadas',
      format: 'int',
    },
    {
      key: 'followers',
      label: 'Seguidores',
      value: latest.followers,
      delta: delta(
        latest.followers,
        previous.length ? previous[previous.length - 1].followers : 0
      ),
      description: 'Total actual',
      format: 'int',
    },
    {
      key: 'er',
      label: 'Interacción',
      value: curER,
      delta: delta(curER, prevER),
      description: 'Interacciones / alcance',
      format: 'percent',
    },
    {
      key: 'likes',
      label: 'Me gusta',
      value: sum(current, 'likes'),
      delta: delta(sum(current, 'likes'), sum(previous, 'likes')),
      description: 'Total del periodo',
      format: 'int',
    },
    {
      key: 'comments',
      label: 'Comentarios',
      value: sum(current, 'comments'),
      delta: delta(sum(current, 'comments'), sum(previous, 'comments')),
      description: 'Total del periodo',
      format: 'int',
    },
    {
      key: 'saves',
      label: 'Guardados',
      value: sum(current, 'saves'),
      delta: delta(sum(current, 'saves'), sum(previous, 'saves')),
      description: 'Señal de contenido útil',
      format: 'int',
    },
    {
      key: 'shares',
      label: 'Compartidos',
      value: sum(current, 'shares'),
      delta: delta(sum(current, 'shares'), sum(previous, 'shares')),
      description: 'Señal de viralidad',
      format: 'int',
    },
    {
      key: 'engaged',
      label: 'Cuentas con engagement',
      value: curEngaged,
      delta: delta(curEngaged, sum(previous, 'engaged_accounts')),
      description: 'Cuentas que interactuaron',
      format: 'int',
    },
    {
      key: 'taps',
      label: 'Taps al link',
      value: curTaps,
      delta: isReal ? null : delta(curTaps, sum(previous, 'link_taps')),
      description: isReal
        ? 'No disponible en esta fuente'
        : 'Clics al link de la bio',
      format: 'int',
    },
    {
      key: 'ctr',
      label: 'CTR bio',
      value: curReach ? (curTaps / curReach) * 100 : 0,
      delta: null,
      description: isReal ? 'No disponible en esta fuente' : 'Taps / alcance',
      format: 'percent',
    },
    {
      key: 'freq',
      label: 'Frecuencia',
      value: curReach ? curViews / curReach : 0,
      delta: delta(
        curReach ? curViews / curReach : 0,
        prevReach ? sum(previous, 'views') / prevReach : 0
      ),
      description: 'Vistas por cuenta alcanzada',
      format: 'decimal',
    },
  ];

  // Serie de seguidores — últimos 60 días para que el chart pueda filtrar
  const followersSeries = snapshots.slice(-60).map((s) => ({
    date: s.snapshot_date,
    total: s.followers,
    gained: s.followers_gained,
    lost: s.followers_lost,
    net: s.followers_gained - s.followers_lost,
  }));

  // Dona de reacciones
  const reactions = [
    { name: 'Me gusta', value: sum(current, 'likes'), color: '#7C7CF5' },
    { name: 'Comentarios', value: sum(current, 'comments'), color: '#EC5B9A' },
    { name: 'Guardados', value: sum(current, 'saves'), color: '#F59E4B' },
    { name: 'Compartidos', value: sum(current, 'shares'), color: '#3DDC97' },
    { name: 'Reposteos', value: sum(current, 'reposts'), color: '#5BC0EC' },
  ];

  // Alcance por formato
  const byFormat = new Map<string, number>();
  for (const p of posts) {
    const label =
      p.media_type === 'REEL'
        ? 'Reels'
        : p.media_type === 'CAROUSEL'
        ? 'Carruseles'
        : p.media_type === 'STORY'
        ? 'Historias'
        : 'Imágenes';
    byFormat.set(label, (byFormat.get(label) ?? 0) + p.reach);
  }
  const storyReach = stories.reduce((a, s) => a + s.views, 0);
  byFormat.set('Historias', (byFormat.get('Historias') ?? 0) + storyReach);
  const reachByFormat = [...byFormat.entries()].map(([format, reach]) => ({
    format,
    reach,
  }));

  // Top publicaciones por interacción
  const topPosts = [...posts]
    .sort(
      (a, b) =>
        b.likes + b.comments + b.saves + b.shares -
        (a.likes + a.comments + a.saves + a.shares)
    )
    .slice(0, 5);

  // Reels: todos los que son REEL (con o sin watch time)
  const reels = posts.filter((p) => p.media_type === 'REEL');
  // Curva por tramo: solo disponible si las piezas traen retention_curve
  // (el demo la trae; Zernio no la entrega — en ese caso los tramos van vacíos).
  const reelsWithCurve = reels.filter((p) => p.retention_curve);
  const buckets = ['0-3s', '3-8s', '8-15s', '15-30s', '30s+'];
  const retentionBuckets = buckets.map((bucket) => ({
    bucket,
    pct:
      reelsWithCurve.length === 0
        ? 0
        : Math.round(
            reelsWithCurve.reduce((a, r) => a + (r.retention_curve?.[bucket] ?? 0), 0) /
              reelsWithCurve.length
          ),
  }));

  const reelsWithWatch = reels.filter((r) => (r.avg_watch_time_seconds ?? 0) > 0);
  const avgWatchTime =
    reelsWithWatch.length === 0
      ? 0
      : reelsWithWatch.reduce((a, r) => a + (r.avg_watch_time_seconds ?? 0), 0) /
        reelsWithWatch.length;

  // Distribución REAL de reels por tiempo de visualización — fallback
  // cuando la fuente no entrega curva de retención por tramo.
  const watchBuckets: { bucket: string; min: number; max: number }[] = [
    { bucket: '< 5s', min: 0, max: 5 },
    { bucket: '5-10s', min: 5, max: 10 },
    { bucket: '10-15s', min: 10, max: 15 },
    { bucket: '15s+', min: 15, max: Infinity },
  ];
  const watchDistribution = watchBuckets.map(({ bucket, min, max }) => ({
    bucket,
    count: reelsWithWatch.filter((r) => {
      const w = r.avg_watch_time_seconds ?? 0;
      return w >= min && w < max;
    }).length,
  }));

  const reelRetention = [...reels]
    .sort((a, b) => (b.avg_watch_time_seconds ?? 0) - (a.avg_watch_time_seconds ?? 0))
    .slice(0, 6);

  // Funnel ruta a la acción
  const funnel = [
    { stage: 'Alcance', value: curReach },
    { stage: 'Cuentas con engagement', value: curEngaged },
    { stage: 'Interacciones', value: curInteractions },
    { stage: 'Taps al link', value: curTaps },
  ];

  // Heatmap horarios — derivado de forma estable a partir de los posts
  const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const heat = dayNames.map((day) => ({ day, am: 0, pm: 0 }));
  for (const p of posts) {
    const d = new Date(p.published_at);
    const idx = (d.getDay() + 6) % 7; // lunes = 0
    const engagement = p.likes + p.comments + p.saves + p.shares;
    if (d.getHours() < 12) heat[idx].am += engagement;
    else heat[idx].pm += engagement;
  }

  return {
    period,
    kpis,
    followersSeries,
    reactions,
    engagementRate: +curER.toFixed(2),
    reachByFormat,
    topPosts,
    retentionBuckets,
    watchDistribution,
    avgWatchTime: +avgWatchTime.toFixed(1),
    reelRetention,
    stories,
    funnel,
    heatmap: heat,
    recentPosts: posts.slice(0, 8),
    operation: await buildOperation(ws),
  };
}

// Estado real del pipeline de la cuenta. Antes eran cinco números fijos
// heredados de la demo, así que una cuenta vacía presumía de "3 piezas listas".
async function buildOperation(ws: Workspace): Promise<MetricsResponse['operation']> {
  const pieces = await readFor<CalendarItem>(ws, 'calendar_items');
  const scripts = await readFor<Script>(ws, 'scripts');
  const scored = scripts.filter((s) => typeof s.score === 'number' && s.score > 0);
  return {
    active: pieces.filter((p) => p.status !== 'publicado').length,
    ready: pieces.filter((p) => p.status === 'listo').length,
    avgScore: scored.length
      ? Math.round(scored.reduce((a, s) => a + s.score, 0) / scored.length)
      : 0,
    blocked: scored.filter((s) => s.score < 60).length,
    publishable: scripts.filter((s) => s.status === 'aprobado').length,
  };
}
