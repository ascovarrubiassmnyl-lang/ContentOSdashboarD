// Registro de cuentas (workspaces) — soporte multicuenta.
//
// Cada cuenta es una cuenta de Instagram o una Página de Facebook conectada a
// través de una cuenta de Zernio (con su propia API key). Los datos de cada una
// viven en claves separadas del almacén: `ideas__acc_123`, etc.
//
// La PRIMERA cuenta (la que ya existía antes del multicuenta) se marca como
// `legacy` y conserva las claves SIN sufijo (`ideas`, `calendar_items`…), de
// modo que los datos que ya estaban siguen exactamente donde estaban: no hay
// migración que pueda salir mal.
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

// Redes que ContentOS sabe analizar. Zernio conecta muchas más, pero el resto
// (anuncios, mensajería…) no encaja en este dashboard.
export const PLATFORMS = ['instagram', 'facebook', 'tiktok'] as const;
export type Platform = (typeof PLATFORMS)[number];

export function isPlatform(v: unknown): v is Platform {
  return typeof v === 'string' && (PLATFORMS as readonly string[]).includes(v);
}

export interface Workspace {
  id: string; // 'acc_<idZernio>'
  label: string; // nombre visible, editable por el usuario
  username: string; // @usuario de Instagram, o nombre de la Página de Facebook
  zernio_account_id: string | null; // _id de la cuenta dentro de Zernio
  color: string; // acento en el selector
  legacy?: boolean; // usa claves sin sufijo + ZERNIO_API_KEY del entorno
  // Opcional porque las cuentas creadas antes del soporte de Facebook no lo
  // traen; leerlas con accountPlatform() las trata como Instagram.
  platform?: Platform;
  followers: number;
  avatar_url: string | null;
  created_at: string;
  last_sync_at: string | null;
  // Dueño: el id del usuario en lib/users.ts. `null` = sin dueño; solo pasa con
  // datos creados antes del login multiusuario, y con auth activa no son de
  // nadie (ver owns()).
  owner_user_id: string | null;
}

export function accountPlatform(ws: Workspace): Platform {
  return isPlatform(ws.platform) ? ws.platform : 'instagram';
}

// Etiqueta que ContentOS genera sola a partir del nombre de usuario. La arroba
// es de Instagram y TikTok: una Página de Facebook se llama por su nombre. Se
// usa en dos sitios — al crear la cuenta, y en cada sync para distinguir una
// etiqueta automática (refrescable) de un nombre que puso el usuario a mano
// (intocable).
export function autoLabel(username: string, platform: Platform): string {
  return platform === 'facebook' ? username : `@${username}`;
}

const ACCOUNTS_KEY = 'accounts';
const SECRETS_KEY = 'account_secrets';
// Marca de que el arranque legacy YA se hizo alguna vez. Sin ella, un registro
// de cuentas vacío era indistinguible de una instalación anterior al
// multicuenta, y bootstrapLegacy() volvía a crear una cuenta fantasma cada vez
// que el usuario vaciaba el panel: se desconectaba todo y las cuentas
// reaparecían solas en la siguiente lectura.
const BOOTSTRAP_KEY = 'accounts_bootstrapped';
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
  'calendar_plans',
  'scripts',
  'reports',
  'agent_threads',
  'agent_messages',
  'agent_audit_log',
  'agent_settings',
  'competitors',
  'competitor_snapshots',
  'brand_memory',
  'notifications',
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
  // Registro vacío: o es una instalación anterior al multicuenta (hay datos que
  // adoptar) o es un panel que el usuario acaba de vaciar (no hay que
  // resucitar nada). El marcador distingue los dos casos.
  if (await readSingleton<{ done: boolean }>(BOOTSTRAP_KEY)) return [];
  const legacy = await bootstrapLegacy();
  return legacy ? [legacy] : [];
}

