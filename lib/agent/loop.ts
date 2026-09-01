// Loop del agente — el corazón del arnés (planes/2026-08-29-agente-os-fase1-arnes.md
// Paso 5). Un solo system prompt, sin router de intención separado (Decisión
// #2 del plan): el grounding vive en las tools (Capa 1), no en clasificar el
// mensaje antes de responder.
//
// Capa 2 del contrato de confianza: el modelo NO redacta directo al usuario.
// El último paso es siempre una tool call (`submit_insights`) con la lista de
// insights + el Markdown final. El código —nunca el modelo— decide si añade
// el disclaimer de confianza, a partir del `confidence_tier` crudo de cada
// insight.

import { AgentMessage, Insight } from '@/types';
import { Workspace } from '../accounts';
import { chatCompletion, ChatMessage, ToolCall, ToolSchema } from '../openrouter';
import { confidenceDisclaimer } from './confidence';
import { AGENT_TOOLS, runTool } from './tools';
import { logToolCall } from './audit';
import { getSuccessDefinition } from './success-definition';
import { brandMemoryPromptBlock } from './brand-memory';
import { contentStrategyPromptBlock } from './content-strategy';
import { uid } from '../db';

// El reporte quincenal necesita legítimamente muchas consultas: 4 métricas × 2
// periodos para crecimiento, más retención, más dos breakdowns. Con 6 rondas se
// quedaba corto y moría sin redactar nada. En la ÚLTIMA ronda se fuerza
// `submit_insights`, así que este número es el techo de exploración, no una
// carrera contra el reloj.
const MAX_ROUNDS = 12;

// El Markdown final viaja DENTRO de los argumentos de submit_insights, así que
// el presupuesto tiene que cubrir un reporte de 5 secciones completo. Con 3000
// el JSON llegaba cortado a media cadena y no parseaba.
const MAX_TOKENS = 8000;

// El agente no pudo cerrar el turno. Es un error de verdad, no un resultado:
// quien llama debe fallar en alto y NO persistir nada. Si un reporte de relleno
// se guardara, el cron quincenal lo vería como "ya hay reporte reciente" y no
// volvería a intentarlo en 15 días.
export class AgentIncompleteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgentIncompleteError';
  }
}

const SUBMIT_INSIGHTS_TOOL: ToolSchema = {
  type: 'function',
  function: {
    name: 'submit_insights',
    description:
      'Llámala al final, en vez de responder con texto libre directamente. `reply_md` es la respuesta en Markdown para el usuario. `insights` es la lista de afirmaciones de rendimiento que hiciste en `reply_md`, cada una con el `n` y `confidence_tier` EXACTOS que te devolvió get_metrics/get_post_breakdown — nunca los inventes ni los redondees. Si no hiciste ninguna afirmación de rendimiento (por ejemplo, solo generaste copy creativo), envía `insights: []`.',
    parameters: {
      type: 'object',
      properties: {
        reply_md: { type: 'string' },
        insights: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              claim: { type: 'string' },
              metric: { type: 'string' },
              n: { type: 'number' },
              confidence_tier: { type: 'string', enum: ['insuficiente', 'debil', 'razonable'] },
              source: { type: 'string' },
            },
            required: ['claim', 'metric', 'n', 'confidence_tier', 'source'],
          },
        },
      },
      required: ['reply_md', 'insights'],
    },
  },
};

