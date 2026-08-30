// Almacén de competidores y sus observaciones, por cuenta.
//
// El agente lee SIEMPRE de aquí, nunca de la red (Decisión #1 del plan de
// Fase 2): así la latencia y la fragilidad del scraping no se contagian a la
// conversación.

import { Competitor, CompetitorSnapshot } from '@/types';
import { Workspace, readFor, writeFor } from '../accounts';
import { uid } from '../db';

// Tope por cuenta: acota el coste del scraping y la superficie de bloqueo.
export const MAX_COMPETITORS = 10;

export async function listCompetitors(ws: Workspace): Promise<Competitor[]> {
  return readFor<Competitor>(ws, 'competitors');
}

function normalizeUsername(raw: string): string {
  return raw.trim().replace(/^@/, '').toLowerCase();
}

export async function addCompetitor(
  ws: Workspace,
  input: { username: string; label?: string; notes?: string }
): Promise<Competitor> {
  const username = normalizeUsername(input.username);
  if (!username) throw new Error('El usuario del competidor no puede estar vacío.');

  const existing = await listCompetitors(ws);
  if (existing.some((c) => c.username === username)) {
    throw new Error(`@${username} ya está en la lista de competidores.`);
  }
  if (existing.length >= MAX_COMPETITORS) {
    throw new Error(
      `Máximo ${MAX_COMPETITORS} competidores por cuenta. Borra alguno antes de añadir otro.`
    );
  }

  const competitor: Competitor = {
    id: uid(),
    account_id: ws.id,
    username,
    label: input.label?.trim() || `@${username}`,
    notes: input.notes?.trim() || '',
    created_at: new Date().toISOString(),
  };
  await writeFor(ws, 'competitors', [...existing, competitor]);
  return competitor;
}

export async function removeCompetitor(ws: Workspace, id: string): Promise<void> {
  const remaining = (await listCompetitors(ws)).filter((c) => c.id !== id);
  await writeFor(ws, 'competitors', remaining);
  // Las observaciones de un competidor borrado no le sirven a nadie y, si se
  // quedan, el agente las seguiría leyendo sin poder decir de quién son.
  const snapshots = (await listSnapshots(ws)).filter((s) => s.competitor_id !== id);
  await writeFor(ws, 'competitor_snapshots', snapshots);
}

export async function listSnapshots(ws: Workspace): Promise<CompetitorSnapshot[]> {
  return readFor<CompetitorSnapshot>(ws, 'competitor_snapshots');
}

export async function addSnapshot(
  ws: Workspace,
  snapshot: Omit<CompetitorSnapshot, 'id' | 'account_id'>
): Promise<CompetitorSnapshot> {
  const row: CompetitorSnapshot = { ...snapshot, id: uid(), account_id: ws.id };
  const all = await listSnapshots(ws);
  all.unshift(row);
  await writeFor(ws, 'competitor_snapshots', all);
  return row;
}

// La observación más reciente de cada competidor.
export async function latestSnapshotByCompetitor(
  ws: Workspace
): Promise<Map<string, CompetitorSnapshot>> {
  const all = await listSnapshots(ws);
  const latest = new Map<string, CompetitorSnapshot>();
  for (const s of all) {
    const current = latest.get(s.competitor_id);
    if (!current || s.observed_at > current.observed_at) latest.set(s.competitor_id, s);
  }
  return latest;
}
