// Almacén de binarios (videos e imágenes de las piezas del calendario).
//
// Hermano de lib/db.ts y con los mismos dos backends, para que la app siga
// funcionando igual en local y en Railway:
//   · Local     → ./data/media/<clave>.bin  +  <clave>.json con los metadatos
//   · Postgres  → tabla app_media (bytea), creada por ensureSchema()
//
// Por qué no reusar lib/db.ts: ahí todo es jsonb y se lee la colección entera
// en cada consulta. Un video en base64 dentro de esa tabla haría lenta cada
// lectura del calendario, además de inflarlo un 33 %.
//
// Los binarios son temporales por diseño: ContentOS guarda el archivo solo
// hasta que Zernio lo publica (ver lib/publish.ts). Nada de esto es una
// videoteca.
import fs from 'fs';
import path from 'path';
import { ensureSchema, isDbConfigured, pool } from '../pg';
import { uid } from '../db';

const MEDIA_DIR = path.join(process.cwd(), 'data', 'media');

export interface StoredMedia {
  key: string;
  filename: string;
  mime: string;
  size: number;
  created_at: string;
}

// Tope de subida. Instagram acepta 300 MB en feed/reels y 100 MB en historias;
// el límite de aquí es el del servidor, que tiene que sostener el archivo en
// memoria mientras lo recibe.
export function maxUploadBytes(): number {
  const mb = Number(process.env.MAX_UPLOAD_MB);
  const safe = Number.isFinite(mb) && mb > 0 ? Math.min(mb, 500) : 200;
  return safe * 1024 * 1024;
}

// Tipos que Zernio acepta y que además sirven para publicar en Instagram o
// Facebook. Se valida aquí y no en la ruta para que el cron y la app compartan
// la misma regla.
const VIDEO_MIME = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'];
const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'];

export function mediaKind(mime: string): 'video' | 'image' | null {
  const m = mime.split(';')[0].trim().toLowerCase();
  if (VIDEO_MIME.includes(m)) return 'video';
  if (IMAGE_MIME.includes(m)) return 'image';
  return null;
}

export function acceptedMimes(): string[] {
  return [...VIDEO_MIME, ...IMAGE_MIME];
}

// ── Backend local ───────────────────────────────────────────
function ensureDir() {
  if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true });
}

// La clave la genera esta capa (nunca el cliente), así que no puede contener
// separadores de ruta. Aun así se comprueba: es la única defensa entre un
// parámetro de URL y el sistema de archivos.
function safeKey(key: string): string {
  if (!/^med_[A-Za-z0-9]+$/.test(key)) throw new Error('Clave de archivo inválida.');
  return key;
}

// ── Interfaz pública ────────────────────────────────────────
export async function putMedia(
  bytes: Buffer,
  meta: { filename: string; mime: string }
): Promise<StoredMedia> {
  const stored: StoredMedia = {
    key: 'med_' + uid(),
    // Nombre solo informativo (se enseña en la interfaz y viaja al presign de
    // Zernio); se limpia de rutas y se acorta.
    filename: (meta.filename.split(/[\\/]/).pop() || 'archivo').slice(0, 120),
    mime: meta.mime.split(';')[0].trim().toLowerCase(),
    size: bytes.byteLength,
    created_at: new Date().toISOString(),
  };

  if (isDbConfigured()) {
    await ensureSchema();
    await pool().query(
      `INSERT INTO app_media (key, filename, mime, size, bytes)
       VALUES ($1, $2, $3, $4, $5)`,
      [stored.key, stored.filename, stored.mime, stored.size, bytes]
    );
    return stored;
  }

  ensureDir();
  fs.writeFileSync(path.join(MEDIA_DIR, `${stored.key}.bin`), bytes);
  fs.writeFileSync(
    path.join(MEDIA_DIR, `${stored.key}.json`),
    JSON.stringify(stored, null, 2),
    'utf-8'
  );
  return stored;
}

export async function getMediaMeta(key: string): Promise<StoredMedia | null> {
  safeKey(key);
  if (isDbConfigured()) {
    await ensureSchema();
    const { rows } = await pool().query<{
      key: string;
      filename: string;
      mime: string;
      size: string;
      created_at: Date;
    }>('SELECT key, filename, mime, size, created_at FROM app_media WHERE key = $1', [key]);
    const r = rows[0];
    if (!r) return null;
    return {
      key: r.key,
      filename: r.filename,
      mime: r.mime,
      // bigint llega como cadena por el driver de pg.
      size: Number(r.size),
      created_at: new Date(r.created_at).toISOString(),
    };
  }
  const file = path.join(MEDIA_DIR, `${key}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as StoredMedia;
  } catch {
    return null;
  }
}

export async function getMediaBytes(key: string): Promise<Buffer | null> {
  safeKey(key);
  if (isDbConfigured()) {
    await ensureSchema();
    const { rows } = await pool().query<{ bytes: Buffer }>(
      'SELECT bytes FROM app_media WHERE key = $1',
      [key]
    );
    return rows[0]?.bytes ?? null;
  }
  const file = path.join(MEDIA_DIR, `${key}.bin`);
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file);
}

// Todas las claves guardadas. La usa la purga del cron para encontrar
// binarios huérfanos: archivos cuya pieza del calendario ya no existe (se
// borró, caducó, o se cambió el archivo). Sin esto el almacén solo crece.
export async function listMediaKeys(): Promise<{ key: string; created_at: string }[]> {
  if (isDbConfigured()) {
    await ensureSchema();
    const { rows } = await pool().query<{ key: string; created_at: Date }>(
      'SELECT key, created_at FROM app_media'
    );
    return rows.map((r) => ({ key: r.key, created_at: new Date(r.created_at).toISOString() }));
  }
  if (!fs.existsSync(MEDIA_DIR)) return [];
  const out: { key: string; created_at: string }[] = [];
  for (const name of fs.readdirSync(MEDIA_DIR)) {
    if (!name.endsWith('.json')) continue;
    const key = name.slice(0, -5);
    const meta = await getMediaMeta(key);
    if (meta) out.push({ key, created_at: meta.created_at });
  }
  return out;
}

// Idempotente: borrar algo que ya no está no es un error. Se llama desde
// sitios que no pueden saber si el archivo sigue ahí (purga del cron,
// borrado de una pieza que nunca tuvo archivo).
export async function deleteMedia(key: string): Promise<void> {
  try {
    safeKey(key);
  } catch {
    return;
  }
  if (isDbConfigured()) {
    await ensureSchema();
    await pool().query('DELETE FROM app_media WHERE key = $1', [key]);
    return;
  }
  for (const ext of ['bin', 'json']) {
    const file = path.join(MEDIA_DIR, `${key}.${ext}`);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
}
