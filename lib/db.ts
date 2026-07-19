// Almacén de datos con dos backends intercambiables:
//   · Local (./data/*.json)  — desarrollo y modo demo, sin dependencias.
//   · Supabase (tabla app_store, jsonb por colección) — producción.
// La interfaz es la misma; el backend se elige según las variables de
// entorno. Todas las funciones son async para soportar ambos.
import fs from 'fs';
import path from 'path';
import { isSupabaseConfigured, supabaseAdmin } from './supabase';

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

// ── Backend Supabase (tabla app_store: key text pk, value jsonb) ──
async function kvGet(name: string): Promise<unknown | null> {
  const { data, error } = await supabaseAdmin()
    .from('app_store')
    .select('value')
    .eq('key', name)
    .maybeSingle();
  if (error) throw new Error(`Supabase (leer ${name}): ${error.message}`);
  return data?.value ?? null;
}

async function kvSet(name: string, value: unknown): Promise<void> {
  const { error } = await supabaseAdmin()
    .from('app_store')
    .upsert({ key: name, value, updated_at: new Date().toISOString() });
  if (error) throw new Error(`Supabase (guardar ${name}): ${error.message}`);
}

// ── Interfaz pública (idéntica en ambos backends) ───────────
export async function readCollection<T>(name: string, fallback: T[] = []): Promise<T[]> {
  const raw = isSupabaseConfigured() ? await kvGet(name) : fileRead(name);
  return Array.isArray(raw) ? (raw as T[]) : fallback;
}

export async function writeCollection<T>(name: string, rows: T[]): Promise<void> {
  if (isSupabaseConfigured()) await kvSet(name, rows);
  else fileWrite(name, rows);
}

export async function readSingleton<T>(name: string): Promise<T | null> {
  const raw = isSupabaseConfigured() ? await kvGet(name) : fileRead(name);
  return (raw as T) ?? null;
}

export async function writeSingleton<T>(name: string, value: T): Promise<void> {
  if (isSupabaseConfigured()) await kvSet(name, value);
  else fileWrite(name, value);
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}
