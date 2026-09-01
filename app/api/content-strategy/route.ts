import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireWorkspace } from '@/lib/session';
import { getContentStrategy, setContentStrategy } from '@/lib/agent/content-strategy';
import { isValidTimeZone } from '@/lib/timezone';

// La estrategia de calendario se edita SOLO desde aquí (Decisión #5 del plan
// de Fase 4): el agente la lee pero no la escribe. Es el criterio contra el
// que se validan sus propios planes — si pudiera reescribirla, se estaría
// calificando a sí mismo.
export async function GET() {
  const r = await requireWorkspace();
  if ('error' in r) return r.error;
  return NextResponse.json({ strategy: await getContentStrategy(r.ws) });
}

const putSchema = z.object({
  timezone: z.string().refine(isValidTimeZone, 'zona horaria IANA desconocida'),
  weekly_targets: z.array(
    z.object({
      format: z.enum(['reel', 'carrusel', 'historia', 'ad']),
      per_week: z.number().int().min(0).max(21),
    })
  ),
  funnel_mix: z.object({
    tofu: z.number().min(0).max(100),
    mofu: z.number().min(0).max(100),
    bofu: z.number().min(0).max(100),
  }),
  slots: z.array(
    z.object({
      weekday: z.number().int().min(0).max(6),
      time: z.string().regex(/^\d{2}:\d{2}$/, 'debe ser HH:MM'),
    })
  ),
  pillars: z.array(z.object({ name: z.string().min(1).max(60), description: z.string().max(240) })),
  copy_rules: z.object({
    tone: z.string().max(300),
    cta_style: z.string().max(300),
    caption_length: z.enum(['corta', 'media', 'larga']),
    avoid: z.array(z.string().max(80)),
  }),
  notes: z.string().max(1000),
});

export async function PUT(req: NextRequest) {
  const r = await requireWorkspace();
  if ('error' in r) return r.error;

  const parsed = putSchema.safeParse(await req.json());
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `${i.path.join('.') || '(raíz)'}: ${i.message}`)
      .join('; ');
    return NextResponse.json({ error: `Datos inválidos — ${detail}` }, { status: 400 });
  }

  const strategy = await setContentStrategy(r.ws, parsed.data);
  return NextResponse.json({ strategy });
}
