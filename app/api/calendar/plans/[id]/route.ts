import { NextRequest, NextResponse } from 'next/server';
import { requireWorkspace } from '@/lib/session';
import { applyPlan, discardPlan, getPlan } from '@/lib/agent/calendar-plan';

type Ctx = { params: Promise<{ id: string }> };

// Aprobar el plan es un acto del USUARIO contra esta ruta, no una decisión del
// modelo (Decisión #3 del plan de Fase 4). El agente propone; aquí se ejecuta.
export async function POST(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const r = await requireWorkspace();
  if ('error' in r) return r.error;

  try {
    const result = await applyPlan(r.ws, id);
    return NextResponse.json({ ...result, plan: await getPlan(r.ws, id) });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

// Descarta un plan propuesto o deshace uno aplicado — en ese caso borra
// exactamente las piezas que creó (llevan `plan_id`), no las demás.
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const r = await requireWorkspace();
  if ('error' in r) return r.error;

  try {
    const result = await discardPlan(r.ws, id);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
