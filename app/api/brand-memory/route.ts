import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireWorkspace } from '@/lib/session';
import { addBrandMemory, listBrandMemory, removeBrandMemory } from '@/lib/agent/brand-memory';

// La memoria de marca tiene endpoint propio para que el usuario pueda VERLA y
// BORRARLA (Decisión #6 del plan de Fase 2). Sin esto, el agente acumularía
// creencias sobre la marca que nadie puede auditar ni corregir.
export async function GET() {
  const r = await requireWorkspace();
  if ('error' in r) return r.error;
  return NextResponse.json({ entries: await listBrandMemory(r.ws) });
}

const postSchema = z.object({ text: z.string().min(1).max(300) });

export async function POST(req: NextRequest) {
  const r = await requireWorkspace();
  if ('error' in r) return r.error;

  const parsed = postSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Texto inválido', issues: parsed.error.issues },
      { status: 400 }
    );
  }
  try {
    // source_conversation_id null = lo escribió el usuario a mano, no salió de
    // una conversación con el agente.
    const entry = await addBrandMemory(r.ws, parsed.data.text, null);
    return NextResponse.json({ entry }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

const deleteSchema = z.object({ id: z.string().min(1) });

export async function DELETE(req: NextRequest) {
  const r = await requireWorkspace();
  if ('error' in r) return r.error;

  const parsed = deleteSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Falta el id' }, { status: 400 });

  await removeBrandMemory(r.ws, parsed.data.id);
  return NextResponse.json({ ok: true });
}
