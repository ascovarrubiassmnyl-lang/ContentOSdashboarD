// Tools del agente — contrato explícito (CONTENTOS_AGENTE_ARNES.md §6).
// Cada tool que devuelve una cifra de rendimiento devuelve también `n` y
// `confidence_tier` calculados aquí, en código — el modelo los consulta,
// nunca los inventa ni los recalcula (ver descripciones de schema abajo).

import { z } from 'zod';
import { ConfidenceTier, MediaPost, MetricSnapshot, ToolResult } from '@/types';
import { Workspace, readFor } from '../accounts';
import { ToolSchema } from '../openrouter';
import { confidenceTier } from './confidence';
import { getSuccessDefinition, SUCCESS_METRICS, SuccessMetric } from './success-definition';
import { latestSnapshotByCompetitor, listCompetitors } from '../competitors/store';
import { getVoiceProfile } from './voice-profile';
import { activeVideoProvider, VideoObservation } from '../videos';
import { addBrandMemory, listBrandMemory } from './brand-memory';
import {
  listCalendar,
  moveCalendarItem,
  saveScriptDraft,
  scheduleCalendarItem,
} from './write-tools';
import { getContentStrategy, weeklyTotal } from './content-strategy';
import { getPlaybooks } from './calendar-playbooks';
import { draftCalendarPlan, getCalendarCoverage, MAX_PLAN_ITEMS } from './calendar-plan';

function inRange(date: string, start: string, end: string) {
  return date >= start && date <= end;
}

function sumSnapshots(rows: MetricSnapshot[], key: keyof MetricSnapshot) {
  return rows.reduce((a, r) => a + (r[key] as number), 0);
}

export interface MetricSegment {
  media_type?: MediaPost['media_type'];
  min_avg_watch_time_seconds?: number;
  max_avg_watch_time_seconds?: number;
}

function matchesSegment(post: MediaPost, segment?: MetricSegment): boolean {
  if (!segment) return true;
  if (segment.media_type && post.media_type !== segment.media_type) return false;
  if (
    segment.min_avg_watch_time_seconds !== undefined &&
    (post.avg_watch_time_seconds ?? -Infinity) < segment.min_avg_watch_time_seconds
  )
    return false;
  if (
    segment.max_avg_watch_time_seconds !== undefined &&
    (post.avg_watch_time_seconds ?? Infinity) > segment.max_avg_watch_time_seconds
  )
    return false;
  return true;
}

// ── get_metrics ──────────────────────────────────────────────
export async function getMetrics(
  ws: Workspace,
  args: { metric: SuccessMetric; range: { start: string; end: string }; segment?: MetricSegment }
): Promise<ToolResult<number>> {
  const { metric, range, segment } = args;
  const snapshots = (await readFor<MetricSnapshot>(ws, 'metric_snapshots')).filter((s) =>
    inRange(s.snapshot_date, range.start, range.end)
  );
  const value =
    metric === 'followers_net'
      ? sumSnapshots(snapshots, 'followers_gained') - sumSnapshots(snapshots, 'followers_lost')
      : sumSnapshots(snapshots, metric as keyof MetricSnapshot);

  // El `n` es cuántas publicaciones respaldan esta cifra — no cuántos días
  // de snapshot hay. Si viene `segment`, se cuentan solo las que cumplen la
  // condición (ej. reels con avg_watch_time_seconds bajo un umbral): así el
  // confidence_tier refleja el tamaño real del segmento, no el de la cuenta.
  const posts = (await readFor<MediaPost>(ws, 'media_posts')).filter(
    (p) => inRange(p.published_at.slice(0, 10), range.start, range.end) && matchesSegment(p, segment)
  );
  const n = posts.length;

  return {
    value,
    n,
    period: `${range.start}/${range.end}`,
    confidence_tier: confidenceTier(n),
    source: 'zernio',
  };
}

// ── get_post_breakdown ───────────────────────────────────────
export type PostSortBy = 'interactions' | 'saves' | 'reach' | 'views';

function postScore(p: MediaPost, sortBy: PostSortBy): number {
  if (sortBy === 'interactions') return p.likes + p.comments + p.saves + p.shares;
  if (sortBy === 'saves') return p.saves;
  if (sortBy === 'reach') return p.reach;
  return p.views;
}

