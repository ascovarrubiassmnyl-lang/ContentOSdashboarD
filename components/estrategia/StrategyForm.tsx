'use client';

// Formulario de la estructura de calendario. Es la entrada estructurada que
// el agente lee como criterio: por eso son campos y no texto libre — la
// cobertura (`get_calendar_coverage`) necesita números, no prosa que el
// modelo reinterprete cada turno.

import { useEffect, useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { Button, Card, Spinner } from '@/components/ui';
import { CalendarFormat, ContentStrategy } from '@/types';
import { WEEKDAY_LABELS } from '@/lib/timezone';

const FORMAT_LABELS: Record<CalendarFormat, string> = {
  reel: 'Reels',
  carrusel: 'Carruseles',
  historia: 'Historias',
  ad: 'Anuncios',
};

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
          <Spinner /> Cargando estrategia…
        </div>
      </Card>
    );
  }

  const patch = (p: Partial<ContentStrategy>) => setStrategy({ ...strategy, ...p });

  const mixTotal = strategy.funnel_mix.tofu + strategy.funnel_mix.mofu + strategy.funnel_mix.bofu;
  const weeklyTotal = strategy.weekly_targets.reduce((a, t) => a + t.per_week, 0);
  // Aviso, no bloqueo: menos franjas que piezas solo significa que el agente
  // repartirá varias piezas en el mismo día.
  const slotsShort = strategy.slots.length < weeklyTotal;

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
      setMessage({ kind: 'ok', text: 'Guardado. El agente ya usa esta estructura.' });
    } catch (err) {
      setMessage({ kind: 'error', text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {!strategy.configured && (
        <div className="card p-4 border-orange/30 bg-orange/5 text-sm text-soft">
          Todavía no configuraste tu estructura. Lo que ves son valores por defecto: el agente lo
          sabe y te lo dirá cuando hable de frecuencia. Guarda para que pasen a ser tuyos.
        </div>
      )}

      <Card>
        <h3 className="font-extrabold mb-1">Cadencia semanal</h3>
        <p className="text-xs text-muted mb-4">
          Cuántas piezas de cada formato quieres publicar por semana. Es tu objetivo declarado —
          el agente lo compara contra lo que hay realmente programado.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {strategy.weekly_targets.map((t, i) => (
            <label key={t.format} className="block">
              <span className="section-label block mb-1.5">{FORMAT_LABELS[t.format]}</span>
              <input
                type="number"
                min={0}
                max={21}
                value={t.per_week}
                onChange={(e) => {
                  const next = [...strategy.weekly_targets];
                  next[i] = { ...t, per_week: Math.max(0, Number(e.target.value) || 0) };
                  patch({ weekly_targets: next });
                }}
                className="w-full bg-bg border border-line rounded-xl px-3.5 py-2.5 text-sm focus:border-primary focus:outline-none"
              />
            </label>
          ))}
        </div>
        <p className="text-xs text-muted mt-3">
          Total: <span className="text-white font-bold">{weeklyTotal}</span> piezas por semana.
        </p>
      </Card>

      <Card>
        <h3 className="font-extrabold mb-1">Mezcla de funnel</h3>
        <p className="text-xs text-muted mb-4">
          Qué porcentaje de tus piezas apunta a cada etapa. Si no suma 100 se normaliza al guardar.
        </p>
        <div className="grid grid-cols-3 gap-3">
          {(['tofu', 'mofu', 'bofu'] as const).map((level) => (
            <label key={level} className="block">
              <span className="section-label block mb-1.5">{level.toUpperCase()}</span>
              <input
                type="number"
                min={0}
                max={100}
                value={strategy.funnel_mix[level]}
                onChange={(e) =>
                  patch({
                    funnel_mix: {
                      ...strategy.funnel_mix,
                      [level]: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                    },
                  })
                }
                className="w-full bg-bg border border-line rounded-xl px-3.5 py-2.5 text-sm focus:border-primary focus:outline-none"
              />
            </label>
          ))}
        </div>
        <p className={`text-xs mt-3 ${mixTotal === 100 ? 'text-muted' : 'text-orange'}`}>
          Suma actual: {mixTotal}%{mixTotal !== 100 && ' — se ajustará a 100 al guardar.'}
        </p>
      </Card>

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
        {slotsShort && (
          <p className="text-xs text-orange mt-3">
            Tienes {strategy.slots.length} franjas para {weeklyTotal} piezas semanales: el agente
            pondrá más de una pieza en algunos días.
          </p>
        )}
      </Card>

      <Card>
        <h3 className="font-extrabold mb-1">Pilares de contenido</h3>
        <p className="text-xs text-muted mb-4">
          Los temas recurrentes de tu cuenta. El agente etiqueta cada pieza que propone con uno.
        </p>
        <div className="space-y-2">
          {strategy.pillars.map((p, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={p.name}
                placeholder="Nombre del pilar"
                onChange={(e) => {
                  const next = [...strategy.pillars];
                  next[i] = { ...p, name: e.target.value };
                  patch({ pillars: next });
                }}
                className="w-1/3 bg-bg border border-line rounded-xl px-3 py-2 text-sm focus:border-primary focus:outline-none placeholder:text-muted/50"
              />
              <input
                value={p.description}
                placeholder="De qué va"
                onChange={(e) => {
                  const next = [...strategy.pillars];
                  next[i] = { ...p, description: e.target.value };
                  patch({ pillars: next });
                }}
                className="flex-1 bg-bg border border-line rounded-xl px-3 py-2 text-sm focus:border-primary focus:outline-none placeholder:text-muted/50"
              />
              <button
                onClick={() => patch({ pillars: strategy.pillars.filter((_, idx) => idx !== i) })}
                className="h-10 w-10 shrink-0 rounded-xl border border-line text-muted hover:text-negative hover:border-negative/40 flex items-center justify-center"
                aria-label="Quitar pilar"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
        <Button
          variant="secondary"
          className="mt-3 text-xs"
          onClick={() => patch({ pillars: [...strategy.pillars, { name: '', description: '' }] })}
        >
          <span className="flex items-center gap-1.5">
            <Plus size={14} /> Añadir pilar
          </span>
        </Button>
      </Card>

      <Card>
        <h3 className="font-extrabold mb-1">Reglas de copy</h3>
        <p className="text-xs text-muted mb-4">
          Cómo escribes. El agente lo respeta al redactar, junto al perfil de voz que mide de tus
          publicaciones reales.
        </p>
        <label className="block mb-4">
          <span className="section-label block mb-1.5">Tono</span>
          <input
            value={strategy.copy_rules.tone}
            placeholder="Directo, sin tecnicismos, primera persona"
            onChange={(e) =>
              patch({ copy_rules: { ...strategy.copy_rules, tone: e.target.value } })
            }
            className="w-full bg-bg border border-line rounded-xl px-3.5 py-2.5 text-sm focus:border-primary focus:outline-none placeholder:text-muted/50"
          />
        </label>
        <label className="block mb-4">
          <span className="section-label block mb-1.5">Estilo de CTA</span>
          <input
            value={strategy.copy_rules.cta_style}
            placeholder="Invitar a comentar una palabra clave; nunca “link en bio”"
            onChange={(e) =>
              patch({ copy_rules: { ...strategy.copy_rules, cta_style: e.target.value } })
            }
            className="w-full bg-bg border border-line rounded-xl px-3.5 py-2.5 text-sm focus:border-primary focus:outline-none placeholder:text-muted/50"
          />
        </label>
        <label className="block mb-4">
          <span className="section-label block mb-1.5">Longitud de caption</span>
          <select
            value={strategy.copy_rules.caption_length}
            onChange={(e) =>
              patch({
                copy_rules: {
                  ...strategy.copy_rules,
                  caption_length: e.target.value as 'corta' | 'media' | 'larga',
                },
              })
            }
            className="w-full bg-bg border border-line rounded-xl px-3.5 py-2.5 text-sm focus:border-primary focus:outline-none"
          >
            <option value="corta">Corta</option>
            <option value="media">Media</option>
            <option value="larga">Larga</option>
          </select>
        </label>
        <label className="block">
          <span className="section-label block mb-1.5">Evitar siempre (separado por comas)</span>
          <input
            value={strategy.copy_rules.avoid.join(', ')}
            placeholder="emojis, hablar de precio en TOFU, jerga corporativa"
            onChange={(e) =>
              patch({
                copy_rules: {
                  ...strategy.copy_rules,
                  avoid: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                },
              })
            }
            className="w-full bg-bg border border-line rounded-xl px-3.5 py-2.5 text-sm focus:border-primary focus:outline-none placeholder:text-muted/50"
          />
        </label>
      </Card>

      <Card>
        <h3 className="font-extrabold mb-1">Notas</h3>
        <p className="text-xs text-muted mb-4">
          Cualquier matiz sobre tu operación que el agente deba tener presente al planificar.
        </p>
        <textarea
          rows={4}
          value={strategy.notes}
          placeholder="Los lunes no publico. En diciembre bajo la frecuencia a la mitad."
          onChange={(e) => patch({ notes: e.target.value })}
          className="w-full bg-bg border border-line rounded-xl px-3.5 py-2.5 text-sm focus:border-primary focus:outline-none placeholder:text-muted/50 resize-y"
        />
      </Card>

      <div className="flex items-center gap-4 sticky bottom-4">
        <Button onClick={save} disabled={saving}>
          <span className="flex items-center gap-2">
            {saving ? <Spinner /> : <Save size={15} />} Guardar estrategia
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