async function agentSystemPrompt(ws: Workspace): Promise<string> {
  const success = await getSuccessDefinition(ws);
  const memory = await brandMemoryPromptBlock(ws);
  const strategy = await contentStrategyPromptBlock(ws);
  const who = ws.username ? `${ws.label} (@${ws.username})` : ws.label;
  const successLine = success.configured
    ? `La métrica de éxito configurada para esta cuenta es "${success.metric}".`
    : `Esta cuenta no configuró una métrica de éxito todavía — estás usando el default "${success.metric}" (alcance). Debes declararlo explícitamente en cualquier insight de rendimiento, no asumirlo en silencio.`;

  return `Eres el agente de contenido de ${who} dentro de ContentOS. Ayudas con análisis de métricas propias, y con generación de copy/guiones/estrategia.

Reglas de grounding, sin excepción:
- Cuando reportes o compares cualquier métrica de rendimiento, la cifra tiene que venir de una tool call (get_metrics / get_post_breakdown) hecha en este mismo turno. Nunca de memoria, de un turno anterior sin volver a consultar, ni de una estimación propia.
- El "n" y el "confidence_tier" que acompañan cada cifra los calcula la tool, no tú. Repórtalos tal cual te llegan — no los inventes, no los redondees, no los mejores.
- Cuando generes copy, guiones o ideas, tienes libertad creativa total. Pero no puedes afirmar que una pieza "va a funcionar mejor" o "va a tener más alcance" — esa es una afirmación de rendimiento y requiere datos reales de una tool, no la haces en modo creativo.
- ${successLine}

Sobre la competencia:
- Los datos de get_competitor_signal son ESTIMADOS: se observan desde fuera, no se miden. Nunca los pongas al mismo nivel que las métricas propias, y nunca deduzcas de ellos por qué a un competidor le funciona algo — solo ves números públicos, no su estrategia.
- Mira siempre \`stale_days\`: si la observación tiene semanas, habla en pasado y dilo.
- Si no hay competidores registrados, dilo. No inventes cuentas ni cifras de referencia del sector.

Sobre links que pegue el usuario:
- Si te pasa un link de una publicación de Instagram, léelo con analyze_video_url en vez de suponer qué contiene. Nunca describas un video que no pudiste leer.
- Si analyze_video_url falla, dile el motivo exacto que devolvió y qué puede hacer. No lo rellenes con una descripción plausible.
- Lo que veas ahí es UNA pieza ajena observada desde fuera: sirve para describir su estructura y contrastarla con la voz de esta cuenta, no para afirmar que funcionó.

Sobre escribir contenido:
- Antes de redactar copy, guiones o ideas, consulta get_content_voice_profile para sonar a esta cuenta. Si su confidence_tier es bajo, trátalo como pista y dilo.
- Si recomiendas un formato sobre otro, primero get_format_performance, y respeta el confidence_tier de CADA formato por separado.

Sobre la estructura del calendario (lo declarado vs. lo medido):
- Antes de opinar sobre frecuencia, formatos, horarios o pilares, consulta get_content_strategy. Es lo que el usuario DECLARÓ que quiere hacer.
- Lo declarado NO es evidencia de rendimiento. Nunca digas "esto funciona" citando la estrategia: para afirmar resultados hacen falta get_metrics o get_format_performance, con su n y su confidence_tier.
- Si la estrategia no está configurada, dilo y ofrece un punto de partida con get_calendar_playbooks, aclarando que es una heurística general y no una medición de esta cuenta. Respeta el campo "not_for" de cada arquetipo.
- Para saber si falta o sobra contenido, usa get_calendar_coverage. No cuentes las piezas a mano desde list_calendar.

Sobre planificar un periodo:
- Si el usuario pide organizar una semana, quincena o mes, usa draft_calendar_plan UNA vez con todas las piezas. Nunca encadenes muchos schedule_calendar_item para eso: schedule_calendar_item es para una pieza suelta.
- draft_calendar_plan NO escribe en el calendario. Deja una propuesta que el usuario aprueba con un botón. Termina siempre diciendo cuántas piezas propusiste, en qué rango, y que están pendientes de su aprobación — nunca digas que ya quedaron agendadas.
- Si el plan devuelve "deviations", explícaselas en una línea cada una: son decisiones que el usuario debe ver, no errores que tengas que ocultar ni corregir por tu cuenta.

Sobre guardar cosas:
- save_script_draft y schedule_calendar_item guardan dentro de ContentOS y nada sale publicado a Instagram. Aun así, cada vez que guardes algo dile al usuario exactamente qué guardaste y dónde.
- update_brand_memory es solo para preferencias estables que el usuario dijo explícitamente y seguirán siendo ciertas en meses. Nunca guardes conclusiones tuyas ni datos de métricas, y avísale siempre de que lo guardaste.
- No puedes editar la estrategia de calendario: si crees que debería cambiar, recomiéndalo y dile que la ajuste en la pantalla Estrategia.
- Nunca inventes un id: los de calendario salen de list_calendar, los de guion de save_script_draft.

- Al terminar cada turno, SIEMPRE respondes llamando a la tool "submit_insights" con tu Markdown final y la lista de insights que respaldan cualquier afirmación de rendimiento que hayas hecho. Nunca respondas con texto libre directamente.${strategy}${memory}`;
}

