import { NextRequest, NextResponse } from 'next/server';
import { listAccounts, readFor } from '@/lib/accounts';
import { generateReport } from '@/lib/reports';
import { emitNotification } from '@/lib/notifications/emit';
import { Report } from '@/types';

const FIFTEEN_DAYS_MS = 15 * 86400_000;

// Cron de reportes quincenales: para CADA cuenta, si no tiene ningún reporte
// o el último tiene 15+ días, genera uno nuevo vía el agente (lib/reports.ts
// → lib/agent/report.ts). Mismo patrón de auth y de tolerancia a fallos por
// cuenta que app/api/cron/sync/route.ts — el scheduler debe llamar:
//   GET /api/cron/reports  con header  authorization: Bearer <CRON_SECRET>
//   (o ?secret=<CRON_SECRET> si el scheduler no soporta headers)
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'CRON_SECRET no está configurado en el servidor' },
      { status: 503 }
    );
  }
  const provided =
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
    req.nextUrl.searchParams.get('secret');
  if (provided !== secret) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const started = Date.now();
  const accounts = await listAccounts();
  const results: Record<string, unknown>[] = [];
  let failed = 0;

  for (const ws of accounts) {
    const entry: Record<string, unknown> = { account: ws.label };
    try {
      const reports = (await readFor<Report>(ws, 'reports')).slice().sort((a, b) =>
        b.created_at.localeCompare(a.created_at)
      );
      const last = reports[0];
      const dueForReport =
        !last || Date.now() - new Date(last.created_at).getTime() >= FIFTEEN_DAYS_MS;

      if (!dueForReport) {
        entry.report = 'omitido (último reporte de hace menos de 15 días)';
      } else {
        const periodEnd = new Date().toISOString().slice(0, 10);
        const periodStart = new Date(Date.now() - 14 * 86400_000).toISOString().slice(0, 10);
        const report = await generateReport(ws, periodStart, periodEnd);
        entry.report = { id: report.id, period_start: report.period_start, period_end: report.period_end };
        // Trabajo NO interactivo: el usuario no estaba mirando, así que un
        // aviso aquí sí aporta (a diferencia de lo que pide en el chat, que ya
        // está viendo llegar).
        await emitNotification({
          ws,
          kind: 'agent_activity',
          title: 'Tu reporte quincenal está listo',
          body: `Periodo ${periodStart} a ${periodEnd} de ${ws.label}.`,
          url: '/agente?panel=reportes',
          dedupeKey: `report:${report.id}`,
        });
      }
    } catch (err) {
      entry.reportError = (err as Error).message;
      failed++;
    }
    results.push(entry);
  }

  return NextResponse.json({
    ok: failed === 0,
    accounts: results.length,
    results,
    tookMs: Date.now() - started,
    at: new Date().toISOString(),
  });
}

// Algunos schedulers solo hacen POST
export const POST = GET;
