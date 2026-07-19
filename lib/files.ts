// Almacenamiento de archivos subidos (Banco de fuentes) con dos backends:
//   · Local: ./data/uploads/<id>_<nombre>
//   · Supabase Storage: bucket "uploads" (producción)
import fs from 'fs';
import path from 'path';
import { isSupabaseConfigured, supabaseAdmin } from './supabase';

const UPLOAD_DIR = path.join(process.cwd(), 'data', 'uploads');
const BUCKET = 'uploads';

export function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
}

export async function saveUpload(
  id: string,
  originalName: string,
  buffer: Buffer,
  mime: string
): Promise<void> {
  const stored = `${id}_${safeName(originalName)}`;
  if (isSupabaseConfigured()) {
    const { error } = await supabaseAdmin()
      .storage.from(BUCKET)
      .upload(stored, buffer, { contentType: mime || 'application/octet-stream' });
    if (error) throw new Error(`Storage (subir): ${error.message}`);
    return;
  }
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  fs.writeFileSync(path.join(UPLOAD_DIR, stored), buffer);
}

export async function findUpload(
  id: string
): Promise<{ name: string; buffer: Buffer } | null> {
  if (isSupabaseConfigured()) {
    const { data: list, error } = await supabaseAdmin()
      .storage.from(BUCKET)
      .list('', { search: `${id}_` });
    if (error || !list?.length) return null;
    const match = list.find((f) => f.name.startsWith(`${id}_`));
    if (!match) return null;
    const { data, error: dlError } = await supabaseAdmin()
      .storage.from(BUCKET)
      .download(match.name);
    if (dlError || !data) return null;
    return {
      name: match.name.slice(id.length + 1),
      buffer: Buffer.from(await data.arrayBuffer()),
    };
  }
  if (!fs.existsSync(UPLOAD_DIR)) return null;
  const match = fs.readdirSync(UPLOAD_DIR).find((f) => f.startsWith(`${id}_`));
  if (!match) return null;
  return {
    name: match.slice(id.length + 1),
    buffer: fs.readFileSync(path.join(UPLOAD_DIR, match)),
  };
}