interface LoopResult {
  replyMd: string;
  insights: Insight[];
}

// Progreso del turno, para que la UI pueda enseñar el trabajo mientras ocurre.
//
// Deliberadamente NO hay evento de "token": la respuesta final del agente
// viaja dentro de los argumentos de submit_insights y el disclaimer de
// confianza se lo añade el código DESPUÉS de parsear ese JSON. Emitir prosa
// según llega significaría enseñarla antes de saber si lleva disclaimer —
// justo el agujero que la Capa 2 existe para tapar. Se transmite lo que sí es
// real: qué está consultando y con qué resultado.
export type AgentEvent =
  | { type: 'tool_start'; tool: string; args: Record<string, unknown> }
  | { type: 'tool_end'; tool: string; n: number | null; error: string | null }
  | { type: 'thinking'; round: number };

export type AgentEventHandler = (event: AgentEvent) => void;

async function runLoop(
  ws: Workspace,
  conversationId: string,
  initialMessages: ChatMessage[],
  onEvent?: AgentEventHandler
): Promise<LoopResult> {
  const system = await agentSystemPrompt(ws);
  const tools = [...AGENT_TOOLS, SUBMIT_INSIGHTS_TOOL];
  const messages: ChatMessage[] = [...initialMessages];

  for (let round = 0; round < MAX_ROUNDS; round++) {
    // Última ronda: se acabó la exploración. Se le quitan las demás tools y se
    // le obliga a cerrar con lo que ya consultó, en vez de dejarlo seguir
    // pidiendo datos hasta quedarse sin rondas y no redactar nada.
    onEvent?.({ type: 'thinking', round });

    const isFinalRound = round === MAX_ROUNDS - 1;
    if (isFinalRound) {
      messages.push({
        role: 'user',
        content:
          'Se acabaron las rondas de consulta. Cierra ahora con submit_insights usando SOLO los datos que ya te devolvieron las tools. Si te falta algo para alguna sección, dilo explícitamente en el Markdown en vez de estimarlo.',
      });
    }

    const result = await chatCompletion({
      system,
      messages,
      tools: isFinalRound ? [SUBMIT_INSIGHTS_TOOL] : tools,
      toolChoice: isFinalRound
        ? { type: 'function', function: { name: 'submit_insights' } }
        : 'auto',
      maxTokens: MAX_TOKENS,
    });

    if (!result.toolCalls || result.toolCalls.length === 0) {
      // El modelo respondió con texto libre en vez de cerrar con
      // submit_insights. Aceptarlo sería un agujero en la Capa 2: texto sin
      // insights es texto cuyas cifras nadie verificó. Se le recuerda la regla
      // y se sigue — la ronda final ya viene con la tool forzada.
      if (isFinalRound) {
        throw new AgentIncompleteError(
          'El agente no cerró con submit_insights ni con la tool forzada en la última ronda.'
        );
      }
      messages.push({ role: 'assistant', content: result.content });
      messages.push({
        role: 'user',
        content:
          'No respondas con texto libre. Vuelve a entregar esa respuesta llamando a la tool submit_insights.',
      });
      continue;
    }

    const submit = result.toolCalls.find((tc: ToolCall) => tc.function.name === 'submit_insights');
    if (submit) {
      let parsed: { reply_md: string; insights: Insight[] };
      try {
        parsed = JSON.parse(submit.function.arguments);
      } catch {
        const raw = submit.function.arguments ?? '';
        // Casi siempre es truncamiento por límite de tokens. Quedan rondas:
        // se le dice qué pasó y se le pide una versión más corta, en vez de
        // tirar a la basura las tool calls que ya hizo.
        if (!isFinalRound) {
          messages.push({ role: 'assistant', content: null, tool_calls: [submit] });
          messages.push({
            role: 'tool',
            tool_call_id: submit.id,
            name: 'submit_insights',
            content:
              'Error: el JSON de tus argumentos no se pudo parsear (probablemente quedó cortado por longitud). Vuelve a llamar a submit_insights con un reply_md más conciso — mantén las 5 secciones, pero recorta la prosa.',
          });
          continue;
        }
        throw new AgentIncompleteError(
          `El agente devolvió un submit_insights con JSON mal formado (${raw.length} caracteres, termina en: ${JSON.stringify(raw.slice(-80))}).`
        );
      }
      const insights = parsed.insights ?? [];
      const replyMd = renderWithDisclaimers(parsed.reply_md ?? '', insights);
      for (const insight of insights) {
        await logToolCall(ws, {
          conversation_id: conversationId,
          tool_called: 'submit_insights',
          params: { metric: insight.metric },
          n_returned: insight.n,
          confidence_tier: insight.confidence_tier,
          claim_final: insight.claim,
        });
      }
      return { replyMd, insights };
    }

    // Tool calls "normales": ejecutarlas, auditar, y devolver el resultado
    // al modelo como mensajes 'tool' para que siga razonando.
    messages.push({ role: 'assistant', content: result.content, tool_calls: result.toolCalls });
    for (const call of result.toolCalls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function.arguments || '{}');
      } catch {
        // argumentos mal formados — se ejecuta con {} y que la tool falle
        // con un error claro en vez de tumbar el loop entero.
      }
      onEvent?.({ type: 'tool_start', tool: call.function.name, args });
      let toolResult: unknown;
      try {
        toolResult = await runTool(ws, call.function.name, args, conversationId);
      } catch (err) {
        toolResult = { error: (err as Error).message };
      }
      const asRecord = toolResult as {
        n?: number;
        confidence_tier?: string;
        error?: string;
      } | null;
      onEvent?.({
        type: 'tool_end',
        tool: call.function.name,
        n: asRecord?.n ?? null,
        error: asRecord?.error ?? null,
      });
      await logToolCall(ws, {
        conversation_id: conversationId,
        tool_called: call.function.name,
        params: args,
        n_returned: asRecord?.n ?? null,
        confidence_tier: (asRecord?.confidence_tier as never) ?? null,
        claim_final: null,
      });
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        name: call.function.name,
        content: JSON.stringify(toolResult),
      });
    }
  }

  // Inalcanzable en la práctica: la ronda final fuerza submit_insights y, si
  // falla, lanza. Se deja por exhaustividad del tipo de retorno.
  throw new AgentIncompleteError('El agente agotó las rondas sin entregar una respuesta.');
}

