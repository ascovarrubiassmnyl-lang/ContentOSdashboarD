// Registro de cuentas (workspaces) — soporte multicuenta.
//
// Cada cuenta es una cuenta de Instagram conectada a través de una cuenta de
// Zernio (con su propia API key). Los datos de cada una viven en claves
// separadas del almacén: `ideas__acc_123`, `calendar_items__acc_123`, etc.
//
// La PRIMERA cuenta (la que ya existía antes del multicuenta) se marca como
// `legacy` y conserva las claves SIN sufijo (`ideas`, `calendar_items`…), de
// modo que los datos actuales de @scav_86 siguen exactamente donde estaban:
// no hay migración que pueda salir mal.
import { cookies } from 'next/headers';
import {
  deleteKey,
  readCollection,
  readSingleton,
  writeCollection,
  writeSingleton,
} from './db';
import { decryptSecret, encryptSecret, hasEncryptionKey } from './crypto';
import { isAuthEnabled } from './auth';
import { IgAccount } from '@/types';

export interface Workspace {
  id: string; // 'acc_<idZernio>'
  label: string; // nombre visible, editable por el usuario
  username: string; // @usuario de Instagram
  zernio_account_id: string | null; // _id de la cuenta dentro de Zernio
  color: string; // acento en el selector
  legacy?: boolean; // usa claves sin sufijo + ZERNIO_API_KEY del entorno
  followers: number;
  avatar_url: string | null;
  created_at: string;
  last_sync_at: string | null;
  // Dueño (uuid de Supabase Auth). `null` = todavía sin reclamar — solo pasa
  // con datos creados antes del login multiusuario (ver claimLegacyWorkspaces).
  owner_user_id: string | null;
}

const ACCOUNTS_KEY = 'accounts';
const SECRETS_KEY = 'account_secrets';
export const ACTIVE_COOKIE = 'co_account';

// Colecciones que pertenecen a una cuenta (se borran con ella).
export const SCOPED_COLLECTIONS = [
  'account',
  'media_posts',
  'metric_snapshots',
  'stories',
  'sources',
  'ideas',
  'calendar_items',
  'scripts',
  'reports',
] as const;

const PALETTE = ['#7C7CF5', '#F59E5B', '#F55C8A', '#4ED8A0', '#57B6F5', '#C77CF5'];

// ── Claves con namespace ────────────────────────────────────
export function collectionKey(ws: Workspace, name: string): string {
  return ws.legacy ? name : `${name}__${ws.id}`;
}

export async function readFor<T>(ws: Workspace, name: string): Promise<T[]> {
  return readCollection<T>(collectionKey(ws, name));
}

export async function writeFor<T>(ws: Workspace, name: string, rows: T[]): Promise<void> {
  await writeCollection<T>(collectionKey(ws, name), rows);
}

export async function readSingletonFor<T>(ws: Workspace, name: string): Promise<T | null> {
  return readSingleton<T>(collectionKey(ws, name));
}

export async function writeSingletonFor<T>(
  ws: Workspace,
  name: string,
  value: T
): Promise<void> {
  await writeSingleton<T>(collectionKey(ws, name), value);
}

// ── Registro ────────────────────────────────────────────────
export async function listAccounts(): Promise<Workspace[]> {
  const rows = await readCollection<Workspace>(ACCOUNTS_KEY);
  if (rows.length > 0) return rows;
  const legacy = await bootstrapLegacy();
  return legacy ? [legacy] : [];
}

// La primera vez que corre el código multicuenta, convierte la instalación
// existente en la cuenta #1 sin mover un solo dato.
async function bootstrapLegacy(): Promise<Workspace | null> {
  const existing = await readSingleton<IgAccount>('account');
  const ws: Workspace = {
    id: existing?.id ?? 'acc_principal',
    label: existing?.username ? `@${existing.username}` : 'Cuenta principal',
    username: existing?.username ?? '',
    zernio_account_id: existing?.ig_user_id ?? null,
    color: PALETTE[0],
    legacy: true,
    followers: 0,
    avatar_url: null,
    created_at: existing?.last_sync_at ?? new Date().toISOString(),
    last_sync_at: existing?.last_sync_at ?? null,
    // Sin login real (modo demo local) no hay nadie que la reclame: queda
    // directo del único usuario fijo del modo demo. Con login real, queda
    // sin dueño hasta que LEGACY_OWNER_EMAIL la reclame (ver claimLegacyWorkspaces).
    owner_user_id: isAuthEnabled() ? null : 'local-dev',
  };
  await writeCollection<Workspace>(ACCOUNTS_KEY, [ws]);
  return ws;
}

export async function getAccount(id: string): Promise<Workspace | null> {
  return (await listAccounts()).find((w) => w.id === id) ?? null;
}

// ── Por usuario (aislamiento multiusuario) ─────────────────
// Sin login (modo demo local) las cuentas sin dueño son del único usuario que
// existe: así una instalación local que ya tenía datos sigue viéndolos. Con
// login real, una cuenta sin dueño no es de nadie hasta que la reclamen.
function owns(w: Workspace, userId: string): boolean {
  if (w.owner_user_id) return w.owner_user_id === userId;
  return !isAuthEnabled();
}

export async function listAccountsForUser(userId: string): Promise<Workspace[]> {
  return (await listAccounts()).filter((w) => owns(w, userId));
}

// Igual que getAccount, pero exige que la cuenta sea del usuario. Devuelve
// null tanto si no existe como si es de otro usuario — a propósito: así
// ninguna ruta puede usar el mensaje de error para adivinar ids ajenos.
export async function getAccountForUser(
  id: string,
  userId: string
): Promise<Workspace | null> {
  const ws = await getAccount(id);
  return ws && owns(ws, userId) ? ws : null;
}

