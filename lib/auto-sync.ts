// Sincronización automática de las cuentas conectadas.
//
// El usuario no tiene que pulsar "Sincronizar ahora": la app pide este trabajo
// sola (al abrirla, al volver a la pestaña y cada pocos minutos) y el servidor
// decide qué cuentas toca refrescar de verdad. Toda la política vive aquí, no
// en el cliente, porque hay varias fuentes que lo disparan —el navegador, el
// alta de una cuenta y el cron diario— y todas deben respetar el mismo límite.
import {
  Workspace,
  activeWorkspace,
  hasZernioFor,
  listAccountsForUser,
} from './accounts';
import { syncFromZernio } from './zernio';

// Cada cuánto se considera "vieja" la información de una cuenta. Bajarlo
// castiga la API de Zernio; subirlo deja los números envejecer.
export const AUTO_SYNC_MINUTES = clampMinutes(process.env.AUTO_SYNC_MINUTES, 15);

// Cuántas cuentas se refrescan como mucho en una misma pasada. Cada sync son
// varias llamadas a Zernio con paginación: con muchas cuentas, hacerlas todas
// en una sola petición HTTP se pasaría del tiempo límite del servidor. Las que
// queden se refrescan en la siguiente pasada, unos minutos después.
export const AUTO_SYNC_MAX_PER_RUN = 3;

function clampMinutes(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.max(Math.round(n), 1), 1440);
}

export interface AutoSyncResult {
  id: string;
  label: string;
  postsSynced?: number;
  followers?: number;
  error?: string;
}

export interface AutoSyncReport {
  synced: AutoSyncResult[]; // cuentas efectivamente refrescadas
  failed: AutoSyncResult[]; // lo intentaron y falló Zernio
  fresh: number; // al día: no tocaba refrescarlas
  cooling: number; // fallaron hace poco: se espera antes de reintentar
  pending: number; // tocaba, pero se quedaron para la pasada siguiente
  withoutKey: number; // sin API key de Zernio (modo demo)
  intervalMinutes: number;
  at: string;
}

export function minutesSince(iso: string | null): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY;
  return (Date.now() - t) / 60_000;
}

export function isStale(ws: Workspace, minutes = AUTO_SYNC_MINUTES): boolean {
  return minutesSince(ws.last_sync_at) >= minutes;
}

// Un sync ya en curso para una cuenta se reaprovecha en vez de lanzar otro.
// Sin esto, dos pestañas abiertas (o una pestaña y el alta de una cuenta)
// dispararían dos syncs simultáneos de la misma cuenta, que se pisarían al
// escribir sus colecciones.
const inFlight = new Map<string, Promise<AutoSyncResult>>();

// Cuándo se intentó por última vez cada cuenta, haya salido bien o mal. Un
// sync que falla no toca `last_sync_at`, así que sin esto una cuenta rota
// (key caducada, plan viejo de Zernio) se reintentaría en cada sondeo del
// navegador, cada pocos minutos y desde cada pestaña abierta.
const lastAttempt = new Map<string, number>();

export function syncAccount(ws: Workspace): Promise<AutoSyncResult> {
  const running = inFlight.get(ws.id);
  if (running) return running;

  lastAttempt.set(ws.id, Date.now());
  const task = syncFromZernio(ws)
    .then((r) => ({
      id: ws.id,
      label: ws.label,
      postsSynced: r.postsSynced,
      followers: r.followers,
    }))
    .catch((err) => ({ id: ws.id, label: ws.label, error: (err as Error).message }))
    .finally(() => inFlight.delete(ws.id));

  inFlight.set(ws.id, task);
  return task;
}

// Refresca las cuentas del usuario que lo necesiten. `force` ignora el
// intervalo (lo usa el botón "Sincronizar todo"), pero nunca el candado de
// syncs en curso.
export async function autoSyncUser(
  userId: string,
  opts: { force?: boolean; max?: number } = {}
): Promise<AutoSyncReport> {
  const max = opts.max ?? AUTO_SYNC_MAX_PER_RUN;
  const accounts = await listAccountsForUser(userId);

  const report: AutoSyncReport = {
    synced: [],
    failed: [],
    fresh: 0,
    cooling: 0,
    pending: 0,
    withoutKey: 0,
    intervalMinutes: AUTO_SYNC_MINUTES,
    at: new Date().toISOString(),
  };
  if (accounts.length === 0) return report;

  // La cuenta activa es la que el usuario está mirando: va primero aunque no
  // sea la más vieja. Detrás, de más rancia a menos.
  let activeId: string | null = null;
  try {
    activeId = (await activeWorkspace(userId)).id;
  } catch {
    // sin cuenta activa resoluble — el orden por antigüedad basta
  }

  const candidates: Workspace[] = [];
  for (const ws of accounts) {
    if (!(await hasZernioFor(ws))) {
      report.withoutKey++;
      continue;
    }
    if (!opts.force && !isStale(ws)) {
      report.fresh++;
      continue;
    }
    const since = Date.now() - (lastAttempt.get(ws.id) ?? 0);
    if (!opts.force && since < AUTO_SYNC_MINUTES * 60_000) {
      report.cooling++;
      continue;
    }
    candidates.push(ws);
  }

  candidates.sort((a, b) => {
    if (a.id === activeId) return -1;
    if (b.id === activeId) return 1;
    return minutesSince(b.last_sync_at) - minutesSince(a.last_sync_at);
  });

  const batch = candidates.slice(0, max);
  report.pending = candidates.length - batch.length;

  // En serie a propósito: en paralelo, varias cuentas de la misma key de
  // Zernio se comen el límite de peticiones y fallan todas a la vez.
  for (const ws of batch) {
    const result = await syncAccount(ws);
    if (result.error) report.failed.push(result);
    else report.synced.push(result);
  }

  return report;
}
