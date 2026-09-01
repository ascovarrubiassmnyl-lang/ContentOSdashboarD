'use client';

// Cobertura de la semana en curso: lo programado frente a lo declarado.
//
// Los números vienen de get_calendar_coverage (el mismo cálculo que consume el
// agente), no de contar tarjetas en el DOM: así lo que ve el usuario y lo que
// afirma el agente no pueden divergir.

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { CalendarCoverage } from '@/types';
import { addDays, weekStart } from '@/lib/timezone';

export default function CoverageStrip({ date }: { date: Date }) {
  const day = date.toISOString().slice(0, 10);
  const start = weekStart(day);
  const end = addDays(start, 6);

  const { data } = useQuery<{ coverage: CalendarCoverage | null }>({
    queryKey: ['calendar-coverage', start],
    queryFn: async () =>
      (await fetch(`/api/calendar/plans?coverage_start=${start}&coverage_end=${end}`)).json(),
  });

  const week = data?.coverage?.weeks.find((w) => w.week_start === start);
  if (!data?.coverage || !week) return null;

  if (!data.coverage.configured) {
    return (
      <div className="card p-3 mb-5 flex flex-wrap items-center gap-3">
        <p className="text-xs text-muted">
          No has declarado tu cadencia semanal, así que no hay contra qué comparar lo programado.
        </p>
        <Link
          href="/estrategia"
          className="text-xs font-semibold text-primary hover:underline ml-auto"
        >
          Definir mi estructura →
        </Link>
      </div>
    );
  }

  const active = week.by_format.filter((f) => f.target > 0 || f.scheduled > 0);
  if (active.length === 0) return null;

  return (
    <div className="card p-3 mb-5 flex flex-wrap items-center gap-x-5 gap-y-2">
      <p className="section-label">Cobertura de la semana</p>
      {active.map((f) => {
        const done = f.gap <= 0;
        return (
          <div key={f.format} className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${done ? 'bg-positive' : 'bg-orange'}`} />
            <span className="text-xs text-soft capitalize">{f.format}</span>
            <span className={`text-xs font-bold ${done ? 'text-positive' : 'text-orange'}`}>
              {f.scheduled}/{f.target}
            </span>
          </div>
        );
      })}
      <Link
        href="/estrategia"
        className="text-xs font-semibold text-muted hover:text-primary ml-auto"
      >
        Ajustar estructura
      </Link>
    </div>
  );
}
