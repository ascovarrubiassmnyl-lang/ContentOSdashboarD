import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateScript } from '@/lib/generator';
import { activeWorkspace } from '@/lib/accounts';
import { seedIfNeeded } from '@/lib/mock';

const generateSchema = z.object({
  format: z.enum(['reel', 'carrusel', 'historia']),
  objective: z.enum(['alcance', 'engagement', 'clics']),
  tone: z.string().min(2).max(60),
  sourceIds: z.array(z.string()).default([]),
  topic: z.string().max(200).optional(),
  useAllSources: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  const ws = await activeWorkspace();
  await seedIfNeeded(ws);
  const body = await req.json();
  const parsed = generateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos', issues: parsed.error.issues },
      { status: 400 }
    );
  }
  try {
    const script = await generateScript(ws, parsed.data);
    return NextResponse.json({ script });
  } catch (err) {
    return NextResponse.json(
      { error: `Error generando guion: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
