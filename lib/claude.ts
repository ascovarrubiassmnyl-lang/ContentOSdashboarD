// Cliente de la API de Anthropic para la redacción de reportes.
// Si ANTHROPIC_API_KEY no está configurada, se cae a un redactor local que
// usa los datos reales del dashboard (hooks top, retención) para
// que el flujo completo sea navegable sin llaves.

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-5';

export function hasClaudeKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function askClaude(
  system: string,
  user: string,
  maxTokens = 2000
): Promise<string> {
  return callClaude(system, [{ type: 'text', text: user }], maxTokens);
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

// Conversación multi-turno.
export async function askClaudeMessages(
  system: string,
  messages: ChatTurn[],
  maxTokens = 2000
): Promise<string> {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${text.slice(0, 300)}`);
  }
  const json = (await res.json()) as { content: { type: string; text?: string }[] };
  return json.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('');
}

// Visión: envía una imagen (base64) + prompt para transcribir/describir.
export async function askClaudeVision(
  system: string,
  prompt: string,
  imageBase64: string,
  mediaType: string,
  maxTokens = 1500
): Promise<string> {
  return callClaude(
    system,
    [
      { type: 'text', text: prompt },
      {
        type: 'image',
        source: { type: 'base64', media_type: mediaType, data: imageBase64 },
      },
    ],
    maxTokens
  );
}

async function callClaude(
  system: string,
  content: unknown[],
  maxTokens: number
): Promise<string> {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content }],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${text.slice(0, 300)}`);
  }
  const json = (await res.json()) as {
    content: { type: string; text?: string }[];
  };
  return json.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('');
}
