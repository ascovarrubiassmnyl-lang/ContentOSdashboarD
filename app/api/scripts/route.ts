import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { uid } from '@/lib/db';
import { activeWorkspace, readFor, writeFor } from '@/lib/accounts';
import { seedIfNeeded } from '@/lib/mock';
import { Script } from '@/types';

const scriptSchema = z.object({
  title: z.string().min(3),
  hook: z.string().min(3),
  body: z.string().min(10),
  cta: z.string().min(3),
  format: z.enum(['reel', 'carrusel', 'historia']),
  source_ids: z.array(z.string()).default([]),
  metrics_context: z.record(z.unknown()).nullable().default(null),
  justification: z.string().default(''),
  status: z.enum(['borrador', 'aprobado', 'publicado']).default('borrador'),
  score: z.number().min(0).max(100).default(0),
});

export async function GET() {
  const ws = await activeWorkspace();
  await seedIfNeeded(ws);
  const scripts = (await readFor<Script>(ws, 'scripts')).sort((a, b) =>
    b.created_at.localeCompare(a.created_at)
  );
  return NextResponse.json({ scripts });
}

export async function POST(req: NextRequest) {
  const ws = await activeWorkspace();
  await seedIfNeeded(ws);
  const parsed = scriptSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos', issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const script: Script = {
    id: uid(),
    account_id: ws.id,
    ...parsed.data,
    created_at: new Date().toISOString(),
  };
  const scripts = await readFor<Script>(ws, 'scripts');
  scripts.unshift(script);
  await writeFor(ws, 'scripts', scripts);
  return NextResponse.json({ script }, { status: 201 });
}