export async function saveAccounts(rows: Workspace[]): Promise<void> {
  await writeCollection<Workspace>(ACCOUNTS_KEY, rows);
}

export async function updateAccount(
  id: string,
  patch: Partial<Omit<Workspace, 'id' | 'legacy'>>
): Promise<Workspace | null> {
  const rows = await listAccounts();
  const idx = rows.findIndex((w) => w.id === id);
  if (idx === -1) return null;
  rows[idx] = { ...rows[idx], ...patch };
  await saveAccounts(rows);
  return rows[idx];
}

export async function createAccount(input: {
  zernioAccountId: string;
  username: string;
  label?: string;
  followers?: number;
  avatarUrl?: string | null;
  apiKey: string;
  ownerUserId: string;
}): Promise<Workspace> {
  const rows = await listAccounts();
  const id = `acc_${input.zernioAccountId}`;
  if (rows.some((w) => w.id === id)) {
    throw new Error(`La cuenta @${input.username} ya está añadida.`);
  }
  const ws: Workspace = {
    id,
    label: input.label?.trim() || `@${input.username}`,
    username: input.username,
    zernio_account_id: input.zernioAccountId,
    color: PALETTE[rows.length % PALETTE.length],
    followers: input.followers ?? 0,
    avatar_url: input.avatarUrl ?? null,
    created_at: new Date().toISOString(),
    last_sync_at: null,
    owner_user_id: input.ownerUserId,
  };
  await setZernioKey(id, input.apiKey);
  await saveAccounts([...rows, ws]);
  return ws;
}

export async function deleteAccount(id: string, userId: string): Promise<void> {
  const rows = await listAccounts();
  // La regla es "no te quedes sin ninguna cuenta", así que cuenta las TUYAS.
  // Contando todas las del sistema, un usuario con una sola cuenta podía
  // borrarla en cuanto otro usuario tuviera las suyas.
  if (rows.filter((w) => owns(w, userId)).length <= 1) {
    throw new Error('No puedes eliminar la única cuenta que queda.');
  }
  const ws = rows.find((w) => w.id === id);
  if (!ws) throw new Error('Cuenta no encontrada.');

  // Todos los datos de esa cuenta.
  for (const name of SCOPED_COLLECTIONS) {
    await deleteKey(collectionKey(ws, name));
  }
  const secrets = await readSecrets();
  delete secrets[id];
  await writeSingleton(SECRETS_KEY, secrets);
  await saveAccounts(rows.filter((w) => w.id !== id));
}

// ── Cuenta activa (cookie) ──────────────────────────────────
// Resuelve solo entre las cuentas del usuario: una cookie con el id de la
// cuenta de otro usuario ya no puede "colarse" (era el bug de aislamiento).
export async function activeWorkspace(userId: string): Promise<Workspace> {
  const mine = await listAccountsForUser(userId);
  if (mine.length === 0) {
    throw new Error('SIN_WORKSPACE');
  }
  let selected: string | undefined;
  try {
    selected = (await cookies()).get(ACTIVE_COOKIE)?.value;
  } catch {
    // fuera de contexto de petición — cae a la primera cuenta
  }
  return mine.find((w) => w.id === selected) ?? mine[0];
}

// ── Secretos (API keys de Zernio, cifradas en reposo) ───────
type SecretMap = Record<string, string>;

async function readSecrets(): Promise<SecretMap> {
  return (await readSingleton<SecretMap>(SECRETS_KEY)) ?? {};
}

export async function setZernioKey(accountId: string, apiKey: string): Promise<void> {
  if (!hasEncryptionKey()) {
    throw new Error(
      'Falta ENCRYPTION_KEY en el servidor: sin ella no se pueden guardar las API keys de Zernio de forma segura.'
    );
  }
  const secrets = await readSecrets();
  secrets[accountId] = await encryptSecret(apiKey.trim());
  await writeSingleton(SECRETS_KEY, secrets);
}

// Devuelve la key de Zernio de una cuenta: la guardada (descifrada) o, para la
// cuenta legacy sin key propia, la del entorno.
export async function getZernioKey(ws: Workspace): Promise<string | null> {
  const secrets = await readSecrets();
  const blob = secrets[ws.id];
  if (blob) {
    // Falta la variable y "no coincide la variable" son problemas distintos y
    // se arreglan distinto: merece la pena decir cuál de los dos es.
    if (!hasEncryptionKey()) {
      throw new Error(
        `Este servidor no tiene ENCRYPTION_KEY, así que no puede leer la API key guardada de ${ws.label}. ` +
          'Añádela a las variables de entorno del servidor (la MISMA con la que se guardó la key) y vuelve a desplegar.'
      );
    }
    try {
      return await decryptSecret(blob);
    } catch {
      throw new Error(
        `La ENCRYPTION_KEY de este servidor no es la que cifró la API key de ${ws.label}. ` +
          'Pon la key original, o vuelve a pegar la API key de Zernio desde Conexión para regrabarla con la actual.'
      );
    }
  }
  if (ws.legacy && process.env.ZERNIO_API_KEY) return process.env.ZERNIO_API_KEY;
  return null;
}

export type KeyState = 'stored' | 'env' | 'none';

export async function zernioKeyState(ws: Workspace): Promise<KeyState> {
  const secrets = await readSecrets();
  if (secrets[ws.id]) return 'stored';
  if (ws.legacy && process.env.ZERNIO_API_KEY) return 'env';
  return 'none';
}

export async function hasZernioFor(ws: Workspace): Promise<boolean> {
  return (await zernioKeyState(ws)) !== 'none';
}
