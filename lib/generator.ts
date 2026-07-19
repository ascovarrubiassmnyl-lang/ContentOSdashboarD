import { MediaPost, Script, ScriptFormat, Source } from '@/types';
import { readCollection } from './db';
import { buildMetrics } from './metrics';
import { askClaude, askClaudeMessages, ChatTurn, hasClaudeKey } from './claude';
import { buildFrameworkDemo, frameworksPrompt, pickFramework } from './frameworks';

export interface GenerateInput {
  format: ScriptFormat;
  objective: 'alcance' | 'engagement' | 'clics';
  tone: string;
  sourceIds: string[];
  topic?: string;
  useAllSources?: boolean;
}

const MAX_SOURCE_CHARS = 1800; // por fuente, para no inflar el prompt
const MAX_SOURCES = 30;

interface GeneratedScript {
  title: string;
  hook: string;
  body: string;
  cta: string;
  justification: string;
  score: number;
  metrics_context: Record<string, unknown>;
}

async function topAndWorstPosts() {
  const posts = await readCollection<MediaPost>('media_posts');
  const scored = posts.map((p) => ({
    ...p,
    eng: p.likes + p.comments + p.saves + p.shares,
  }));
  const top = [...scored].sort((a, b) => b.eng - a.eng).slice(0, 5);
  const worst = [...scored].sort((a, b) => a.eng - b.eng).slice(0, 3);
  return { top, worst };
}

async function buildContext(input: GenerateInput) {
  const metrics = await buildMetrics('30d');
  const { top, worst } = await topAndWorstPosts();

  const allSources = await readCollection<Source>('sources');
  // Si useAllSources: todo el banco como base de conocimiento.
  // Si no: solo las fuentes seleccionadas.
  const sources = (
    input.useAllSources
      ? allSources
      : allSources.filter((s) => input.sourceIds.includes(s.id))
  ).slice(0, MAX_SOURCES);

  const kpiLines = metrics.kpis
    .map((k) => `- ${k.label}: ${k.value.toFixed(k.format === 'int' ? 0 : 2)}`)
    .join('\n');
  const topLines = top
    .map(
      (p) =>
        `- [${p.media_type}] "${p.hook}" → ${p.eng} interacciones, ${p.reach} alcance` +
        (p.avg_watch_time_seconds ? `, ${p.avg_watch_time_seconds}s retención media` : '')
    )
    .join('\n');
  const worstLines = worst
    .map((p) => `- [${p.media_type}] "${p.hook}" → solo ${p.eng} interacciones`)
    .join('\n');
  const sourceLines = sources
    .map((s) => {
      const body =
        s.content.length > MAX_SOURCE_CHARS
          ? s.content.slice(0, MAX_SOURCE_CHARS) + '…'
          : s.content;
      const doc = s.file_name ? ` · archivo: ${s.file_name}` : '';
      return `### ${s.title} (${s.type}${doc})\n${body}`;
    })
    .join('\n\n');

  const sourcesHeader = input.useAllSources
    ? `BANCO DE CONOCIMIENTO COMPLETO (${sources.length} fuentes — úsalo como contexto de fondo)`
    : 'FUENTES SELECCIONADAS (materia prima real)';

  return {
    metrics,
    top,
    sources,
    contextText: `MÉTRICAS ÚLTIMOS 30 DÍAS:\n${kpiLines}\n\nTOP 5 POSTS (patrones que SÍ funcionan):\n${topLines}\n\nPEORES POSTS (patrones a evitar):\n${worstLines}\n\n${
      sourceLines ? `${sourcesHeader}:\n${sourceLines}` : ''
    }`,
  };
}

const SYSTEM_PROMPT = `Eres el guionista de cabecera de Santiago Castro (@scav_86), creador de contenido sobre creación de contenido y análisis de métricas. Escribes guiones en español, directos, sin relleno, con hooks que detienen el scroll en menos de 3 segundos. Usas los datos reales de su cuenta para justificar cada decisión creativa. Respondes SIEMPRE en JSON válido con esta forma exacta:
{"title": "...", "hook": "...", "body": "...", "cta": "...", "justification": "..."}
El body debe estar estructurado por bloques con saltos de línea. La justification explica qué dato real respalda el hook y el enfoque.`;