// Proyección compacta: el MediaPost completo trae `retention_curve` (un array
// por publicación) y campos que no aportan al análisis. Mandarlos enteros
// infla el contexto y el coste por turno sin mejorar la respuesta.
interface PostSummary {
  id: string;
  published_at: string;
  media_type: MediaPost['media_type'];
  hook: string | null;
  reach: number;
  views: number;
  saves: number;
  shares: number;
  likes: number;
  comments: number;
  avg_watch_time_seconds: number | null;
}

const DEFAULT_BREAKDOWN_LIMIT = 10;

export async function getPostBreakdown(
  ws: Workspace,
  args: {
    range: { start: string; end: string };
    sort_by: PostSortBy;
    segment?: MetricSegment;
    limit?: number;
  }
): Promise<{
  posts: PostSummary[];
  n: number;
  returned: number;
  period: string;
  source: 'zernio';
}> {
  const { range, sort_by, segment, limit } = args;
  const matching = (await readFor<MediaPost>(ws, 'media_posts'))
    .filter(
      (p) => inRange(p.published_at.slice(0, 10), range.start, range.end) && matchesSegment(p, segment)
    )
    .sort((a, b) => postScore(b, sort_by) - postScore(a, sort_by));

  const posts = matching.slice(0, limit ?? DEFAULT_BREAKDOWN_LIMIT).map((p) => ({
    id: p.id,
    published_at: p.published_at,
    media_type: p.media_type,
    hook: p.hook ?? null,
    reach: p.reach,
    views: p.views,
    saves: p.saves,
    shares: p.shares,
    likes: p.likes,
    comments: p.comments,
    avg_watch_time_seconds: p.avg_watch_time_seconds ?? null,
  }));

  // `n` es el total que cumple el filtro (base del confidence_tier);
  // `returned` es cuántos se devuelven aquí. No son lo mismo y el modelo no
  // debe confundirlos.
  return {
    posts,
    n: matching.length,
    returned: posts.length,
    period: `${range.start}/${range.end}`,
    source: 'zernio',
  };
}

// ── get_success_definition ───────────────────────────────────
export async function getSuccessDefinitionTool(ws: Workspace) {
  return getSuccessDefinition(ws);
}

// ── get_format_performance ───────────────────────────────────
// El `n` y el `confidence_tier` se calculan POR FORMATO, no una vez para todo.
// Un formato con 2 piezas y otro con 40 no admiten la misma clase de
// afirmación, y un tier global lo taparía: es exactamente el error que la
// Capa 1 existe para impedir.
export async function getFormatPerformance(
  ws: Workspace,
  args: { range: { start: string; end: string }; metric?: PostSortBy }
): Promise<{
  by_format: {
    media_type: MediaPost['media_type'];
    n: number;
    confidence_tier: ReturnType<typeof confidenceTier>;
    total: number;
    average: number;
  }[];
  metric: PostSortBy;
  period: string;
  source: 'zernio';
}> {
  const metric = args.metric ?? 'interactions';
  const posts = (await readFor<MediaPost>(ws, 'media_posts')).filter((p) =>
    inRange(p.published_at.slice(0, 10), args.range.start, args.range.end)
  );

  const groups = new Map<MediaPost['media_type'], MediaPost[]>();
  for (const p of posts) {
    const list = groups.get(p.media_type) ?? [];
    list.push(p);
    groups.set(p.media_type, list);
  }

  const by_format = [...groups.entries()]
    .map(([media_type, list]) => {
      const total = list.reduce((a, p) => a + postScore(p, metric), 0);
      return {
        media_type,
        n: list.length,
        confidence_tier: confidenceTier(list.length),
        total,
        average: Math.round(total / list.length),
      };
    })
    .sort((a, b) => b.average - a.average);

  return {
    by_format,
    metric,
    period: `${args.range.start}/${args.range.end}`,
    source: 'zernio',
  };
}

