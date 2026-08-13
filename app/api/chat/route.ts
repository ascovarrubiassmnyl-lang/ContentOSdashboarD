import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { chatReply } from '@/lib/generator';
import { activeWorkspace } from '@/lib/accounts';
import { seedIfNeeded } from '@/lib/mock';

const chatSchema = z.object({
  message: z.string().min(1).max(2000),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })
    )
    .default([]),
});

export async function POST(req: NextRequest) {
  const ws = await activeWorkspace();
  await seedIfNeeded(ws);
  const parsed = chatSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Mensaje inválido', issues: parsed.error.issues },
      { status: 400 }
    );
  }
  try {
    const reply = await chatReply(ws, parsed.data.message, parsed.data.history);
    return NextResponse.json({ reply });
  } catch (err) {
    return NextResponse.json(
      { error: `Error generando el guion: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