export async function generateScript(input: GenerateInput): Promise<GeneratedScript> {
  const { metrics, top, sources, contextText } = await buildContext(input);
  const metricsContext = {
    engagement_rate: metrics.engagementRate,
    avg_watch_time: metrics.avgWatchTime,
    top_hooks: top.slice(0, 3).map((p) => p.hook),
    period: '30d',
  };

  if (hasClaudeKey()) {
    const user = `Genera un guion de ${input.format} con objetivo de ${input.objective}, tono ${input.tone}.${
      input.topic ? ` Tema solicitado: ${input.topic}.` : ''
    }\n\nEl body DEBE seguir los pasos exactos de uno de los 7 Frameworks de Guiones Virales (elige el más adecuado):\n${frameworksPrompt()}\n\n${contextText}`;
    const raw = await askClaude(SYSTEM_PROMPT, user);
    const parsed = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
    const score = await scoreScript(parsed.hook, parsed.body, parsed.cta, input.format);
    return { ...parsed, score, metrics_context: metricsContext };
  }

  // ── Generador demo (sin API key) — usa los datos reales del dashboard ──
  const bestHook = top[0]?.hook ?? 'La métrica que deberías mirar primero';
  const sourceInsight = sources[0]?.content.slice(0, 140) ?? '';
  const topicLabel = input.topic || 'por qué tu contenido no retiene';

  const formats: Record<ScriptFormat, { title: string; body: string }> = {
    reel: {
      title: `Reel — ${topicLabel}`,
      body: `[0-3s — HOOK EN CÁMARA]\nMirada directa, sin intro: el hook completo en pantalla.\n\n[3-8s — TENSIÓN]\n"Tu mejor contenido está retenido en promedio ${metrics.avgWatchTime}s. El problema no es el algoritmo — es lo que pasa en el segundo 4."\n\n[8-20s — VALOR]\nTres cortes rápidos:\n1. Muestra el dato real (captura del dashboard).\n2. El patrón de tus top posts: "${bestHook}" funcionó porque promete algo específico.\n3. La corrección concreta: reescribe el hook ANTES de grabar, no después.\n\n[20-28s — PRUEBA]\n"Esto salió de mis propios datos: ER del ${metrics.engagementRate}% en 30 días haciéndolo así."${
        sourceInsight ? `\n\n[Contexto de audiencia]\n"${sourceInsight}…"` : ''
      }`,
    },
    carrusel: {
      title: `Carrusel — ${topicLabel}`,
      body: `SLIDE 1 (portada): El hook en tipografía gigante sobre fondo oscuro.\n\nSLIDE 2: El error — publicar sin revisar qué retuvo la última vez.\n\nSLIDE 3: El dato — retención media de ${metrics.avgWatchTime}s en reels; el 70% se decide antes del segundo 3.\n\nSLIDE 4: El patrón ganador — "${bestHook}" (tu top post real).\n\nSLIDE 5: Checklist accionable — 3 preguntas antes de publicar.\n\nSLIDE 6: CTA con instrucción única.`,
    },
    historia: {
      title: `Historia — ${topicLabel}`,
      body: `FRAME 1: Pregunta directa con sticker de encuesta — "¿Revisas tus métricas antes de crear?"\n\nFRAME 2: Dato en pantalla — captura del dashboard con el ER del ${metrics.engagementRate}%.\n\nFRAME 3: Micro-lección de 15 segundos en cámara.\n\nFRAME 4: CTA con caja de preguntas.`,
    },
  };

  const f = formats[input.format];
  const script: GeneratedScript = {
    title: f.title,
    hook: bestHook.includes('métrica')
      ? `Deja de culpar al algoritmo: tus datos ya te dijeron qué publicar`
      : `${bestHook} (versión ${new Date().getFullYear()})`,
    body: f.body,
    cta:
      input.objective === 'clics'
        ? 'Comenta "DATOS" y te mando la plantilla del dashboard al DM.'
        : input.objective === 'engagement'
        ? 'Guárdalo para tu próxima sesión de creación y cuéntame en comentarios cuál es tu retención media.'
        : 'Compártelo con un creador que siga publicando a ciegas.',
    justification: `Hook derivado de tu top post real ("${bestHook}", el de mayor interacción en 30 días). El objetivo "${input.objective}" se ataca con el CTA elegido; el cuerpo usa tu retención media real (${metrics.avgWatchTime}s) como gancho de autoridad. ${
      sources.length > 0
        ? `Incorpora la fuente "${sources[0].title}" como insight de audiencia.`
        : 'Sin fuentes seleccionadas — considera añadir una objeción real para más especificidad.'
    } [Generado en modo demo — configura ANTHROPIC_API_KEY para generación con Claude]`,
    score: scoreScriptLocal(bestHook, f.body, input),
    metrics_context: metricsContext,
  };
  return script;
}

// ── Quality gate ────────────────────────────────────────────

const SCORE_SYSTEM = `Eres un editor implacable de contenido para Instagram. Evalúas guiones contra este checklist: (1) hook específico y con tensión en <3s, (2) promesa clara, (3) estructura con ritmo, (4) prueba o dato concreto, (5) un solo CTA sin fricción. Respondes SOLO con un número entero de 0 a 100.`;

export async function scoreScript(
  hook: string,
  body: string,
  cta: string,
  format: string
): Promise<number> {
  if (!hasClaudeKey()) return 0;
  const raw = await askClaude(
    SCORE_SYSTEM,
    `Formato: ${format}\nHOOK: ${hook}\n\nBODY:\n${body}\n\nCTA: ${cta}`,
    16
  );
  const n = parseInt(raw.replace(/\D/g, ''), 10);
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 70;
}

function scoreScriptLocal(hook: string, body: string, input: GenerateInput): number {
  let score = 60;
  if (hook.length > 20 && hook.length < 90) score += 10;
  if (body.includes('[') || body.includes('SLIDE') || body.includes('FRAME')) score += 10;
  if (input.sourceIds.length > 0) score += 10;
  if (input.topic) score += 5;
  return Math.min(score + 3, 95);
}

