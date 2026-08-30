// Proveedor por defecto: el endpoint web público de perfiles de Instagram, el
// mismo que sirve la página cuando la abres sin sesión.
//
// ⚠️ Advertencia deliberada, no un detalle: Instagram limita fuertemente este
// endpoint y a menudo exige sesión. Que falle es el caso NORMAL, no la
// excepción. Todo lo de arriba (refresh, cron, tool del agente) está construido
// para seguir funcionando cuando esto no devuelve nada, y el usuario siempre
// puede registrar la observación a mano.
//
// Si esto se rompe del todo, la salida no es parchearlo: es escribir otro
// CompetitorProvider (un servicio de pago, o Zernio si algún día lo ofrece) y
// cambiar COMPETITOR_PROVIDER.

import { CompetitorObservation, CompetitorProvider } from './types';

const PROFILE_URL = 'https://www.instagram.com/api/v1/users/web_profile_info/?username=';
const TIMEOUT_MS = 12_000;

interface WebProfileResponse {
  data?: {
    user?: {
      edge_followed_by?: { count?: number };
      edge_owner_to_timeline_media?: {
        count?: number;
        edges?: {
          node?: {
            edge_liked_by?: { count?: number };
            edge_media_to_comment?: { count?: number };
          };
        }[];
      };
    };
  };
}

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

async function fetchOnce(username: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(`${PROFILE_URL}${encodeURIComponent(username)}`, {
      signal: controller.signal,
      headers: {
        // Sin estas cabeceras el endpoint responde 403 casi siempre. No es
        // evasión: es el mismo par de cabeceras que manda un navegador al
        // abrir el perfil público.
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'x-ig-app-id': '936619743392459',
        accept: 'application/json',
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

export const instagramPublicProvider: CompetitorProvider = {
  name: 'instagram-public',

  async fetchProfile(username: string): Promise<CompetitorObservation> {
    let res: Response;
    try {
      res = await fetchOnce(username);
      // Un solo reintento, y solo si el fallo pinta a transitorio. Insistir
      // más contra un bloqueo solo acelera el bloqueo.
      if (res.status === 429 || res.status >= 500) {
        await new Promise((r) => setTimeout(r, 2000));
        res = await fetchOnce(username);
      }
    } catch (err) {
      throw new Error(
        `No se pudo contactar con Instagram para @${username}: ${(err as Error).message}`
      );
    }

    if (!res.ok) {
      throw new Error(
        `Instagram respondió ${res.status} para @${username}. Suele significar bloqueo o que exige sesión — registra la observación a mano o cambia de proveedor.`
      );
    }

    let json: WebProfileResponse;
    try {
      json = (await res.json()) as WebProfileResponse;
    } catch {
      throw new Error(
        `Instagram devolvió algo que no es JSON para @${username} (probablemente una página de bloqueo).`
      );
    }

    const user = json.data?.user;
    if (!user) {
      throw new Error(`El perfil @${username} no existe o no es público.`);
    }

    const edges = user.edge_owner_to_timeline_media?.edges ?? [];
    const likes = edges
      .map((e) => e.node?.edge_liked_by?.count)
      .filter((v): v is number => typeof v === 'number');
    const comments = edges
      .map((e) => e.node?.edge_media_to_comment?.count)
      .filter((v): v is number => typeof v === 'number');

    return {
      followers: user.edge_followed_by?.count ?? null,
      posts_count: user.edge_owner_to_timeline_media?.count ?? null,
      avg_likes: avg(likes),
      avg_comments: avg(comments),
      sample_size: edges.length,
    };
  },
};
