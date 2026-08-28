// Registro de usuarios de la app.
//
// La identidad es el CORREO: Google y usuario/contraseña son dos puertas a la
// misma fila. Sin esto, entrar con contraseña te daría un id distinto al de
// Google y verías un panel vacío aunque seas la misma persona.
//
// Detalle que evita migrar datos: cuando la fila nace desde Google, su `id`
// ES el `sub` de Google. Los workspaces creados antes de que existiera este
// registro ya guardan ese `sub` en `owner_user_id`, así que siguen apuntando
// a su dueño sin tocar un solo registro.
import { readCollection, uid, writeCollection } from './db';
import { hashPassword, verifyPassword } from './password';

export interface AppUser {
  id: string;
  email: string; // siempre en minúsculas — es la clave de identidad
  name: string;
  password_hash: string | null; // null = solo entra con Google
  google_sub: string | null; // null = solo entra con contraseña
  avatar_url: string | null;
  created_at: string;
}

const USERS_KEY = 'users';

// Nota: como en el resto de la app, cada colección es una sola clave del
// almacén y se reescribe entera. Dos altas exactamente simultáneas del mismo
// correo podrían pisarse; a esta escala no compensa añadir bloqueos.
async function listUsers(): Promise<AppUser[]> {
  return readCollection<AppUser>(USERS_KEY);
}

async function saveUsers(rows: AppUser[]): Promise<void> {
  await writeCollection<AppUser>(USERS_KEY, rows);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function findUserByEmail(email: string): Promise<AppUser | null> {
  const wanted = normalizeEmail(email);
  return (await listUsers()).find((u) => u.email === wanted) ?? null;
}

export async function findUserById(id: string): Promise<AppUser | null> {
  return (await listUsers()).find((u) => u.id === id) ?? null;
}

// ── Alta con contraseña ─────────────────────────────────────
export class RegistrationError extends Error {}

export async function registerUser(input: {
  email: string;
  name: string;
  password: string;
}): Promise<AppUser> {
  const email = normalizeEmail(input.email);
  const rows = await listUsers();
  const existing = rows.find((u) => u.email === email);

  if (existing?.password_hash) {
    throw new RegistrationError('Ya hay una cuenta con ese correo. Inicia sesión.');
  }
  if (existing) {
    // Existe, pero solo con Google. Dejar que cualquiera "complete" esa cuenta
    // poniéndole contraseña sería secuestrarla sabiendo únicamente el correo.
    throw new RegistrationError(
      'Ese correo ya entra con Google. Inicia sesión con Google y define tu contraseña desde Cuenta.'
    );
  }

  const user: AppUser = {
    id: `usr_${uid()}`,
    email,
    name: input.name.trim() || email.split('@')[0],
    password_hash: await hashPassword(input.password),
    google_sub: null,
    avatar_url: null,
    created_at: new Date().toISOString(),
  };
  await saveUsers([...rows, user]);
  return user;
}

// ── Verificación de credenciales ────────────────────────────
export async function verifyCredentials(
  email: string,
  password: string
): Promise<AppUser | null> {
  const user = await findUserByEmail(email);
  if (!user?.password_hash) return null;
  return (await verifyPassword(password, user.password_hash)) ? user : null;
}

// Define o cambia la contraseña de un usuario ya autenticado. `currentPassword`
// solo se exige si ya tenía una: quien entró con Google todavía no tiene ninguna
// y necesita poder ponerse la primera.
export async function setPassword(
  userId: string,
  newPassword: string,
  currentPassword?: string
): Promise<void> {
  const rows = await listUsers();
  const idx = rows.findIndex((u) => u.id === userId);
  if (idx === -1) throw new RegistrationError('Usuario no encontrado.');

  const user = rows[idx];
  if (user.password_hash) {
    if (!currentPassword) {
      throw new RegistrationError('Escribe tu contraseña actual.');
    }
    if (!(await verifyPassword(currentPassword, user.password_hash))) {
      throw new RegistrationError('La contraseña actual no es correcta.');
    }
  }
  rows[idx] = { ...user, password_hash: await hashPassword(newPassword) };
  await saveUsers(rows);
}

// ── Entrada por Google ──────────────────────────────────────
// Busca primero por `sub` (inmutable) y luego por correo, para enlazar con una
// cuenta de contraseña que ya existiera. Los correos de Google vienen
// verificados, así que enlazar por correo no permite suplantar a nadie.
export async function upsertGoogleUser(input: {
  sub: string;
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
}): Promise<AppUser> {
  const email = normalizeEmail(input.email);
  const rows = await listUsers();
  const idx = rows.findIndex((u) => u.google_sub === input.sub || u.email === email);

  if (idx !== -1) {
    rows[idx] = {
      ...rows[idx],
      google_sub: input.sub,
      name: rows[idx].name || input.name?.trim() || email.split('@')[0],
      avatar_url: input.avatarUrl ?? rows[idx].avatar_url,
    };
    await saveUsers(rows);
    return rows[idx];
  }

  const user: AppUser = {
    // El id ES el `sub`: así los workspaces creados antes de este registro
    // conservan a su dueño sin migración.
    id: input.sub,
    email,
    name: input.name?.trim() || email.split('@')[0],
    password_hash: null,
    google_sub: input.sub,
    avatar_url: input.avatarUrl ?? null,
    created_at: new Date().toISOString(),
  };
  await saveUsers([...rows, user]);
  return user;
}
