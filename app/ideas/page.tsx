'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Circle,
  CheckCircle2,
  Lightbulb,
  Plus,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Tabs } from '@/components/ui';
import { FunnelLevel, Idea } from '@/types';
import { cn } from '@/lib/utils';

const NIVEL_META: Record<
  FunnelLevel,
  { label: string; desc: string; dot: string; text: string; border: string }
> = {
  tofu: {
    label: 'TOFU',
    desc: 'Alcance · audiencia fría',
    dot: 'bg-primary',
    text: 'text-primary',
    border: 'border-primary/40',
  },
  mofu: {
    label: 'MOFU',
    desc: 'Consideración · ya te conocen',
    dot: 'bg-orange',
    text: 'text-orange',
    border: 'border-orange/40',
  },
  bofu: {
    label: 'BOFU',
    desc: 'Conversión · listos para comprar',
    dot: 'bg-pink',
    text: 'text-pink',
    border: 'border-pink/40',
  },
};

const NIVELES: FunnelLevel[] = ['tofu', 'mofu', 'bofu'];

export default function IdeasPage() {
  const qc = useQueryClient();
  const [view, setView] = useState('kanban');
  const [drafts, setDrafts] = useState<Record<FunnelLevel, string>>({
    tofu: '',
    mofu: '',
    bofu: '',
  });

  const { data } = useQuery<{ ideas: Idea[] }>({
    queryKey: ['ideas'],
    queryFn: async () => (await fetch('/api/ideas')).json(),
  });

  const add = useMutation({
    mutationFn: async ({ level, text }: { level: FunnelLevel; text: string }) => {
      const res = await fetch('/api/ideas', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ level, text }),
      });
      if (!res.ok) throw new Error('Error');
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ideas'] }),
  });

  const toggle = useMutation({
    mutationFn: async (idea: Idea) =>
      fetch(`/api/ideas/${idea.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          status: idea.status === 'completada' ? 'pendiente' : 'completada',
        }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ideas'] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => fetch(`/api/ideas/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ideas'] }),
  });

  const submit = (level: FunnelLevel) => {
    const text = drafts[level].trim();
    if (!text) return;
    add.mutate({ level, text });
    setDrafts((d) => ({ ...d, [level]: '' }));
  };

  const byLevel = useMemo(() => {
    const map: Record<FunnelLevel, Idea[]> = { tofu: [], mofu: [], bofu: [] };
    for (const idea of data?.ideas ?? []) {
      if (map[idea.level]) map[idea.level].push(idea);
    }
    for (const lvl of NIVELES) {
      map[lvl].sort((a, b) =>
        a.status === b.status ? 0 : a.status === 'pendiente' ? -1 : 1
      );
    }
    return map;
  }, [data]);

  const counts = (lvl: FunnelLevel) => {
    const list = byLevel[lvl];
    const done = list.filter((i) => i.status === 'completada').length;
    return { total: list.length, done, pending: list.length - done };
  };

  // ── Render helpers (funciones, NO componentes → no pierden foco) ──
  const inputBar = (level: FunnelLevel) => {
    const meta = NIVEL_META[level];
    return (
      <div className="flex items-center gap-2 bg-bg border border-line rounded-xl px-2 py-1.5">
        <input
          value={drafts[level]}
          onChange={(e) => setDrafts((d) => ({ ...d, [level]: e.target.value }))}
          onKeyDown={(e) => e.key === 'Enter' && submit(level)}
          placeholder={`Nueva idea para ${meta.label}… (Enter)`}
          className="flex-1 bg-transparent px-2 py-1 text-sm focus:outline-none placeholder:text-muted/50"
        />
        <button
          onClick={() => submit(level)}
          disabled={!drafts[level].trim()}
          className={cn(
            'h-7 w-7 rounded-lg flex items-center justify-center shrink-0 text-white transition-all disabled:opacity-30 hover:opacity-85',
            meta.dot
          )}
        >
          <Plus size={15} />
        </button>
      </div>
    );
  };

  const ideaItem = (idea: Idea, kanban: boolean) => {
    const done = idea.status === 'completada';
    return (
      <div
        key={idea.id}
        className={cn(
          'group flex items-start gap-2.5 bg-bg border border-line rounded-xl px-3 py-2.5 transition-colors',
          done && 'opacity-55'
        )}
      >
        <button
          onClick={() => toggle.mutate(idea)}
          className={cn(
            'shrink-0 mt-0.5 transition-colors',
            done ? 'text-positive' : 'text-muted hover:text-primary'
          )}
          title={done ? 'Marcar como pendiente' : 'Marcar como completada'}
        >
          {done ? <CheckCircle2 size={16} /> : <Circle size={16} />}
        </button>
        <p className={cn('flex-1 text-sm leading-snug', done && 'line-through text-muted')}>
          {idea.text}
        </p>
        {!kanban && (
          <span
            className={cn(
              'text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0',
              done ? 'bg-positive/15 text-positive' : 'bg-line text-muted'
            )}
          >
            {done ? 'Completada' : 'Pendiente'}
          </span>
        )}
        <button
          onClick={() => remove.mutate(idea.id)}
          className="shrink-0 text-muted hover:text-negative opacity-0 group-hover:opacity-100 transition-opacity mt-0.5"
          title="Eliminar"
        >
          <Trash2 size={13} />
        </button>
      </div>
    );
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <p className="accent-label mb-1">Ideación</p>
          <h1 className="text-xl font-extrabold flex items-center gap-2">
            <Lightbulb size={20} className="text-primary" />
            Banco de ideas
          </h1>
          <p className="text-sm text-muted mt-1">
            Anota ideas de video por etapa del funnel y márcalas cuando las ejecutes.
          </p>
        </div>
        <Tabs
          tabs={[
            { value: 'kanban', label: 'Kanban' },
            { value: 'tabla', label: 'Tabla' },
          ]}
          active={view}
          onChange={setView}
        />
      </div>

      {view === 'kanban' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {NIVELES.map((lvl) => {
            const meta = NIVEL_META[lvl];
            const c = counts(lvl);
            return (
              <div key={lvl} className={cn('card !p-3 border-t-2', meta.border)}>
                <div className="flex items-center gap-2 mb-1 px-1">
                  <span className={cn('h-2.5 w-2.5 rounded-full', meta.dot)} />
                  <h3 className={cn('font-extrabold', meta.text)}>{meta.label}</h3>
                  <span className="text-[11px] text-muted ml-auto">
                    {c.pending} pend · {c.done} hechas
                  </span>
                </div>
                <p className="text-[11px] text-muted px-1 mb-3">{meta.desc}</p>
                <div className="mb-3">{inputBar(lvl)}</div>
                <div className="space-y-2 min-h-[80px]">
                  {byLevel[lvl].length === 0 ? (
                    <p className="text-xs text-muted/60 text-center py-6">
                      Sin ideas todavía. Escribe una arriba ☝️
                    </p>
                  ) : (
                    byLevel[lvl].map((idea) => ideaItem(idea, true))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-6">
          {NIVELES.map((lvl) => {
            const meta = NIVEL_META[lvl];
            const c = counts(lvl);
            return (
              <div key={lvl} className="card">
                <div className="flex items-center gap-2 mb-3">
                  <span className={cn('h-3 w-3 rounded-full', meta.dot)} />
                  <h3 className={cn('font-extrabold', meta.text)}>Ideas para {meta.label}</h3>
                  <span className="text-xs text-muted">· {meta.desc}</span>
                  <span className="text-[11px] text-muted ml-auto">
                    {c.pending} pendientes · {c.done} completadas
                  </span>
                </div>
                <div className="mb-3">{inputBar(lvl)}</div>
                {byLevel[lvl].length === 0 ? (
                  <p className="text-xs text-muted/60 py-4 text-center">
                    Sin ideas todavía para {meta.label}.
                  </p>
                ) : (
                  <div className="space-y-1.5">{byLevel[lvl].map((idea) => ideaItem(idea, false))}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
