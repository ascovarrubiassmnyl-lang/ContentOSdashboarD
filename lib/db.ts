// Almacén de datos con dos backends intercambiables:
//   · Local (./data/*.json)  — desarrollo y modo demo, sin dependencias.
//   · Postgres (tabla app_store, jsonb por colección) — producción.
// La interfaz es la misma; el backend se elige según las variables de
// entorno. Todas las funciones son async para soportar ambos.
import fs from 'fs';
import path from 'path';
import { ensureSchema, isDbConfigured, pool } from './pg';

const DATA_DIR = path.join(process.cwd(), 'data');

// ── Backend local (archivos JSON) ───────────────────────────
function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function fileRead(name: string): unknown | null {
  ensureDir();
  const file = path.join(DATA_DIR, `${name}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return null;
  }
}

function fileWrite(name: string, value: unknown): void {
  ensureDir();
  fs.writeFileSync(
    path.join(DATA_DIR, `${name}.json`),
    JSON.stringify(value, null, 2),
    'utf-8'
  );
}

// ── Backend Postgres (tabla app_store: key text pk, value jsonb) ──
async function kvGet(name: string): Promise<unknown | null> {
  await ensureSchema();
  const { rows } = await pool().query<{ value: unknown }>(
    'SELECT value FROM app_store WHERE key = $1',
    [name]
  );
  return rows[0]?.value ?? null;
}

async function kvSet(name: string, value: unknown): Promise<void> {
  await ensureSchema();
  await pool().query(
    `INSERT INTO app_store (key, value, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [name, JSON.stringify(value)]
  );
}

// ── Interfaz pública (idéntica en ambos backends) ───────────
export async function readCollection<T>(name: string, fallback: T[] = []): Promise<T[]> {
  const raw = isDbConfigured() ? await kvGet(name) : fileRead(name);
  return Array.isArray(raw) ? (raw as T[]) : fallback;
}

export async function writeCollection<T>(name: string, rows: T[]): Promise<void> {
  if (isDbConfigured()) await kvSet(name, rows);
  else fileWrite(name, rows);
}

export async function readSingleton<T>(name: string): Promise<T | null> {
  const raw = isDbConfigured() ? await kvGet(name) : fileRead(name);
  return (raw as T) ?? null;
}

export async function writeSingleton<T>(name: string, value: T): Promise<void> {
  if (isDbConfigured()) await kvSet(name, value);
  else fileWrite(name, value);
}

// Borra una clave entera. Se usa al eliminar una cuenta: cada colección suya
// vive en su propia clave con namespace, así que basta con borrarlas.
export async function deleteKey(name: string): Promise<void> {
  if (isDbConfigured()) {
    await ensureSchema();
    await pool().query('DELETE FROM app_store WHERE key = $1', [name]);
    return;
  }
  ensureDir();
  const file = path.join(DATA_DIR, `${name}.json`);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}
