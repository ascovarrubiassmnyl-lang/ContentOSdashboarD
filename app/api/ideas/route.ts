import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { uid } from '@/lib/db';
import { activeWorkspace, readFor, writeFor } from '@/lib/accounts';
import { seedIfNeeded } from '@/lib/mock';
import { Idea } from '@/types';

const ideaSchema = z.object({
  level: z.enum(['tofu', 'mofu', 'bofu']),
  text: z.string().min(2).max(400),
});

export async function GET() {
  const ws = await activeWorkspace();
  await seedIfNeeded(ws);
  const ideas = (await readFor<Idea>(ws, 'ideas')).sort((a, b) =>
    b.created_at.localeCompare(a.created_at)
  );
  return NextResponse.json({ ideas });
}

export async function POST(req: NextRequest) {
  const ws = await activeWorkspace();
  await seedIfNeeded(ws);
  const parsed = ideaSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos', issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const idea: Idea = {
    id: uid(),
    account_id: ws.id,
    level: parsed.data.level,
    text: parsed.data.text.trim(),
    status: 'pendiente',
    created_at: new Date().toISOString(),
  };
  const ideas = await readFor<Idea>(ws, 'ideas');
  ideas.unshift(idea);
  await writeFor(ws, 'ideas', ideas);
  return NextResponse.json({ idea }, { status: 201 });
}
