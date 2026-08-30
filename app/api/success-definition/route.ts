import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireWorkspace } from '@/lib/session';
import {
  getSuccessDefinition,
  setSuccessDefinition,
  SUCCESS_METRICS,
} from '@/lib/agent/success-definition';

export async function GET() {
  const r = await requireWorkspace();
  if ('error' in r) return r.error;
  const definition = await getSuccessDefinition(r.ws);
  return NextResponse.json({ success_definition: definition });
}

const putSchema = z.object({
  metric: z.enum(SUCCESS_METRICS),
});

export async function PUT(req: NextRequest) {
  const r = await requireWorkspace();
  if ('error' in r) return r.error;
  const parsed = putSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Métrica inválida', issues: parsed.error.issues },
      { status: 400 }
    );
  }
  await setSuccessDefinition(r.ws, parsed.data.metric);
  return NextResponse.json({ success_definition: await getSuccessDefinition(r.ws) });
}
