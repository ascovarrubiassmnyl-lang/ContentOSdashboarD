import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionUser } from '@/lib/auth';
import { getPreferences, setPreferences } from '@/lib/notifications/store';
import { isValidTimeZone } from '@/lib/timezone';

// Preferencias por USUARIO: describen su teléfono y sus horarios, no la cuenta
// que tenga abierta en ese momento.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  return NextResponse.json({ preferences: await getPreferences(user.id) });
}

const putSchema = z.object({
  kinds: z
    .object({
      calendar_reminder: z.boolean(),
      agent_activity: z.boolean(),
      system_alert: z.boolean(),
    })
    .partial()
    .optional(),
  // Entre 15 minutos y 3 días: menos no da tiempo a producir nada, más deja de
  // ser un recordatorio.
  reminder_lead_minutes: z.number().int().min(15).max(4320).optional(),
  quiet_hours: z
    .object({
      start: z.string().regex(/^\d{2}:\d{2}$/),
      end: z.string().regex(/^\d{2}:\d{2}$/),
    })
    .nullable()
    .optional(),
  timezone: z.string().refine(isValidTimeZone, 'zona horaria IANA desconocida').optional(),
});

export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const parsed = putSchema.safeParse(await req.json());
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `${i.path.join('.') || '(raíz)'}: ${i.message}`)
      .join('; ');
    return NextResponse.json({ error: `Preferencias inválidas — ${detail}` }, { status: 400 });
  }

  const preferences = await setPreferences(user.id, parsed.data);
  return NextResponse.json({ preferences });
}
