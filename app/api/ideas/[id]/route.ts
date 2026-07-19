import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { readCollection, writeCollection } from '@/lib/db';
import { Idea } from '@/types';

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  text: z.string().min(2).max(400).optional(),
  status: z.enum(['pendiente', 'completada']).optional(),
  level: z.enum(['tofu', 'mofu', 'bofu']).optional(),
});

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }
  const ideas = await readCollection<Idea>('ideas');
  const idx = ideas.findIndex((i) => i.id === id);
  if (idx === -1) return NextResponse.json({ error: 'No encontrada' }, { status: 404 });
  ideas[idx] = { ...ideas[idx], ...parsed.data, id };
  await writeCollection('ideas', ideas);
  return NextResponse.json({ idea: ideas[idx] });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const ideas = await readCollection<Idea>('ideas');
  await writeCollection(
    'ideas',
    ideas.filter((i) => i.id !== id)
  );
  return NextResponse.json({ ok: true });
}
