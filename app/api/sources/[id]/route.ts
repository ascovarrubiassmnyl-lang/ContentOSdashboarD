import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { activeWorkspace, readFor, writeFor } from '@/lib/accounts';
import { Source } from '@/types';

type Ctx = { params: Promise<{ id: string }> };

// Patch parcial validado; los campos de archivo (file_*) no se tocan por
// esta vía — solo los define la subida.
const patchSchema = z
  .object({
    type: z.enum(['transcripcion', 'dm', 'llamada', 'comentario', 'objecion', 'documento']),
    title: z.string().min(3).max(160),
    content: z.string().min(1).max(200_000),
    tags: z.array(z.string().max(40)).max(20),
  })
  .partial();

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const ws = await activeWorkspace();
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos', issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const sources = await readFor<Source>(ws, 'sources');
  const idx = sources.findIndex((s) => s.id === id);
  if (idx === -1) return NextResponse.json({ error: 'No encontrada' }, { status: 404 });
  sources[idx] = { ...sources[idx], ...parsed.data, id };
  await writeFor(ws, 'sources', sources);
  return NextResponse.json({ source: sources[idx] });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const ws = await activeWorkspace();
  const sources = await readFor<Source>(ws, 'sources');
  await writeFor(
    ws,
    'sources',
    sources.filter((s) => s.id !== id)
  );
  return NextResponse.json({ ok: true });
}