// ── get_competitor_signal ────────────────────────────────────
// Lee SOLO del almacén local (Decisión #1): nunca sale a la red dentro del
// turno. Y marca todo como estimado en código — el modelo no decide si esa
// etiqueta aparece.
export async function getCompetitorSignal(
  ws: Workspace,
  args: { username?: string }
): Promise<{
  reliability: 'estimado';
  caveat: string;
  competitors: {
    username: string;
    label: string;
    observed_at: string | null;
    method: 'scrape' | 'manual' | null;
    stale_days: number | null;
    followers: number | null;
    avg_likes: number | null;
    avg_comments: number | null;
    sample_size: number | null;
  }[];
}> {
  const wanted = args.username?.trim().replace(/^@/, '').toLowerCase();
  const all = await listCompetitors(ws);
  const competitors = wanted ? all.filter((c) => c.username === wanted) : all;
  const latest = await latestSnapshotByCompetitor(ws);

  return {
    reliability: 'estimado',
    caveat:
      'Datos observados desde fuera (perfil público o registro manual), NO medidos como los propios. Preséntalos siempre como estimación parcial y nunca los compares como si tuvieran la misma fiabilidad que las métricas de esta cuenta.',
    competitors: competitors.map((c) => {
      const snap = latest.get(c.id);
      const staleDays = snap
        ? Math.floor((Date.now() - new Date(snap.observed_at).getTime()) / 86400_000)
        : null;
      return {
        username: c.username,
        label: c.label,
        observed_at: snap?.observed_at ?? null,
        method: snap?.method ?? null,
        // Cuántos días tiene la observación: una foto de hace 3 semanas no
        // sirve para afirmar nada sobre "ahora", y el modelo tiene que poder
        // verlo en vez de asumir que está fresca.
        stale_days: staleDays,
        followers: snap?.followers ?? null,
        avg_likes: snap?.avg_likes ?? null,
        avg_comments: snap?.avg_comments ?? null,
        sample_size: snap?.sample_size ?? null,
      };
    }),
  };
}

// ── analyze_video_url ────────────────────────────────────────
// La ÚNICA tool que sale a la red dentro del turno, y solo porque el usuario
// acaba de pegar un link y espera que se lea ahora. Todo lo demás lee del
// almacén local.
//
// Devuelve `n: 1` e `insuficiente` siempre, en código: un video ajeno visto
// desde fuera no es evidencia de nada. Se ven los likes públicos; no se ve el
// alcance, ni los guardados, ni si llevaba pauta.
export async function analyzeVideoUrl(
  ws: Workspace,
  args: { url: string }
): Promise<{
  video: VideoObservation;
  n: 1;
  confidence_tier: ConfidenceTier;
  reliability: 'estimado';
  caveat: string;
  source: string;
}> {
  const provider = activeVideoProvider();
  const video = await provider.fetchVideo(args.url);
  return {
    video,
    n: 1,
    confidence_tier: 'insuficiente',
    reliability: 'estimado',
    caveat:
      'Una sola pieza ajena observada desde fuera. Los likes y comentarios son públicos; el alcance, los guardados y si llevaba pauta NO se ven. Puedes describirla, resumir su estructura y compararla con la voz de esta cuenta, pero no puedes afirmar que funcionó ni recomendar copiarla por sus números.',
    source: `${provider.name}:${video.url}`,
  };
}

// ── get_content_strategy ─────────────────────────────────────
// Lo DECLARADO por el usuario. Devuelve `kind: 'declarado'` y jamás un
// confidence_tier: no es una medición, es una intención. El prompt prohíbe
// usarla como respaldo de una afirmación de rendimiento (Decisión #1, Fase 4).
export async function getContentStrategyTool(ws: Workspace) {
  const strategy = await getContentStrategy(ws);
  return {
    kind: 'declarado' as const,
    caveat:
      'Esto es lo que el usuario DECLARÓ que quiere hacer, no evidencia de que funcione. Nunca lo cites como respaldo de una afirmación de rendimiento: para eso están get_metrics y get_format_performance.',
    strategy,
    weekly_total: weeklyTotal(strategy),
  };
}

