// Refresco de observaciones de competencia. Lo dispara el cron, nunca el
// agente en mitad de una conversación.

import { Workspace } from '../accounts';
import { CompetitorProvider } from './types';
import { instagramPublicProvider } from './instagram-public';
import { apifyCompetitorProvider } from './apify';
import { addSnapshot, listCompetitors } from './store';

// Un competidor que falla no debe impedir que se refresquen los demás, igual
// que en el cron de sync.
export interface RefreshResult {
  username: string;
  ok: boolean;
  error?: string;
}

const PROVIDERS: Record<string, CompetitorProvider> = {
  'instagram-public': instagramPublicProvider,
  apify: apifyCompetitorProvider,
};

export function activeProvider(): CompetitorProvider {
  const name = process.env.COMPETITOR_PROVIDER || 'instagram-public';
  const provider = PROVIDERS[name];
  if (!provider) {
    throw new Error(
      `COMPETITOR_PROVIDER="${name}" no existe. Disponibles: ${Object.keys(PROVIDERS).join(', ')}.`
    );
  }
  return provider;
}

// Espaciado entre perfiles: pedir 10 perfiles seguidos a toda velocidad es la
// forma más rápida de que bloqueen la IP y dejen de funcionar todos.
const DELAY_BETWEEN_PROFILES_MS = 1500;

export async function refreshCompetitors(ws: Workspace): Promise<RefreshResult[]> {
  const competitors = await listCompetitors(ws);
  if (competitors.length === 0) return [];

  const provider = activeProvider();
  const results: RefreshResult[] = [];

  for (const [index, competitor] of competitors.entries()) {
    if (index > 0) {
      await new Promise((r) => setTimeout(r, DELAY_BETWEEN_PROFILES_MS));
    }
    try {
      const observation = await provider.fetchProfile(competitor.username);
      await addSnapshot(ws, {
        competitor_id: competitor.id,
        observed_at: new Date().toISOString(),
        method: 'scrape',
        ...observation,
      });
      results.push({ username: competitor.username, ok: true });
    } catch (err) {
      // No se guarda snapshot: un fallo no debe dejar rastro que parezca dato.
      // La observación anterior sigue siendo la última válida, con su fecha,
      // y el agente puede ver que está vieja.
      results.push({ username: competitor.username, ok: false, error: (err as Error).message });
    }
  }

  return results;
}