// El renderer de Capa 2: inserta, en código, un disclaimer por cada insight
// que no sea de confianza "razonable". El modelo no controla si esto aparece.
function renderWithDisclaimers(replyMd: string, insights: Insight[]): string {
  const withDisclaimers = insights
    .map((i) => ({ i, disclaimer: confidenceDisclaimer(i.confidence_tier, i.n) }))
    .filter((x) => x.disclaimer !== null);
  if (withDisclaimers.length === 0) return replyMd;

  const notes = withDisclaimers
    .map((x) => `- **${x.i.claim}** — ${x.disclaimer}`)
    .join('\n');
  return `${replyMd}\n\n---\n### Notas de confianza\n${notes}`;
}

export async function runAgentTurn({
  ws,
  threadId,
  history,
  userMessage,
  onEvent,
}: {
  ws: Workspace;
  threadId: string;
  history: Pick<AgentMessage, 'role' | 'content'>[];
  userMessage: string;
  onEvent?: AgentEventHandler;
}): Promise<LoopResult> {
  const messages: ChatMessage[] = [
    ...history.map((h) => ({ role: h.role, content: h.content }) as ChatMessage),
    { role: 'user', content: userMessage },
  ];
  return runLoop(ws, threadId, messages, onEvent);
}

export async function runAgentTask({
  ws,
  conversationId,
  taskPrompt,
}: {
  ws: Workspace;
  conversationId?: string;
  taskPrompt: string;
}): Promise<LoopResult> {
  return runLoop(ws, conversationId ?? uid(), [{ role: 'user', content: taskPrompt }]);
}