// ── Schema (formato OpenAI, tool-calling) ────────────────────
export const AGENT_TOOLS: ToolSchema[] = [
  {
    type: 'function',
    function: {
      name: 'get_metrics',
      description:
        'Devuelve el valor agregado de una métrica de cuenta en un rango de fechas, junto con el tamaño de muestra (n) y su clasificación de confianza (confidence_tier), ambos calculados en código. NUNCA inventes ni recalcules confidence_tier o n por tu cuenta: úsalos tal cual los devuelve esta tool. Si pasas `segment`, el n corresponde solo a las publicaciones que cumplen ese segmento (ej. solo reels), no al total de la cuenta.',
      parameters: {
        type: 'object',
        properties: {
          metric: { type: 'string', enum: [...SUCCESS_METRICS] },
          range: {
            type: 'object',
            properties: {
              start: { type: 'string', description: 'YYYY-MM-DD' },
              end: { type: 'string', description: 'YYYY-MM-DD' },
            },
            required: ['start', 'end'],
          },
          segment: {
            type: 'object',
            description: 'Opcional. Filtra las publicaciones que respaldan el n.',
            properties: {
              media_type: { type: 'string', enum: ['REEL', 'CAROUSEL', 'STORY', 'IMAGE'] },
              min_avg_watch_time_seconds: { type: 'number' },
              max_avg_watch_time_seconds: { type: 'number' },
            },
          },
        },
        required: ['metric', 'range'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_post_breakdown',
      description:
        'Devuelve las publicaciones de un rango de fechas ordenadas por el criterio pedido. `n` es el TOTAL que cumple el filtro (es la base del confidence_tier); `returned` es cuántas te devuelve esta llamada (por defecto las 10 mejores) — no los confundas al citar tamaños de muestra. Úsala para justificar rankings de "mejor contenido" o análisis de copy/formato: nunca afirmes cuál fue el mejor post sin haber llamado a esta tool primero.',
      parameters: {
        type: 'object',
        properties: {
          range: {
            type: 'object',
            properties: {
              start: { type: 'string', description: 'YYYY-MM-DD' },
              end: { type: 'string', description: 'YYYY-MM-DD' },
            },
            required: ['start', 'end'],
          },
          sort_by: { type: 'string', enum: ['interactions', 'saves', 'reach', 'views'] },
          segment: {
            type: 'object',
            properties: {
              media_type: { type: 'string', enum: ['REEL', 'CAROUSEL', 'STORY', 'IMAGE'] },
              min_avg_watch_time_seconds: { type: 'number' },
              max_avg_watch_time_seconds: { type: 'number' },
            },
          },
          limit: {
            type: 'number',
            description: 'Cuántas publicaciones devolver (default 10, máximo 50).',
          },
        },
        required: ['range', 'sort_by'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_format_performance',
      description:
        'Compara el rendimiento por FORMATO (reel, carrusel, imagen, historia) en un rango. Cada formato trae su propio `n` y su propio `confidence_tier`: no los mezcles ni uses el de un formato para hablar de otro. Úsala antes de recomendar "haz más carruseles" o cualquier afirmación de que un formato funciona mejor que otro.',
      parameters: {
        type: 'object',
        properties: {
          range: {
            type: 'object',
            properties: {
              start: { type: 'string', description: 'YYYY-MM-DD' },
              end: { type: 'string', description: 'YYYY-MM-DD' },
            },
            required: ['start', 'end'],
          },
          metric: {
            type: 'string',
            enum: ['interactions', 'saves', 'reach', 'views'],
            description: 'Criterio de comparación. Default: interactions.',
          },
        },
        required: ['range'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_competitor_signal',
      description:
        'Devuelve lo último observado de los competidores registrados. ATENCIÓN: estos datos son ESTIMADOS — vienen de perfiles públicos o de registro manual, no están medidos como los propios. Nunca los presentes con la misma seguridad que las métricas de la cuenta, y fíjate en `stale_days`: si la observación tiene muchos días, dilo en vez de hablar en presente. Si `competitors` viene vacío, es que el usuario no ha registrado ninguno todavía — dilo, no te inventes competidores.',
      parameters: {
        type: 'object',
        properties: {
          username: {
            type: 'string',
            description: 'Opcional: un competidor concreto. Sin esto, devuelve todos.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'analyze_video_url',
      description:
        'Lee UNA publicación pública de Instagram a partir de su link (/p/, /reel/ o /tv/). Úsala cuando el usuario pegue un link y quiera que lo mires. Devuelve el copy, el autor, la duración, los likes y los comentarios públicos. ATENCIÓN: es una observación externa de UNA pieza — `n` es siempre 1 y `confidence_tier` siempre "insuficiente". NO ves alcance, ni guardados, ni si llevaba pauta, así que no puedes afirmar que funcionó ni recomendar copiarla por sus números; sí puedes describir su estructura y compararla con la voz de esta cuenta. Si falla, di exactamente por qué falló — no supongas lo que decía el video.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'El link completo, empezando por https://' },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_content_voice_profile',
      description:
        'Devuelve el perfil de voz de la cuenta medido sobre sus publicaciones con mejor rendimiento real: longitud de hook, uso de preguntas y números al abrir, emojis por caption, formatos dominantes y ejemplos literales de hooks. Úsalo SIEMPRE antes de escribir copy, guiones o ideas, para que suenen a esta cuenta y no a texto genérico. Fíjate en el confidence_tier: con pocas publicaciones el perfil es una pista, no una regla.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_brand_memory',
      description:
        'Devuelve lo que el usuario te ha dicho sobre su marca en conversaciones anteriores. Consúltala si vas a escribir algo y no estás seguro de sus preferencias.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_brand_memory',
      description:
        'Guarda UNA cosa estable que el usuario acaba de decirte sobre su marca (público, tono, temas prohibidos, preferencias de formato). Úsala solo con lo que el usuario dijo explícitamente y que seguirá siendo cierto dentro de meses. NUNCA guardes conclusiones tuyas, datos de métricas, ni cosas puntuales de esta conversación. Avísale siempre al usuario, en tu respuesta, de que lo guardaste.',
      parameters: {
        type: 'object',
        properties: {
          text: {
            type: 'string',
            description: 'La preferencia, en una frase, tal como la expresó el usuario.',
          },
        },
        required: ['text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'save_script_draft',
      description:
        'Guarda un guion como BORRADOR en el banco de guiones del usuario, para que no se pierda al cerrar el chat. No publica nada. Úsala cuando hayas escrito un guion que el usuario quiere conservar, y dile en tu respuesta que quedó guardado como borrador.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          hook: { type: 'string', description: 'La primera línea, la que retiene.' },
          body: { type: 'string', description: 'El desarrollo del guion.' },
          cta: { type: 'string', description: 'La llamada a la acción del cierre.' },
          format: { type: 'string', enum: ['reel', 'carrusel', 'historia'] },
          justification: {
            type: 'string',
            description:
              'Por qué este guion, anclado a lo que devolvieron las tools (perfil de voz, formato que funciona). No inventes que "va a funcionar mejor" sin datos.',
          },
        },
        required: ['title', 'hook', 'body', 'cta', 'format', 'justification'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_calendar',
      description:
        'Devuelve las piezas programadas en el calendario editorial en un rango de fechas, con sus ids reales. Llámala ANTES de proponer mover algo o de decir que un día está libre.',
      parameters: {
        type: 'object',
        properties: {
          range: {
            type: 'object',
            properties: {
              start: { type: 'string', description: 'YYYY-MM-DD' },
              end: { type: 'string', description: 'YYYY-MM-DD' },
            },
            required: ['start', 'end'],
          },
        },
        required: ['range'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'schedule_calendar_item',
      description:
        'Añade una pieza al calendario editorial interno, con estado "idea". No publica en Instagram ni programa nada fuera de ContentOS. Dile al usuario qué añadiste y en qué fecha.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          format: { type: 'string', enum: ['reel', 'carrusel', 'historia', 'ad'] },
          scheduled_at: {
            type: 'string',
            description: 'Fecha y hora ISO (ej. 2026-09-03T10:00:00.000Z).',
          },
          nivel: {
            type: 'string',
            enum: ['tofu', 'mofu', 'bofu'],
            description: 'Etapa del funnel.',
          },
          notes: { type: 'string' },
          script_id: {
            type: 'string',
            description: 'Id devuelto por save_script_draft, si esta pieza viene de un guion.',
          },
        },
        required: ['title', 'format', 'scheduled_at'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'move_calendar_item',
      description:
        'Cambia la fecha de una pieza ya existente del calendario. El item_id debe venir de list_calendar — nunca lo inventes.',
      parameters: {
        type: 'object',
        properties: {
          item_id: { type: 'string' },
          scheduled_at: { type: 'string', description: 'Nueva fecha y hora ISO.' },
        },
        required: ['item_id', 'scheduled_at'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_content_strategy',
      description:
        'Devuelve la ESTRUCTURA DE CALENDARIO que el usuario declaró: cuántas piezas por semana y de qué formato, mezcla objetivo de funnel, franjas horarias preferidas con su zona horaria, pilares de contenido y reglas de copy. Consúltala SIEMPRE antes de opinar sobre frecuencia, formatos, horarios o antes de armar un plan. ATENCIÓN: es un dato DECLARADO (lo que el usuario quiere hacer), no medido — nunca lo uses como prueba de que algo funciona. Si `configured` es false, el usuario no la ha definido: dilo y ofrécele partir de un arquetipo de get_calendar_playbooks.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_calendar_playbooks',
      description:
        'Devuelve arquetipos de estructura de calendario (educativo B2B, marca personal, e-commerce, servicios locales, autoridad de bajo volumen, semana de lanzamiento) con su cadencia, mezcla de funnel, franjas y pilares típicos, más una guía de qué mide cada etapa del funnel. Úsala cuando el usuario no tenga estrategia configurada o pida ayuda para diseñar una desde cero. Son HEURÍSTICAS declaradas por ContentOS, no rendimiento medido: dilo cuando recomiendes una, y fíjate en `not_for` antes de proponer un arquetipo.',
      parameters: {
        type: 'object',
        properties: {
          archetype_id: {
            type: 'string',
            description: 'Opcional: un arquetipo concreto. Sin esto, devuelve todos.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_calendar_coverage',
      description:
        'Compara, semana natural por semana natural, lo que YA está programado en el calendario contra la cadencia declarada en la estrategia. Devuelve por formato: programado, objetivo y hueco (`gap` positivo = faltan piezas). Úsala antes de decir que falta o sobra contenido — no cuentes las piezas tú mismo a partir de list_calendar.',
      parameters: {
        type: 'object',
        properties: {
          range: {
            type: 'object',
            properties: {
              start: { type: 'string', description: 'YYYY-MM-DD' },
              end: { type: 'string', description: 'YYYY-MM-DD' },
            },
            required: ['start', 'end'],
          },
        },
        required: ['range'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'draft_calendar_plan',
      description:
        'PROPONE un calendario completo para un periodo (varias piezas de golpe) y lo deja pendiente de que el usuario lo apruebe. NO escribe nada en el calendario: las piezas solo se crean cuando el usuario pulsa "Aplicar al calendario" en la tarjeta que aparece bajo tu respuesta. Úsala SIEMPRE que el usuario pida planificar una semana, quincena o mes — nunca llames a schedule_calendar_item muchas veces seguidas para eso. Antes: consulta get_content_strategy (cadencia y franjas), get_calendar_coverage (qué ya hay) y get_content_voice_profile (cómo suena la cuenta). La hora se toma de las franjas declaradas si no mandas `time`. Devuelve `deviations` cuando el plan se sale de la cadencia declarada: eso NO es un error, es información para el usuario. Al terminar, dile cuántas piezas propusiste y que están pendientes de su aprobación.',
      parameters: {
        type: 'object',
        properties: {
          range: {
            type: 'object',
            properties: {
              start: { type: 'string', description: 'YYYY-MM-DD' },
              end: { type: 'string', description: 'YYYY-MM-DD' },
            },
            required: ['start', 'end'],
          },
          rationale: {
            type: 'string',
            description:
              'Por qué este plan: en qué te apoyaste (estrategia declarada, rendimiento por formato, huecos de cobertura). Sin afirmar resultados futuros.',
          },
          items: {
            type: 'array',
            description: `Las piezas del plan (máximo ${MAX_PLAN_ITEMS}).`,
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                format: { type: 'string', enum: ['reel', 'carrusel', 'historia', 'ad'] },
                date: { type: 'string', description: 'YYYY-MM-DD en la zona horaria del usuario' },
                time: {
                  type: 'string',
                  description:
                    'HH:MM en 24 h, hora local. Si lo omites se usa una franja declarada de ese día.',
                },
                nivel: { type: 'string', enum: ['tofu', 'mofu', 'bofu'] },
                pillar: {
                  type: 'string',
                  description: 'Pilar de contenido, tal como se llama en la estrategia del usuario.',
                },
                notes: {
                  type: 'string',
                  description: 'Ángulo, hook propuesto o instrucción de producción.',
                },
                script_id: { type: 'string', description: 'Id de save_script_draft, si aplica.' },
              },
              required: ['title', 'format', 'date'],
            },
          },
        },
        required: ['range', 'rationale', 'items'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_success_definition',
      description:
        'Devuelve la métrica de éxito configurada por el usuario para esta cuenta (guardados, alcance, ventas, etc.). Si `configured` es false, el usuario no la configuró todavía y estás usando un default — debes declararlo explícitamente en tu respuesta cuando des cualquier insight de rendimiento, en vez de asumir en silencio que el usuario está de acuerdo con el default.',
      parameters: { type: 'object', properties: {} },
    },
  },
];

// ── Validación de argumentos ─────────────────────────────────
// Sin esto, unos argumentos malformados del modelo (pasa: un rango que llega
// como texto en vez de objeto) se colaban hasta el filtro de fechas, no
// coincidían con nada y devolvían `value: 0, n: 0` — una cifra falsa con
// pinta de dato real, que es justo lo que el contrato de confianza existe para
// impedir. Ahora la tool falla con un mensaje que el modelo puede leer y
// corregir en la siguiente ronda.
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'debe ser una fecha YYYY-MM-DD');

const rangeSchema = z
  .object({ start: dateSchema, end: dateSchema })
  .refine((r) => r.start <= r.end, { message: 'range.start no puede ser posterior a range.end' });

const segmentSchema = z
  .object({
    media_type: z.enum(['REEL', 'CAROUSEL', 'STORY', 'IMAGE']).optional(),
    min_avg_watch_time_seconds: z.number().optional(),
    max_avg_watch_time_seconds: z.number().optional(),
  })
  .optional();

const getMetricsSchema = z.object({
  metric: z.enum(SUCCESS_METRICS),
  range: rangeSchema,
  segment: segmentSchema,
});

const getPostBreakdownSchema = z.object({
  range: rangeSchema,
  sort_by: z.enum(['interactions', 'saves', 'reach', 'views']),
  segment: segmentSchema,
  limit: z.number().int().positive().max(50).optional(),
});

const getFormatPerformanceSchema = z.object({
  range: rangeSchema,
  metric: z.enum(['interactions', 'saves', 'reach', 'views']).optional(),
});

const getCompetitorSignalSchema = z.object({ username: z.string().optional() });

const analyzeVideoUrlSchema = z.object({ url: z.string().min(1) });

const updateBrandMemorySchema = z.object({ text: z.string().min(1).max(300) });

const saveScriptDraftSchema = z.object({
  title: z.string().min(1),
  hook: z.string().min(1),
  body: z.string().min(1),
  cta: z.string().min(1),
  format: z.enum(['reel', 'carrusel', 'historia']),
  justification: z.string().min(1),
});

// Acepta fecha con hora (lo normal en calendario) o solo día, que se ancla a
// mediodía UTC: un item "del día 3" a las 00:00 se ve en el día anterior según
// la zona horaria del usuario.
const scheduledAtSchema = z
  .string()
  .refine((v) => !Number.isNaN(new Date(v).getTime()), 'debe ser una fecha ISO válida')
  .transform((v) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T12:00:00.000Z` : v));

const scheduleCalendarItemSchema = z.object({
  title: z.string().min(1),
  format: z.enum(['reel', 'carrusel', 'historia', 'ad']),
  scheduled_at: scheduledAtSchema,
  nivel: z.enum(['tofu', 'mofu', 'bofu']).optional(),
  notes: z.string().optional(),
  script_id: z.string().optional(),
});

const moveCalendarItemSchema = z.object({
  item_id: z.string().min(1),
  scheduled_at: scheduledAtSchema,
});

const listCalendarSchema = z.object({ range: rangeSchema });

const getPlaybooksSchema = z.object({ archetype_id: z.string().optional() });

const coverageSchema = z.object({ range: rangeSchema });

// El plan entero se valida aquí antes de tocar nada. Las reglas "duras"
// (fecha fuera de rango, en el pasado, dos piezas en la misma franja) viven en
// draftCalendarPlan porque necesitan la estrategia y el calendario existente;
// aquí solo se comprueba la forma.
const draftCalendarPlanSchema = z.object({
  range: rangeSchema,
  rationale: z.string().min(1),
  items: z
    .array(
      z.object({
        title: z.string().min(1).max(160),
        format: z.enum(['reel', 'carrusel', 'historia', 'ad']),
        date: dateSchema,
        time: z
          .string()
          .regex(/^\d{2}:\d{2}$/, 'debe ser una hora HH:MM en 24 h')
          .optional(),
        nivel: z.enum(['tofu', 'mofu', 'bofu']).optional(),
        pillar: z.string().max(80).optional(),
        notes: z.string().max(1000).optional(),
        script_id: z.string().optional(),
      })
    )
    .min(1)
    .max(MAX_PLAN_ITEMS),
});

function parseArgs<T>(schema: z.ZodType<T>, name: string, args: unknown): T {
  const parsed = schema.safeParse(args);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `${i.path.join('.') || '(raíz)'}: ${i.message}`)
      .join('; ');
    throw new Error(
      `Argumentos inválidos para ${name} — ${detail}. Vuelve a llamarla con los argumentos corregidos; no interpretes esto como que no hay datos.`
    );
  }
  return parsed.data;
}

// Las tools de escritura necesitan saber en qué conversación pasó, para dejar
// procedencia en la memoria de marca (Decisión #6).
export async function runTool(
  ws: Workspace,
  name: string,
  args: Record<string, unknown>,
  conversationId?: string
): Promise<unknown> {
  switch (name) {
    // ── Lectura ──
    case 'get_metrics':
      return getMetrics(ws, parseArgs(getMetricsSchema, name, args));
    case 'get_post_breakdown':
      return getPostBreakdown(ws, parseArgs(getPostBreakdownSchema, name, args));
    case 'get_format_performance':
      return getFormatPerformance(ws, parseArgs(getFormatPerformanceSchema, name, args));
    case 'get_competitor_signal':
      return getCompetitorSignal(ws, parseArgs(getCompetitorSignalSchema, name, args));
    case 'analyze_video_url':
      return analyzeVideoUrl(ws, parseArgs(analyzeVideoUrlSchema, name, args));
    case 'get_content_voice_profile':
      return getVoiceProfile(ws);
    case 'get_brand_memory':
      return { entries: (await listBrandMemory(ws)).map((e) => e.text) };
    case 'get_success_definition':
      return getSuccessDefinitionTool(ws);
    case 'list_calendar':
      return listCalendar(ws, parseArgs(listCalendarSchema, name, args));
    case 'get_content_strategy':
      return getContentStrategyTool(ws);
    case 'get_calendar_playbooks':
      return getPlaybooks(parseArgs(getPlaybooksSchema, name, args).archetype_id);
    case 'get_calendar_coverage':
      return getCalendarCoverage(ws, parseArgs(coverageSchema, name, args).range);

    // ── Escritura (solo dentro de ContentOS, nada sale a Instagram) ──
    case 'update_brand_memory': {
      const { text } = parseArgs(updateBrandMemorySchema, name, args);
      const entry = await addBrandMemory(ws, text, conversationId ?? null);
      return { saved: true, text: entry.text };
    }
    case 'save_script_draft':
      return saveScriptDraft(ws, parseArgs(saveScriptDraftSchema, name, args));
    case 'schedule_calendar_item':
      return scheduleCalendarItem(ws, parseArgs(scheduleCalendarItemSchema, name, args));
    case 'move_calendar_item':
      return moveCalendarItem(ws, parseArgs(moveCalendarItemSchema, name, args));
    // Propone un plan completo. Escribe en `calendar_plans`, NUNCA en el
    // calendario: aplicarlo es un clic del usuario, no una decisión del modelo.
    case 'draft_calendar_plan':
      return draftCalendarPlan(ws, parseArgs(draftCalendarPlanSchema, name, args));

    default:
      throw new Error(`Tool desconocida: ${name}`);
  }
}
