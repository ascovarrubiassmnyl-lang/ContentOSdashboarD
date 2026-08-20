// Generador de datos demo con la estructura EXACTA que devuelve la
// Instagram Graph API (nombres de métricas v21+: views en lugar de
// impressions). Determinista (PRNG con semilla) para que la demo sea
// estable entre recargas.
import {
  IgAccount,
  MediaPost,
  MetricSnapshot,
  StoryMetric,
} from '@/types';
import {
  Workspace,
  hasZernioFor,
  readSingletonFor,
  writeFor,
  writeSingletonFor,
} from './accounts';

const DAYS = 90;

// PRNG mulberry32 — determinista
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HOOKS = [
  'Nadie te dice esto antes de empezar a crear contenido',
  'El error que me costó 10K seguidores',
  '3 señales de que tu contenido está muriendo',
  'Cómo pasé de 200 a 2.000 vistas sin pagar ads',
  'Esto es lo que Instagram premia en 2026',
  'Deja de publicar así (te está matando el alcance)',
  'La fórmula del hook que retiene al 70%',
  'Por qué tus reels mueren a los 3 segundos',
  'Lo que aprendí publicando 30 días seguidos',
  'El formato que triplicó mis guardados',
  'Tu bio está espantando seguidores — arréglala así',
  'Cómo leer tus métricas en 5 minutos',
  'Estás usando mal los carruseles',
  'El horario en que tu audiencia SÍ está despierta',
  'Responde esto antes de grabar tu próximo reel',
  'La razón real por la que no creces',
  'Guiones con IA: lo que nadie te muestra',
  'Así se ve un CTA que sí convierte',
  'Historias que la gente ve completas: el patrón',
  'Mi peor reel me enseñó más que el mejor',
  'Copiar a los grandes te está hundiendo',
  'La métrica que deberías mirar primero',
  'Cómo salir del valle de las 200 vistas',
  'Publica menos, crece más: el experimento',
];

const CAPTIONS = [
  'Guarda este post para tu próxima sesión de creación 🎯',
  'Si esto te sirvió, compártelo con otro creador 🔄',
  'Comenta "GUION" y te mando la plantilla 📩',
  'Sígueme para más análisis de contenido real 📊',
  'Lo probé durante 30 días — estos son los datos 📈',
];

