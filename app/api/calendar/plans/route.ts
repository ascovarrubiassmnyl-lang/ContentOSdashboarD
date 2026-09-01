import { NextRequest, NextResponse } from 'next/server';
import { requireWorkspace } from '@/lib/session';
import { getCalendarCoverage, listPlans } from '@/lib/agent/calendar-plan';
import { CalendarPlanStatus } from '@/types';

const STATUSES: CalendarPlanStatus[] = ['propuesto', 'aplicado', 'descartado'];

// Lista los planes de la cuenta activa. El chat lo consulta tras cada turno
// para saber si el agente dejó una propuesta pendiente de aprobación.
export async function GET(req: NextRequest) {
  const r = await requireWorkspace();
  if ('error' in r) return r.error;

  const raw = req.nextUrl.searchParams.get('status');
  const status = STATUSES.includes(raw as CalendarPlanStatus)
    ? (raw as CalendarPlanStatus)
    : undefined;

  const plans = await listPlans(r.ws, status);

  // La cobertura se sirve junto a los planes porque quien pinta el calendario
  // quiere las dos cosas y son una sola lectura del mismo almacén.
  const rangeStart = req.nextUrl.searchParams.get('coverage_start');
  const rangeEnd = req.nextUrl.searchParams.get('coverage_end');
  const coverage =
    rangeStart && rangeEnd
      ? await getCalendarCoverage(r.ws, { start: rangeStart, end: rangeEnd })
      : null;

  return NextResponse.json({ plans, coverage });
}
