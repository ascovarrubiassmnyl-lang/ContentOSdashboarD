import { NextRequest, NextResponse } from 'next/server';
import { listAccounts, readFor } from '@/lib/accounts';
import { emitNotification } from '@/lib/notifications/emit';
import { getPreferences } from '@/lib/notifications/store';
import { getContentStrategy } from '@/lib/agent/content-strategy';
import { isoToLocalParts } from '@/lib/timezone';
import { CalendarItem } from '@/types';

export const runtime = 'nodejs';

// Tick de recordatorios de calendario. Pensado para correr cada ~15 minutos
// (servicio `npm run cron:notify` en Railway), no una vez al día como el resto
// de crons: un aviso de "faltan 2 horas" con granularidad diaria no existe.
//
// Barrer el calendario cada 15 min es trivial (decenas de items) y evita tener
// que montar una cola de trabajos programados por pieza.
//
//   POST /api/cron/notifications  con  authorization: Bearer <CRON_SECRET>

// Margen del barrido: se avisa de las piezas cuya antelación cae dentro de los
// próximos VENTANA minutos. Con ticks de 15 min y ventana de 20 no se escapa
// ninguna aunque un tick se retrase un poco; el dedupe impide el duplicado.
const WINDOW_MINUTES = 20;

async function run(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET no está configurado' }, { status: 503 });
  }
  const provided =
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
    req.nextUrl.searchParams.get('secret');
  if (provided !== secret) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const started = Date.now();
  const now = Date.now();
  const results: Record<string, unknown>[] = [];
  let failed = 0;
  let notified = 0;

  for (const ws of await listAccounts()) {
    const entry: Record<string, unknown> = { account: ws.label };
    try {
      // La antelación es del usuario; sin dueño, no hay a quién avisar.
      const lead = ws.owner_user_id
        ? (await getPreferences(ws.owner_user_id)).reminder_lead_minutes
        : 120;
      const strategy = await getContentStrategy(ws);

      const items = await readFor<CalendarItem>(ws, 'calendar_items');
      const due = items.filter((item) => {
        const at = new Date(item.scheduled_at).getTime();
        if (Number.isNaN(at)) return false;
        // Ya publicada: no tiene sentido recordar lo que ya salió.
        if (item.status === 'publicado') return false;
        const minutesAway = (at - now) / 60000;
        return minutesAway <= lead && minutesAway > lead - WINDOW_MINUTES;
      });

      const sent: string[] = [];
      for (const item of due) {
        const when = (() => {
          try {
            return isoToLocalParts(item.scheduled_at, strategy.timezone).time;
          } catch {
            return item.scheduled_at.slice(11, 16);
          }
        })();
        const hours = Math.round(lead / 60);
        const result = await emitNotification({
          ws,
          kind: 'calendar_reminder',
          title:
            hours >= 1
              ? `Faltan ${hours} h para publicar: ${item.title}`
              : `Faltan ${lead} min para publicar: ${item.title}`,
          body: `${item.format.toUpperCase()} programado hoy a las ${when}${
            item.pillar ? ` · ${item.pillar}` : ''
          }.`,
          url: '/calendario',
          // La antelación entra en la clave: si el usuario la cambia, el aviso
          // nuevo es legítimamente distinto del que ya se mandó.
          dedupeKey: `reminder:${item.id}:${lead}m`,
        });
        if (result.emitted) {
          sent.push(item.title);
          notified++;
        }
      }
      entry.reminders = sent.length > 0 ? sent : 'ninguno pendiente';
    } catch (err) {
      entry.error = (err as Error).message;
      failed++;
    }
    results.push(entry);
  }

  return NextResponse.json({
    ok: failed === 0,
    notified,
    results,
    tookMs: Date.now() - started,
    at: new Date().toISOString(),
  });
}

export const GET = run;
export const POST = run;
