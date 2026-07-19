import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { readCollection, uid, writeCollection } from '@/lib/db';
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
  await seedIfNeeded();
  const scripts = (await readCollection<Script>('scripts')).sort((a, b) =>
    b.created_at.localeCompare(a.created_at)
  );
  return NextResponse.json({ scripts });
}

export async function POST(req: NextRequest) {
  await seedIfNeeded();
  const parsed = scriptSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos', issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const script: Script = {
    id: uid(),
    account_id: 'acc_scav86',
    ...parsed.data,
    created_at: new Date().toISOString(),
  };
  const scripts = await readCollection<Script>('scripts');
  scripts.unshift(script);
  await writeCollection('scripts', scripts);
  return NextResponse.json({ script }, { status: 201 });
}
