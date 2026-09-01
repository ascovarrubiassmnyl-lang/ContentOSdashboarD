'use client';

// Tarjeta de plan propuesto. Es la superficie donde el usuario confirma en
// bloque lo que el agente planificó.
//
// El contenido se pinta desde el PLAN estructurado, no desde la prosa del
// agente: así lo que se aplica es exactamente lo que se ve, sin que una
// diferencia entre el texto y los datos pueda colar piezas que el usuario no
// leyó (mismo principio que la Capa 2 del contrato de confianza).

import { useState } from 'react';
import { AlertTriangle, CalendarCheck, Check, RotateCcw, X } from 'lucide-react';
import { CalendarPlan } from '@/types';
import { isoToLocalParts, WEEKDAY_LABELS } from '@/lib/timezone';
import { Spinner } from '@/components/ui';

const FORMAT_DOT: Record<string, string> = {
  reel: 'bg-primary',
  carrusel: 'bg-orange',
  historia: 'bg-pink',
  ad: 'bg-positive',
};

export default function PlanCard({
  plan,
  timezone,
  onChanged,
}: {
  plan: CalendarPlan;
  timezone: string;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<'apply' | 'discard' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(plan.status === 'aplicado');

  async function act(action: 'apply' | 'discard') {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/calendar/plans/${plan.id}`, {
        method: action === 'apply' ? 'POST' : 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'No se pudo completar la acción.');
      setApplied(action === 'apply');
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  // Agrupado por día local: un plan de dos semanas en lista plana es ilegible.
  const byDay = new Map<string, typeof plan.items>();
  for (const item of plan.items) {
    let key: string;
    try {
      const parts = isoToLocalParts(item.scheduled_at, timezone);
      key = `${parts.date}|${parts.time}|${parts.weekday}`;
    } catch {
      key = `${item.scheduled_at}||0`;
    }
    const day = key.split('|')[0];
    byDay.set(day, [...(byDay.get(day) ?? []), item]);
  }

  return (
    <div className="card p-4 border-primary/30">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="accent-label mb-1">
            {applied ? 'Plan aplicado' : 'Plan propuesto · pendiente de tu aprobación'}
          </p>
          <h4 className="font-extrabold text-sm">
            {plan.items.length} pieza{plan.items.length === 1 ? '' : 's'} · {plan.range.start} a{' '}
            {plan.range.end}
          </h4>
        </div>
        <CalendarCheck size={18} className={applied ? 'text-positive' : 'text-primary'} />
      </div>

      {plan.rationale && <p className="text-xs text-muted mb-3">{plan.rationale}</p>}

      <div className="space-y-2 max-h-72 overflow-y-auto pr-1 mb-3">
        {[...byDay.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([day, items]) => {
            const weekday = (() => {
              try {
                return WEEKDAY_LABELS[isoToLocalParts(items[0].scheduled_at, timezone).weekday];
              } catch {
                return '';
              }
            })();
            return (
              <div key={day}>
                <p className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-1">
                  {weekday} {day}
                </p>
                <div className="space-y-1">
                  {items.map((item, i) => {
                    let time = '';
                    try {
                      time = isoToLocalParts(item.scheduled_at, timezone).time;
                    } catch {
                      time = '';
                    }
                    return (
                      <div
                        key={i}
                        className="flex items-start gap-2 rounded-lg border border-line bg-bg px-3 py-2"
                      >
                        <span
                          className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${
                            FORMAT_DOT[item.format] ?? 'bg-muted'
                          }`}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium leading-tight">{item.title}</p>
                          <p className="text-[10px] text-muted mt-0.5">
                            {time} · {item.format}
                            {item.nivel && ` · ${item.nivel.toUpperCase()}`}
                            {item.pillar && ` · ${item.pillar}`}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
      </div>

      {plan.deviations.length > 0 && (
        <div className="rounded-xl border border-orange/30 bg-orange/5 px-3 py-2 mb-3">
          <p className="text-[11px] font-semibold text-orange flex items-center gap-1.5 mb-1">
            <AlertTriangle size={12} /> Se sale de tu estructura declarada
          </p>
          <ul className="space-y-0.5">
            {plan.deviations.map((d, i) => (
              <li key={i} className="text-[11px] text-soft">
                · {d.detail}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <p className="text-xs text-negative mb-2">{error}</p>}

      <div className="flex items-center gap-2">
        {applied ? (
          <>
            <span className="text-xs text-positive flex items-center gap-1.5 font-semibold">
              <Check size={14} /> En tu calendario
            </span>
            <button
              onClick={() => act('discard')}
              disabled={busy !== null}
              className="ml-auto px-3 py-1.5 rounded-lg border border-line text-xs font-semibold text-muted hover:text-negative hover:border-negative/40 transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              {busy === 'discard' ? <Spinner /> : <RotateCcw size={13} />} Deshacer
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => act('apply')}
              disabled={busy !== null}
              className="px-3.5 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary/85 disabled:opacity-50 transition-all flex items-center gap-1.5"
            >
              {busy === 'apply' ? <Spinner /> : <Check size={14} />} Aplicar al calendario
            </button>
            <button
              onClick={() => act('discard')}
              disabled={busy !== null}
              className="px-3 py-2 rounded-xl border border-line text-xs font-semibold text-muted hover:text-white transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              <X size={13} /> Descartar
            </button>
          </>
        )}
      </div>
    </div>
  );
}
