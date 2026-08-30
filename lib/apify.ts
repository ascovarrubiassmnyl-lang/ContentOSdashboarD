// Cliente mínimo de Apify, compartido por el proveedor de competencia
// (lib/competitors/apify.ts) y el de videos (lib/videos/apify.ts).
//
// Apify corre "actores" (scrapers alojados). `run-sync-get-dataset-items`
// lanza uno, espera a que termine y devuelve directamente sus resultados, así
// que no hace falta hacer polling de la corrida ni leer el dataset aparte.

const DEFAULT_INSTAGRAM_ACTOR = 'apify~instagram-scraper';

// Un perfil con sus últimos posts tarda decenas de segundos. Por debajo de esto
// se cortaría a mitad de corrida y parecería un fallo del scraper.
const TIMEOUT_MS = 120_000;

export function hasApifyToken(): boolean {
  return Boolean(process.env.APIFY_TOKEN);
}

export function instagramActor(): string {
  return process.env.APIFY_INSTAGRAM_ACTOR || DEFAULT_INSTAGRAM_ACTOR;
}

/**
 * Lanza un actor y devuelve los items de su dataset.
 *
 * Lanza si falta el token, si Apify responde error, o si el actor termina sin
 * resultados. Ese último caso es el importante: Apify devuelve `[]` con HTTP
 * 200 cuando el perfil es privado, no existe o el post fue borrado, y un array
 * vacío tratado como "cero" es justo el fallo silencioso que el contrato de
 * confianza prohíbe.
 */
export async function runActor(
  actorId: string,
  input: Record<string, unknown>
): Promise<Record<string, unknown>[]> {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    throw new Error(
      'Falta APIFY_TOKEN. Créalo en https://console.apify.com/account/integrations y añádelo a las variables de entorno.'
    );
  }

  const url = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const reason = (err as Error).name === 'TimeoutError' ? 'tardó más de 2 min' : (err as Error).message;
    throw new Error(`No se pudo contactar con Apify (${reason}).`);
  }

  if (res.status === 401 || res.status === 403) {
    throw new Error('Apify rechazó el token (401/403). Revisa APIFY_TOKEN.');
  }
  if (res.status === 402) {
    throw new Error('La cuenta de Apify se quedó sin crédito.');
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Apify devolvió ${res.status}: ${body.slice(0, 200)}`);
  }

  const items = (await res.json()) as unknown;
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error(
      'Apify terminó sin resultados. Suele significar que el perfil es privado, que no existe, o que el post fue borrado.'
    );
  }

  // Apify marca así los items de error en vez de fallar la corrida entera.
  const first = items[0] as Record<string, unknown>;
  if (typeof first.error === 'string') {
    throw new Error(`Apify no pudo leerlo: ${first.error}${first.errorDescription ? ` — ${first.errorDescription}` : ''}`);
  }

  return items as Record<string, unknown>[];
}

// Los actores cambian nombres de campo entre versiones. Se leen varios
// candidatos y, si ninguno es un número, se devuelve null — nunca 0, que se
// leería como "medido y salió cero".
export function num(row: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    const v = row[key];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  return null;
}

export function str(row: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const v = row[key];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return null;
}
