// Cliente de OpenRouter — motor único de IA de ContentOS (reemplaza lib/claude.ts).
// OpenRouter expone una API compatible con OpenAI chat completions, con
// tool-calling en el mismo formato que usa OpenAI. Sin SDK nuevo: fetch plano,
// mismo estilo que tenía el cliente de Anthropic que reemplaza.

const API_URL = 'https://openrouter.ai/api/v1/chat/completions';
// Enrutador de modelos gratuitos de OpenRouter: en vez de apuntar a un modelo
// concreto que puede estar caído o saturado, OpenRouter elige el gratuito con
// más disponibilidad en ese momento. Se puede fijar uno concreto con
// OPENROUTER_MODEL.
const DEFAULT_MODEL = 'openrouter/free';

export function hasOpenRouterKey(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

function model(): string {
  return process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
}

export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ChatMessage {
  role: ChatRole;
  content: string | null;
  // Solo en mensajes 'assistant' que piden ejecutar tools.
  tool_calls?: ToolCall[];
  // Solo en mensajes 'tool': a qué tool_call responde.
  tool_call_id?: string;
  name?: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface ToolSchema {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ChatCompletionResult {
  content: string | null;
  toolCalls: ToolCall[] | null;
}

function headers() {
  return {
    'content-type': 'application/json',
    authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    // Recomendados por OpenRouter para atribución, no obligatorios pero
    // ayudan a que el proveedor no rate-limite como tráfico anónimo.
    'HTTP-Referer': process.env.AUTH_URL || 'https://contentos.app',
    'X-Title': 'ContentOS',
  };
}

// 'auto' deja elegir al modelo; pasar el nombre de una tool la fuerza — así el
// loop puede exigir `submit_insights` en su última ronda en vez de confiar en
// que el modelo se acuerde de cerrar por su cuenta.
export type ToolChoice = 'auto' | { type: 'function'; function: { name: string } };

export async function chatCompletion({
  system,
  messages,
  tools,
  toolChoice = 'auto',
  maxTokens = 2000,
}: {
  system: string;
  messages: ChatMessage[];
  tools?: ToolSchema[];
  toolChoice?: ToolChoice;
  maxTokens?: number;
}): Promise<ChatCompletionResult> {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      model: model(),
      max_tokens: maxTokens,
      messages: [{ role: 'system', content: system }, ...messages],
      ...(tools ? { tools, tool_choice: toolChoice } : {}),
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenRouter API ${res.status}: ${text.slice(0, 300)}`);
  }
  const json = (await res.json()) as {
    choices: { message: { content: string | null; tool_calls?: ToolCall[] } }[];
  };
  const msg = json.choices[0]?.message;
  return {
    content: msg?.content ?? null,
    toolCalls: msg?.tool_calls && msg.tool_calls.length > 0 ? msg.tool_calls : null,
  };
}

// Variante con streaming (SSE) — la usa el endpoint de chat de prueba.
// Devuelve el texto completo al final; onDelta recibe cada fragmento a medida
// que llega, para poder retransmitirlo al cliente.
export async function chatCompletionStream({
  system,
  messages,
  maxTokens = 2000,
  onDelta,
}: {
  system: string;
  messages: ChatMessage[];
  maxTokens?: number;
  onDelta?: (delta: string) => void;
}): Promise<string> {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      model: model(),
      max_tokens: maxTokens,
      messages: [{ role: 'system', content: system }, ...messages],
      stream: true,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenRouter API ${res.status}: ${text.slice(0, 300)}`);
  }
  if (!res.body) return '';

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (data === '[DONE]') continue;
      try {
        const parsed = JSON.parse(data) as {
          choices: { delta?: { content?: string } }[];
        };
        const delta = parsed.choices[0]?.delta?.content;
        if (delta) {
          full += delta;
          onDelta?.(delta);
        }
      } catch {
        // chunk incompleto o de keep-alive — se ignora
      }
    }
  }
  return full;
}
