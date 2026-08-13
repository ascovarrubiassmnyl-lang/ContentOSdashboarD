import { NextRequest, NextResponse } from 'next/server';
import { uid } from '@/lib/db';
import { activeWorkspace, readFor, writeFor } from '@/lib/accounts';
import { seedIfNeeded } from '@/lib/mock';
import { extractText } from '@/lib/extract';
import { saveUpload } from '@/lib/files';
import { Source, SourceType } from '@/types';

const MAX_SIZE = 15 * 1024 * 1024; // 15 MB
const VALID_TYPES: SourceType[] = [
  'transcripcion',
  'dm',
  'llamada',
  'comentario',
  'objecion',
  'documento',
];

export async function POST(req: NextRequest) {
  const ws = await activeWorkspace();
  await seedIfNeeded(ws);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Se esperaba multipart/form-data' }, { status: 400 });
  }

  // En Node 18 `File` no es global; se valida por forma (Blob-like con name).
  const raw = form.get('file');
  if (!raw || typeof raw === 'string' || typeof raw.arrayBuffer !== 'function') {
    return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 });
  }
  const file = raw as Blob & { name?: string };
  const fileName = file.name || 'archivo';
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: `El archivo supera el límite de ${MAX_SIZE / 1024 / 1024} MB` },
      { status: 413 }
    );
  }

  const type = (form.get('type') as SourceType) || 'documento';
  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: 'Tipo de fuente inválido' }, { status: 400 });
  }
  const titleInput = (form.get('title') as string) || '';
  const tagsInput = (form.get('tags') as string) || '';

  const buffer = Buffer.from(await file.arrayBuffer());

  // Guarda el archivo (local o Supabase Storage según configuración)
  const id = uid();
  await saveUpload(id, fileName, buffer, file.type);

  // Extrae el texto para que el generador lo use como contexto
  const { text, note } = await extractText(buffer, fileName, file.type);

  const source: Source = {
    id,
    account_id: ws.id,
    type,
    title: titleInput.trim() || fileName,
    content: text,
    file_url: `/api/sources/file/${id}`,
    file_name: fileName,
    file_mime: file.type || null,
    file_size: file.size,
    extract_note: note ?? null,
    tags: tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
    created_at: new Date().toISOString(),
  };

  const sources = await readFor<Source>(ws, 'sources');
  sources.unshift(source);
  await writeFor(ws, 'sources', sources);

  return NextResponse.json({ source }, { status: 201 });
}
