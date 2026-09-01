'use client';

// Pantalla Estrategia — las tres cosas que configuran el criterio del agente:
// la estructura de calendario (Fase 4), la métrica de éxito (Fase 1) y la
// memoria de marca (Fase 2). Las dos últimas solo existían por API: el propio
// mensaje de error de brand-memory.ts mandaba al usuario a "Ajustes del
// agente", una pantalla que hasta ahora no existía.

import { useEffect, useState } from 'react';
import { Bell, Compass, Target, Brain, Trash2, Plus } from 'lucide-react';
import { Button, Card, Spinner } from '@/components/ui';
import StrategyForm from '@/components/estrategia/StrategyForm';
import { BrandMemoryEntry, SuccessDefinition } from '@/types';
import { KIND_LABELS, NotificationPreferences } from '@/lib/notifications/types';

const SUCCESS_LABELS: Record<string, string> = {
  reach: 'Alcance',
  views: 'Vistas',
  interactions: 'Interacciones',
  saves: 'Guardados',
  followers_net: 'Seguidores netos',
  link_taps: 'Clics al link',
};

function SuccessMetricCard() {
  const [definition, setDefinition] = useState<SuccessDefinition | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/success-definition')
      .then((r) => r.json())
      .then((d) => setDefinition(d.success_definition))
      .catch(() => undefined);
  }, []);

  async function save(metric: string) {
    setSaving(true);
    try {
      const res = await fetch('/api/success-definition', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ metric }),
      });
      const data = await res.json();
      if (res.ok) setDefinition(data.success_definition);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <h3 className="font-extrabold mb-1 flex items-center gap-2">
        <Target size={17} className="text-primary" /> Métrica de éxito
      </h3>
      <p className="text-xs text-muted mb-4">
        Contra qué se mide si el contenido funcionó. Si no la eliges, el agente usa alcance y te lo
        dice en cada análisis en vez de asumirlo en silencio.
      </p>
      {!definition ? (
        <Spinner />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {Object.entries(SUCCESS_LABELS).map(([value, label]) => (
              <button
                key={value}
                disabled={saving}
                onClick={() => save(value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all disabled:opacity-50 ${
                  definition.metric === value
                    ? 'bg-primary text-white border-primary'
                    : 'bg-bg text-muted border-line hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {!definition.configured && (
            <p className="text-xs text-orange mt-3">
              Sin configurar — el agente está usando alcance como supuesto declarado.
            </p>
          )}
        </>
      )}
    </Card>
  );
}

function BrandMemoryCard() {
  const [entries, setEntries] = useState<BrandMemoryEntry[] | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch('/api/brand-memory');
    const data = await res.json();
    setEntries(data.entries ?? []);
  }

  useEffect(() => {
    load().catch(() => setEntries([]));
  }, []);

  async function add() {
    const text = draft.trim();
    if (!text) return;
    setError(null);
    const res = await fetch('/api/brand-memory', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'No se pudo guardar.');
      return;
    }
    setDraft('');
    await load();
  }

  async function remove(id: string) {
    await fetch('/api/brand-memory', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    await load();
  }

  return (
    <Card>
      <h3 className="font-extrabold mb-1 flex items-center gap-2">
        <Brain size={17} className="text-primary" /> Memoria de marca
      </h3>
      <p className="text-xs text-muted mb-4">
        Lo que el agente recuerda de tu marca entre conversaciones. Puedes añadir entradas aquí o
        decírselo en el chat; borrar una la olvida de verdad.
      </p>
      <div className="flex gap-2 mb-4">
        <input
          value={draft}
          placeholder="Mi público son fundadores B2B"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          className="flex-1 bg-bg border border-line rounded-xl px-3.5 py-2.5 text-sm focus:border-primary focus:outline-none placeholder:text-muted/50"
        />
        <Button variant="secondary" onClick={add}>
          <Plus size={15} />
        </Button>
      </div>
      {error && <p className="text-xs text-negative mb-3">{error}</p>}
      {entries === null ? (
        <Spinner />
      ) : entries.length === 0 ? (
        <p className="text-xs text-muted">Nada guardado todavía.</p>
      ) : (
        <ul className="space-y-2">
          {entries.map((e) => (
            <li
              key={e.id}
              className="flex items-start gap-3 p-3 rounded-xl border border-line bg-bg"
            >
              <div className="flex-1">
                <p className="text-sm">{e.text}</p>
                <p className="text-[10px] text-muted mt-1">
                  {e.source_conversation_id ? 'Desde el chat' : 'Añadido a mano'} ·{' '}
                  {new Date(e.created_at).toLocaleDateString('es-MX')}
                </p>
              </div>
              <button
                onClick={() => remove(e.id)}
                className="text-muted hover:text-negative shrink-0"
                aria-label="Borrar entrada"
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function NotificationPrefsCard() {
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/notifications/preferences')
      .then((r) => r.json())
      .then((d) => setPrefs(d.preferences))
      .catch(() => undefined);
  }, []);

  async function save(patch: Partial<NotificationPreferences>) {
    if (!prefs) return;
    const next = { ...prefs, ...patch };
    setPrefs(next);
    setSaving(true);
    try {
      const res = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kinds: next.kinds,
          reminder_lead_minutes: next.reminder_lead_minutes,
          quiet_hours: next.quiet_hours,
          timezone: next.timezone,
        }),
      });
      const data = await res.json();
      if (res.ok) setPrefs(data.preferences);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <h3 className="font-extrabold mb-1 flex items-center gap-2">
        <Bell size={17} className="text-primary" /> Notificaciones
        {saving && <Spinner />}
      </h3>
      <p className="text-xs text-muted mb-4">
        Qué te avisamos y con cuánta antelación. El sonido y la vibración los pone tu teléfono, con
        el tono que tengas configurado.
      </p>
      {!prefs ? (
        <Spinner />
      ) : (
        <>
          <div className="space-y-2 mb-4">
            {(Object.keys(KIND_LABELS) as (keyof typeof KIND_LABELS)[]).map((kind) => (
              <label key={kind} className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={prefs.kinds[kind]}
                  onChange={(e) => save({ kinds: { ...prefs.kinds, [kind]: e.target.checked } })}
                  className="accent-primary h-4 w-4"
                />
                <span className="text-soft">{KIND_LABELS[kind]}</span>
              </label>
            ))}
          </div>

          <label className="block mb-4">
            <span className="section-label block mb-1.5">Avisarme con antelación</span>
            <select
              value={prefs.reminder_lead_minutes}
              onChange={(e) => save({ reminder_lead_minutes: Number(e.target.value) })}
              className="w-full bg-bg border border-line rounded-xl px-3.5 py-2.5 text-sm focus:border-primary focus:outline-none"
            >
              <option value={30}>30 minutos antes</option>
              <option value={60}>1 hora antes</option>
              <option value={120}>2 horas antes</option>
              <option value={240}>4 horas antes</option>
              <option value={1440}>1 día antes</option>
            </select>
          </label>

          <div>
            <span className="section-label block mb-1.5">Horas de silencio</span>
            {prefs.quiet_hours ? (
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={prefs.quiet_hours.start}
                  onChange={(e) =>
                    save({ quiet_hours: { ...prefs.quiet_hours!, start: e.target.value } })
                  }
                  className="flex-1 bg-bg border border-line rounded-xl px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
                <span className="text-xs text-muted">a</span>
                <input
                  type="time"
                  value={prefs.quiet_hours.end}
                  onChange={(e) =>
                    save({ quiet_hours: { ...prefs.quiet_hours!, end: e.target.value } })
                  }
                  className="flex-1 bg-bg border border-line rounded-xl px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
                <button
                  onClick={() => save({ quiet_hours: null })}
                  className="text-xs text-muted hover:text-negative font-semibold"
                >
                  Quitar
                </button>
              </div>
            ) : (
              <button
                onClick={() => save({ quiet_hours: { start: '22:00', end: '07:30' } })}
                className="text-xs text-primary font-semibold hover:underline"
              >
                + Definir una ventana de silencio
              </button>
            )}
            <p className="text-[11px] text-muted mt-2">
              Dentro de esa ventana el aviso se guarda en el panel pero no suena en el teléfono.
            </p>
          </div>
        </>
      )}
    </Card>
  );
}

export default function EstrategiaPage() {
  return (
    <div>
      <div className="mb-6">
        <p className="accent-label mb-1">Criterio del agente</p>
        <h1 className="text-xl font-extrabold flex items-center gap-2">
          <Compass size={20} className="text-primary" />
          Estrategia
        </h1>
        <p className="text-sm text-muted mt-1 max-w-2xl">
          Aquí le cuentas al agente cómo quieres operar tu calendario. Es un dato declarado: el
          agente lo usa como criterio para planificar, pero nunca como prueba de que algo funcione
          — eso lo miden tus métricas reales.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <StrategyForm />
        </div>
        <div className="space-y-5">
          <SuccessMetricCard />
          <NotificationPrefsCard />
          <BrandMemoryCard />
        </div>
      </div>
    </div>
  );
}
