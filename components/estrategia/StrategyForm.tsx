'use client';

// Formulario de franjas de publicación. Es la entrada estructurada que el
// agente lee como criterio: por eso son campos y no texto libre — el agente
// coloca las piezas en estas franjas cuando planifica el calendario.

import { useEffect, useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { Button, Card, Spinner } from '@/components/ui';
import { ContentStrategy } from '@/types';
import { WEEKDAY_LABELS } from '@/lib/timezone';

// Lista corta y útil; el campo acepta cualquier IANA válida al guardar.
const TIMEZONES = [
  'America/Mexico_City',
  'America/Bogota',
  'America/Lima',
  'America/Santiago',
  'America/Argentina/Buenos_Aires',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/Madrid',
  'UTC',
];

export default function StrategyForm() {
  const [strategy, setStrategy] = useState<ContentStrategy | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/content-strategy')
      .then((r) => r.json())
      .then((d) => setStrategy(d.strategy))
      .catch(() => setMessage({ kind: 'error', text: 'No se pudo cargar la estrategia.' }));
  }, []);

  if (!strategy) {
    return (
      <Card>
        <div className="flex items-center gap-3 text-muted text-sm">
          <Spinner /> Cargando franjas de publicación…
        </div>
      </Card>
    );
  }

  const patch = (p: Partial<ContentStrategy>) => setStrategy({ ...strategy, ...p });

  async function save() {
    if (!strategy) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/content-strategy', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          timezone: strategy.timezone,
          weekly_targets: strategy.weekly_targets,
          funnel_mix: strategy.funnel_mix,
          slots: strategy.slots,
          pillars: strategy.pillars,
          copy_rules: strategy.copy_rules,
          notes: strategy.notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al guardar');
      setStrategy(data.strategy);
      setMessage({ kind: 'ok', text: 'Guardado. El agente ya usa estas franjas.' });
    } catch (err) {
      setMessage({ kind: 'error', text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <h3 className="font-extrabold mb-1">Franjas de publicación</h3>
        <p className="text-xs text-muted mb-4">
          Día y hora habituales. El agente coloca las piezas en estas franjas cuando planifica.
        </p>
        <label className="block mb-4">
          <span className="section-label block mb-1.5">Zona horaria</span>
          <select
            value={strategy.timezone}
            onChange={(e) => patch({ timezone: e.target.value })}
            className="w-full bg-bg border border-line rounded-xl px-3.5 py-2.5 text-sm focus:border-primary focus:outline-none"
          >
            {[...new Set([strategy.timezone, ...TIMEZONES])].map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </label>

        <div className="space-y-2">
          {strategy.slots.map((slot, i) => (
            <div key={`${slot.weekday}-${slot.time}-${i}`} className="flex gap-2">
              <select
                value={slot.weekday}
                onChange={(e) => {
                  const next = [...strategy.slots];
                  next[i] = { ...slot, weekday: Number(e.target.value) };
                  patch({ slots: next });
                }}
                className="flex-1 bg-bg border border-line rounded-xl px-3 py-2 text-sm focus:border-primary focus:outline-none"
              >
                {WEEKDAY_LABELS.map((label, idx) => (
                  <option key={label} value={idx}>
                    {label}
                  </option>
                ))}
              </select>
              <input
                type="time"
                value={slot.time}
                onChange={(e) => {
                  const next = [...strategy.slots];
                  next[i] = { ...slot, time: e.target.value };
                  patch({ slots: next });
                }}
                className="w-32 bg-bg border border-line rounded-xl px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
              <button
                onClick={() => patch({ slots: strategy.slots.filter((_, idx) => idx !== i) })}
                className="h-10 w-10 shrink-0 rounded-xl border border-line text-muted hover:text-negative hover:border-negative/40 flex items-center justify-center"
                aria-label="Quitar franja"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
        <Button
          variant="secondary"
          className="mt-3 text-xs"
          onClick={() => patch({ slots: [...strategy.slots, { weekday: 2, time: '09:00' }] })}
        >
          <span className="flex items-center gap-1.5">
            <Plus size={14} /> Añadir franja
          </span>
        </Button>
      </Card>

      <div className="flex items-center gap-4">
        <Button onClick={save} disabled={saving}>
          <span className="flex items-center gap-2">
            {saving ? <Spinner /> : <Save size={15} />} Guardar franjas
          </span>
        </Button>
        {message && (
          <p className={`text-sm ${message.kind === 'ok' ? 'text-positive' : 'text-negative'}`}>
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
}