// ── Chat conversacional del generador ──────────────────────
// Usa SIEMPRE todo el banco de fuentes + métricas reales como contexto.

const CHAT_SYSTEM = `Eres el guionista de cabecera de Santiago Castro (@scav_86), creador de contenido sobre disciplina, mentalidad y creación de contenido. Escribes en español, directo y sin relleno, con hooks que frenan el scroll en menos de 3 segundos.

METODOLOGÍA OBLIGATORIA — los 7 Frameworks de Guiones Virales (guía propia de Santiago):
- TODO guion que escribas DEBE seguir uno de los 7 frameworks (abajo tienes la referencia completa con pasos y frases ejemplo).
- Elige el framework según la intención del pedido (o el que el usuario nombre explícitamente: "framework 3", "VSL", "epifanía", etc.). Usa la guía de tono/ritmo y las combinaciones estratégicas cuando aplique.
- Estructura el cuerpo del guion siguiendo los pasos EXACTOS del framework elegido, en orden, con cada bloque etiquetado con el nombre del paso.

Reglas:
- El usuario te describe en lenguaje natural el guion que necesita. Devuélvele un guion listo para grabar.
- Usa SIEMPRE los datos reales de su cuenta y su banco de fuentes (te los paso abajo) para decidir el ángulo y justificar el hook.
- Infiere el formato (reel, carrusel, historia) de lo que pida; si no lo dice, asume reel. En carrusel etiqueta los bloques como SLIDE, en historia como FRAME.
- Responde en Markdown claro con esta estructura:
  **Framework:** #N — Nombre (por qué este)
  **Hook:** …
  **Guion:** (bloques etiquetados con los pasos del framework)
  **CTA:** …
  **Por qué funciona:** (1-2 frases atando el enfoque a un dato real suyo y a la psicología del framework)
- Si el usuario pide ajustes ("más corto", "cambia el hook", "otro ángulo"), refina el guion anterior manteniendo el framework (o cambia de framework si te lo pide).
- Nada de preámbulos tipo "aquí tienes"; entrega el guion directo.`;

function inferFormat(message: string): ScriptFormat {
  const m = message.toLowerCase();
  if (m.includes('carrusel') || m.includes('carousel') || m.includes('slide')) return 'carrusel';
  if (m.includes('historia') || m.includes('story') || m.includes('stories')) return 'historia';
  return 'reel';
}

function inferObjective(message: string): GenerateInput['objective'] {
  const m = message.toLowerCase();
  if (m.includes('vend') || m.includes('venta') || m.includes('clic') || m.includes('link') || m.includes('compr'))
    return 'clics';
  if (m.includes('engagement') || m.includes('comenta') || m.includes('guarda') || m.includes('interac'))
    return 'engagement';
  return 'alcance';
}

export async function chatReply(message: string, history: ChatTurn[] = []): Promise<string> {
  const format = inferFormat(message);
  const objective = inferObjective(message);
  const { metrics, top, sources, contextText } = await buildContext({
    format,
    objective,
    tone: 'directo y sin relleno',
    sourceIds: [],
    topic: message,
    useAllSources: true,
  });

  if (hasClaudeKey()) {
    const system = `${CHAT_SYSTEM}\n\n${frameworksPrompt()}\n\n=== CONTEXTO REAL (datos de su cuenta y banco de fuentes) ===\n${contextText}`;
    const turns: ChatTurn[] = [...history.slice(-8), { role: 'user', content: message }];
    return askClaudeMessages(system, turns, 2200);
  }

  // ── Demo (sin API key): guion estructurado con el framework adecuado ──
  const fw = pickFramework(message, objective);
  // Limpia el pedido para usarlo como tema: quita verbos de encargo y formato.
  const topic = message
    .toLowerCase()
    .replace(
      /^(haz(me)?|crea(me)?|genera(me)?|escribe(me)?|necesito|quiero|dame)\s+/i,
      ''
    )
    .replace(/^(un|una)\s+(reel|carrusel|historia|video|guion)\s+(sobre|de|que|para)\s+/i, '')
    .replace(/^(rompa|rompe|romper)\s+(el mito|la creencia|la idea)\s+de(\s+que)?\s+/i, '')
    .replace(/^(sobre|de)\s+/i, '')
    .slice(0, 100)
    .trim();
  const demo = buildFrameworkDemo(fw, format, {
    topHook: top[0]?.hook ?? 'La métrica que deberías mirar primero',
    avgWatch: metrics.avgWatchTime,
    er: metrics.engagementRate,
    topic: topic || 'tu contenido',
    sourceInsight: sources[0]?.content,
  });
  return `**Framework:** #${fw.id} — ${fw.name} (${fw.purpose.split('.')[0].toLowerCase()})\n\n**Hook:** ${demo.hook}\n\n**Guion:**\n${demo.body}\n\n**CTA:** ${demo.cta}\n\n**Por qué funciona:** ${demo.justification}`;
}

export type { GeneratedScript };
export type ScriptRow = Script;
