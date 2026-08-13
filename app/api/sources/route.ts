import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { uid } from '@/lib/db';
import { activeWorkspace, readFor, writeFor } from '@/lib/accounts';
import { seedIfNeeded } from '@/lib/mock';
import { Source } from '@/types';

const sourceSchema = z.object({
  type: z.enum(['transcripcion', 'dm', 'llamada', 'comentario', 'objecion']),
  title: z.string().min(3).max(160),
  content: z.string().min(10),
  tags: z.array(z.string()).default([]),
});

export async function GET() {
  const ws = await activeWorkspace();
  await seedIfNeeded(ws);
  const sources = (await readFor<Source>(ws, 'sources')).sort((a, b) =>
    b.created_at.localeCompare(a.created_at)
  );
  return NextResponse.json({ sources });
}

export async function POST(req: NextRequest) {
  const ws = await activeWorkspace();
  await seedIfNeeded(ws);
  const body = await req.json();
  const parsed = sourceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos', issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const source: Source = {
    id: uid(),
    account_id: ws.id,
    ...parsed.data,
    file_url: null,
    created_at: new Date().toISOString(),
  };
  const sources = await readFor<Source>(ws, 'sources');
  sources.unshift(source);
  await writeFor(ws, 'sources', sources);
  return NextResponse.json({ source }, { status: 201 });
}