export async function seedIfNeeded(ws: Workspace): Promise<void> {
  // Con Zernio configurado los datos reales llegan por sync — JAMÁS sembrar
  // datos demo en ese caso (contaminaría producción con posts falsos).
  if (await hasZernioFor(ws)) return;
  const existing = await readSingletonFor<IgAccount>(ws, 'account');
  if (existing) return;

  const accountId = ws.id;
  const rand = mulberry32(861386);
  const today = new Date();

  // ── Cuenta ────────────────────────────────────────────────
  const account: IgAccount = {
    id: accountId,
    ig_user_id: '17841400000086',
    username: 'scav_86',
    account_type: 'MEDIA_CREATOR',
    token_expires_at: new Date(Date.now() + 52 * 86400_000).toISOString(),
    last_sync_at: new Date(Date.now() - 16 * 60_000).toISOString(),
    connected: true,
  };
  await writeSingletonFor(ws, 'account', account);

  // ── Snapshots diarios (90 días, tendencia creciente) ─────
  let followers = 8_420;
  const snapshots: MetricSnapshot[] = [];
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const date = d.toISOString().slice(0, 10);

    const momentum = 1 + (DAYS - i) / DAYS; // acelera hacia el presente
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    const dayFactor = isWeekend ? 0.75 : 1;

    const gained = Math.round((14 + rand() * 40) * momentum * dayFactor);
    const lost = Math.round(4 + rand() * 14);
    followers += gained - lost;

    const reach = Math.round((2_600 + rand() * 3_800) * momentum * dayFactor);
    const views = Math.round(reach * (1.35 + rand() * 0.5));
    const likes = Math.round(reach * (0.055 + rand() * 0.03));
    const comments = Math.round(reach * (0.006 + rand() * 0.005));
    const saves = Math.round(reach * (0.014 + rand() * 0.012));
    const shares = Math.round(reach * (0.009 + rand() * 0.008));
    const reposts = Math.round(shares * 0.18);
    const interactions = likes + comments + saves + shares;
    const engaged = Math.round(reach * (0.09 + rand() * 0.04));
    const linkTaps = Math.round(reach * (0.004 + rand() * 0.004));

    snapshots.push({
      id: `snap_${date}`,
      account_id: accountId,
      snapshot_date: date,
      followers,
      followers_gained: gained,
      followers_lost: lost,
      views,
      reach,
      interactions,
      engagement_rate: +((interactions / reach) * 100).toFixed(2),
      likes,
      comments,
      saves,
      shares,
      reposts,
      engaged_accounts: engaged,
      link_taps: linkTaps,
      ctr_bio: +((linkTaps / reach) * 100).toFixed(2),
      frequency: +(views / reach).toFixed(2),
    });
  }
  await writeFor(ws, 'metric_snapshots', snapshots);

  // ── Posts (24 piezas, mezcla de formatos) ────────────────
  const posts: MediaPost[] = [];
  for (let i = 0; i < 24; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - Math.round(i * 3.5 + rand() * 2));
    const typeRoll = rand();
    const media_type = typeRoll < 0.55 ? 'REEL' : typeRoll < 0.85 ? 'CAROUSEL' : 'IMAGE';
    const viral = rand() > 0.8 ? 2.6 + rand() * 2 : 1;
    const reach = Math.round((1_800 + rand() * 5_200) * viral);
    const views = media_type === 'REEL' ? Math.round(reach * (1.4 + rand() * 0.9)) : reach;
    const likes = Math.round(reach * (0.05 + rand() * 0.05));
    const comments = Math.round(reach * (0.004 + rand() * 0.008));
    const saves = Math.round(reach * (0.012 + rand() * 0.02));
    const shares = Math.round(reach * (0.008 + rand() * 0.014));

    const isReel = media_type === 'REEL';
    const r3 = 100;
    const r8 = Math.round(72 + rand() * 20);
    const r15 = Math.round(r8 * (0.55 + rand() * 0.25));
    const r30 = Math.round(r15 * (0.5 + rand() * 0.3));
    const r30plus = Math.round(r30 * (0.4 + rand() * 0.3));

    posts.push({
      id: `post_${i}`,
      account_id: accountId,
      ig_media_id: `1784140000${1000 + i}`,
      media_type,
      caption: CAPTIONS[i % CAPTIONS.length],
      hook: HOOKS[i % HOOKS.length],
      thumbnail_url: null,
      permalink: `https://www.instagram.com/p/DEMO${i}/`,
      published_at: d.toISOString(),
      likes,
      comments,
      saves,
      shares,
      views,
      reach,
      follows: Math.round(reach * (0.001 + rand() * 0.004)),
      avg_watch_time_seconds: isReel ? +(4.5 + rand() * 11).toFixed(1) : null,
      retention_curve: isReel
        ? { '0-3s': r3, '3-8s': r8, '8-15s': r15, '15-30s': r30, '30s+': r30plus }
        : null,
    });
  }
  await writeFor(ws, 'media_posts', posts);

  // ── Historias activas ────────────────────────────────────
  const stories: StoryMetric[] = [
    'Detrás de cámaras del reel de hoy',
    'Encuesta: ¿qué contenido quieres ver?',
    'Resultado del experimento de 30 días',
    'Respondiendo DMs en vivo',
  ].map((title, i) => {
    const views = Math.round(900 + rand() * 1_400);
    const exits = Math.round(views * (0.08 + rand() * 0.12));
    return {
      id: `story_${i}`,
      title,
      views,
      exits,
      replies: Math.round(views * (0.01 + rand() * 0.02)),
      completion_rate: +((1 - exits / views) * 100).toFixed(1),
      published_at: new Date(Date.now() - (i + 1) * 3 * 3600_000).toISOString(),
    };
  });
  await writeFor(ws, 'stories', stories);


  // Colecciones vacías que se llenan con el uso
  await writeFor(ws, 'scripts', []);
  await writeFor(ws, 'calendar_items', [
    {
      id: 'cal_1',
      account_id: accountId,
      script_id: null,
      title: 'Reel — la métrica que miras mal',
      format: 'reel',
      scheduled_at: new Date(Date.now() + 2 * 86400_000).toISOString(),
      status: 'en_produccion',
      notes: 'Usar datos del último reporte',
    },
    {
      id: 'cal_2',
      account_id: accountId,
      script_id: null,
      title: 'Carrusel — checklist de hooks',
      format: 'carrusel',
      scheduled_at: new Date(Date.now() + 4 * 86400_000).toISOString(),
      status: 'idea',
      notes: '',
    },
  ]);
  await writeFor(ws, 'reports', []);
}

export async function touchSync(ws: Workspace): Promise<void> {
  const account = await readSingletonFor<IgAccount>(ws, 'account');
  if (account) {
    account.last_sync_at = new Date().toISOString();
    await writeSingletonFor(ws, 'account', account);
  }
}
