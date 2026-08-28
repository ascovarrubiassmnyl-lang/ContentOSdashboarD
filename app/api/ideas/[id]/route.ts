import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { readFor, writeFor } from '@/lib/accounts';
import { requireWorkspace } from '@/lib/session';
import { Idea } from '@/types';

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  text: z.string().min(2).max(400).optional(),
  status: z.enum(['pendiente', 'completada']).optional(),
  level: z.enum(['tofu', 'mofu', 'bofu']).optional(),
});

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const r = await requireWorkspace();
  if ('error' in r) return r.error;
  const ws = r.ws;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }
  const ideas = await readFor<Idea>(ws, 'ideas');
  const idx = ideas.findIndex((i) => i.id === id);
  if (idx === -1) return NextResponse.json({ error: 'No encontrada' }, { status: 404 });
  ideas[idx] = { ...ideas[idx], ...parsed.data, id };
  await writeFor(ws, 'ideas', ideas);
  return NextResponse.json({ idea: ideas[idx] });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const r = await requireWorkspace();
  if ('error' in r) return r.error;
  const ws = r.ws;
  const ideas = await readFor<Idea>(ws, 'ideas');
  await writeFor(
    ws,
    'ideas',
    ideas.filter((i) => i.id !== id)
  );
  return NextResponse.json({ ok: true });
}