// La primera vez que corre el código multicuenta, convierte la instalación
// existente en la cuenta #1 sin mover un solo dato. Solo la PRIMERA vez: al
// terminar deja el marcador puesto, pase lo que pase.
async function bootstrapLegacy(): Promise<Workspace | null> {
  const existing = await readSingleton<IgAccount>('account');
  await writeSingleton(BOOTSTRAP_KEY, { done: true, at: new Date().toISOString() });
  // Instalación nueva y limpia: no hay datos previos que adoptar. Crear una
  // cuenta vacía aquí era lo que llenaba de fantasmas el panel; el usuario
  // añade la suya desde /conexion.
  if (!existing) return null;
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
    // Sin login real (modo demo local) es del único usuario fijo del modo demo.
    // Con login real nace sin dueño, y una cuenta sin dueño no es de nadie: así
    // un usuario nuevo no hereda por accidente los datos de otro.
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
  platform?: Platform;
  label?: string;
  followers?: number;
  avatarUrl?: string | null;
  apiKey: string;
  ownerUserId: string;
}): Promise<Workspace> {
  const rows = await listAccounts();
  const id = `acc_${input.zernioAccountId}`;
  const platform: Platform = isPlatform(input.platform) ? input.platform : 'instagram';
  // "Ya la tienes tú" y "la tiene otro usuario" se arreglan de formas muy
  // distintas, y un mensaje único dejaba al usuario sin saber qué hacer.
  const clash = rows.find((w) => w.id === id);
  if (clash) {
    if (clash.owner_user_id === input.ownerUserId) {
      throw new Error(
        `La cuenta ${input.username} ya está en tu panel como "${clash.label}". ` +
          'No hace falta volver a añadirla: usa "Sincronizar ahora" para traer sus datos actuales, ' +
          'o elimínala primero si quieres empezar de cero.'
      );
    }
    throw new Error(
      `La cuenta ${input.username} ya está añadida en ContentOS, pero bajo OTRO usuario ` +
        `(aparece como "${clash.label}"). Una misma cuenta de Zernio no puede estar en dos ` +
        'paneles a la vez: el usuario que la tenga debe eliminarla antes de que la añadas aquí.'
    );
  }
  const ws: Workspace = {
    id,
    label: input.label?.trim() || autoLabel(input.username, platform),
    username: input.username,
    zernio_account_id: input.zernioAccountId,
    color: PALETTE[rows.length % PALETTE.length],
    platform,
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

// Desconecta una cuenta: la saca del registro y borra TODOS sus datos y su API
// key. Se puede desconectar también la última que queda — el panel tiene que
// poder quedar vacío; antes se bloqueaba y por eso "Desconectar" no limpiaba
// nada cuando solo había una cuenta.
export async function deleteAccount(id: string, userId: string): Promise<void> {
  const rows = await listAccounts();
  const ws = rows.find((w) => w.id === id && owns(w, userId));
  if (!ws) throw new Error('Cuenta no encontrada.');

  // Todos los datos de esa cuenta.
  for (const name of SCOPED_COLLECTIONS) {
    await deleteKey(collectionKey(ws, name));
  }
  const secrets = await readSecrets();
  delete secrets[id];
  await writeSingleton(SECRETS_KEY, secrets);
  await saveAccounts(rows.filter((w) => w.id !== id));
  await forgetActiveCookie(id);
}

// Desconecta TODAS las cuentas del usuario de una vez: deja el panel de
// integraciones completamente limpio. Devuelve cuántas se desconectaron.
export async function deleteAllAccountsForUser(userId: string): Promise<number> {
  const mine = await listAccountsForUser(userId);
  for (const ws of mine) {
    await deleteAccount(ws.id, userId);
  }
  return mine.length;
}

// La cookie de cuenta activa no puede seguir apuntando a una cuenta que ya no
// existe: activeWorkspace() cae a la primera del usuario, pero dejarla puesta
// hacía que al añadir una cuenta nueva con el mismo id reapareciera "activa"
// una selección vieja.
async function forgetActiveCookie(deletedId: string): Promise<void> {
  try {
    const jar = await cookies();
    if (jar.get(ACTIVE_COOKIE)?.value === deletedId) jar.delete(ACTIVE_COOKIE);
  } catch {
    // fuera de contexto de petición (cron) — no hay cookie que limpiar
  }
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
