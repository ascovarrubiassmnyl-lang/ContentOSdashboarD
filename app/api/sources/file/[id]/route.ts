import { NextRequest, NextResponse } from 'next/server';
import { findUpload } from '@/lib/files';

const MIME: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  txt: 'text/plain; charset=utf-8',
  md: 'text/markdown; charset=utf-8',
  csv: 'text/csv; charset=utf-8',
  json: 'application/json',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[a-z0-9]+$/i.test(id)) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  }
  const file = await findUpload(id);
  if (!file) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return new NextResponse(new Uint8Array(file.buffer), {
    headers: {
      'content-type': MIME[ext] ?? 'application/octet-stream',
      'content-disposition': `inline; filename="${file.name}"`,
      'cache-control': 'private, max-age=3600',
    },
  });
}
