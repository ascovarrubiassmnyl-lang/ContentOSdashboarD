'use client';

// Interfaz del Agente OS.
//
// La estructura viene del rediseño que trajo el usuario (hero centrado con el
// input debajo y acciones rápidas en píldoras, que al empezar a conversar se
// convierte en lista de mensajes con el input abajo). La piel es la de
// Content OS: la referencia traía una foto de fondo externa y paleta neutra,
// y esto tiene que parecer parte de la app, no un widget pegado.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowUp,
  BarChart3,
  CalendarDays,
  FileText,
  Link2,
  MessageSquarePlus,
  PenLine,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AgentMessage, AgentThread } from '@/types';
import { MarkdownView } from './markdown';
import ReportsPanel from './ReportsPanel';

// ── Auto-resize del textarea (del rediseño) ──────────────────
function useAutoResizeTextarea({ minHeight, maxHeight }: { minHeight: number; maxHeight: number }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(
    (reset?: boolean) => {
      const el = textareaRef.current;
      if (!el) return;
      el.style.height = `${minHeight}px`;
      if (reset) return;
      el.style.height = `${Math.max(minHeight, Math.min(el.scrollHeight, maxHeight))}px`;
    },
    [minHeight, maxHeight]
  );

  useEffect(() => {
    if (textareaRef.current) textareaRef.current.style.height = `${minHeight}px`;
  }, [minHeight]);

  return { textareaRef, adjustHeight };
}

// ── Traducción de las tools a lenguaje humano ────────────────
// El trazo en vivo solo sirve si se entiende. "get_format_performance" no le
// dice nada a nadie; "comparando formatos" sí.
const TOOL_LABELS: Record<string, string> = {
  get_metrics: 'consultando métricas',
  get_post_breakdown: 'revisando publicaciones',
  get_format_performance: 'comparando formatos',
  get_competitor_signal: 'mirando la competencia',
  get_content_voice_profile: 'midiendo tu voz',
  get_brand_memory: 'recordando tus preferencias',
  get_success_definition: 'viendo tu métrica de éxito',
  list_calendar: 'leyendo el calendario',
  analyze_video_url: 'abriendo el link',
  update_brand_memory: 'guardando una preferencia',
  save_script_draft: 'guardando el guion',
  schedule_calendar_item: 'agendando en el calendario',
  move_calendar_item: 'moviendo el item',
};

interface TraceStep {
  tool: string;
  label: string;
  done: boolean;
  n: number | null;
  error: string | null;
}

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

const QUICK_ACTIONS: { icon: typeof Sparkles; label: string; prompt: string }[] = [
  {
    icon: BarChart3,
    label: '¿Cómo va la semana?',
    prompt: '¿Cómo va la cuenta esta semana comparada con la anterior?',
  },
  {
    icon: Sparkles,
    label: 'Qué formato funciona',
    prompt: '¿Qué formato me está funcionando mejor en los últimos 30 días y por qué lo dices?',
  },
  {
    icon: PenLine,
    label: 'Escribir un guion',
    prompt: 'Escríbeme un guion de reel para esta semana, en mi voz.',
  },
  {
    icon: Users,
    label: 'Ver competencia',
    prompt: '¿Qué sabemos de mis competidores registrados y qué tan viejos son esos datos?',
  },
  {
    icon: CalendarDays,
    label: 'Plan de la semana',
    prompt: '¿Qué tengo en el calendario esta semana y qué falta por llenar?',
  },
  {
    icon: Link2,
    label: 'Analizar un link',
    prompt: 'Mira este reel y dime cómo está construido: ',
  },
];

export default function Chat() {
  const qc = useQueryClient();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [trace, setTrace] = useState<TraceStep[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showReports, setShowReports] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const { textareaRef, adjustHeight } = useAutoResizeTextarea({ minHeight: 52, maxHeight: 200 });
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: history } = useQuery<{ threads: (AgentThread & { last_at: string })[] }>({
    queryKey: ['agent-threads'],
    queryFn: async () => (await fetch('/api/agent/threads')).json(),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, trace]);

  async function openThread(id: string) {
    setShowHistory(false);
    const res = await fetch(`/api/agent/threads?thread_id=${encodeURIComponent(id)}`);
    const data = (await res.json()) as { messages: AgentMessage[] };
    setThreadId(id);
    setMessages(data.messages.map((m) => ({ role: m.role, content: m.content })));
    setTrace([]);
    setError(null);
  }

  async function deleteThread(id: string) {
    await fetch(`/api/agent/threads?thread_id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    qc.invalidateQueries({ queryKey: ['agent-threads'] });
    if (id === threadId) newThread();
  }

  function newThread() {
    setThreadId(null);
    setMessages([]);
    setTrace([]);
    setError(null);
    setShowHistory(false);
  }

  async function send(text: string) {
    const clean = text.trim();
    if (!clean || busy) return;

    setMessages((m) => [...m, { role: 'user', content: clean }]);
    setInput('');
    adjustHeight(true);
    setTrace([]);
    setError(null);
    setBusy(true);

    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ thread_id: threadId ?? undefined, message: clean, stream: true }),
      });

      // Los errores de autorización y de validación llegan como JSON normal,
      // antes de que empiece el stream.
      if (!res.ok || !res.body) {
        const detail = await res.text();
        throw new Error(detail.slice(0, 300) || `El servidor respondió ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Los eventos SSE se separan por línea en blanco. Lo que quede sin
        // cerrar se guarda para el siguiente chunk.
        const chunks = buffer.split('\n\n');
        buffer = chunks.pop() ?? '';

        for (const chunk of chunks) {
          const eventLine = chunk.split('\n').find((l) => l.startsWith('event: '));
          const dataLine = chunk.split('\n').find((l) => l.startsWith('data: '));
          if (!eventLine || !dataLine) continue;
          const event = eventLine.slice(7).trim();
          let data: Record<string, unknown>;
          try {
            data = JSON.parse(dataLine.slice(6));
          } catch {
            continue;
          }

          if (event === 'thread') {
            setThreadId(data.thread_id as string);
          } else if (event === 'tool_start') {
            const tool = data.tool as string;
            setTrace((t) => [
              ...t,
              {
                tool,
                label: TOOL_LABELS[tool] ?? tool,
                done: false,
                n: null,
                error: null,
              },
            ]);
          } else if (event === 'tool_end') {
            setTrace((t) => {
              const next = [...t];
              // Cierra el último paso abierto de esa tool: en una ronda puede
              // haber varias llamadas a la misma.
              for (let i = next.length - 1; i >= 0; i--) {
                if (next[i].tool === data.tool && !next[i].done) {
                  next[i] = {
                    ...next[i],
                    done: true,
                    n: (data.n as number | null) ?? null,
                    error: (data.error as string | null) ?? null,
                  };
                  break;
                }
              }
              return next;
            });
          } else if (event === 'answer') {
            setMessages((m) => [...m, { role: 'assistant', content: data.reply_md as string }]);
            setTrace([]);
            qc.invalidateQueries({ queryKey: ['agent-threads'] });
          } else if (event === 'error') {
            setError(data.message as string);
          }
        }
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const empty = messages.length === 0;

  // ── Caja de entrada (misma en el hero y anclada abajo) ──
  const composer = (
    <div className="w-full">
      <div className="relative card p-0 overflow-hidden focus-within:border-primary/50 focus-within:shadow-glow transition-all">
        <textarea
          ref={textareaRef}
          value={input}
          disabled={busy}
          onChange={(e) => {
            setInput(e.target.value);
            adjustHeight();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          placeholder="Pregunta por tus métricas, pide un guion, o pega el link de un reel…"
          rows={1}
          className="w-full resize-none bg-transparent px-4 pt-4 pb-2 text-sm text-soft placeholder:text-muted/60 focus:outline-none"
          style={{ overflow: 'hidden' }}
        />
        <div className="flex items-center justify-between px-3 pb-3">
          <p className="text-[11px] text-muted pl-1">
            <kbd className="text-[10px] font-semibold">Enter</kbd> envía ·{' '}
            <kbd className="text-[10px] font-semibold">Shift+Enter</kbd> salto de línea
          </p>
          <button
            onClick={() => send(input)}
            disabled={busy || input.trim().length === 0}
            aria-label="Enviar"
            className={cn(
              'h-9 w-9 rounded-xl flex items-center justify-center transition-all',
              busy || input.trim().length === 0
                ? 'bg-line text-muted cursor-not-allowed'
                : 'bg-primary text-white hover:bg-primary/85 shadow-[0_4px_20px_rgba(124,124,245,0.35)]'
            )}
          >
            <ArrowUp size={16} />
          </button>
        </div>
      </div>
      <p className="text-[11px] text-muted/70 mt-2 text-center">
        Toda cifra que reporte viene de tus datos reales y lleva su tamaño de muestra. Nada se
        publica en Instagram.
      </p>
    </div>
  );

  return (
    <div className="relative flex flex-col h-[calc(100dvh-6.5rem)] md:h-[calc(100vh-3.5rem)]">
      {/* Resplandor de marca: sustituye la foto de fondo de la referencia */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-24 h-72 opacity-60"
        style={{
          background:
            'radial-gradient(60% 100% at 50% 0%, rgba(124,124,245,0.18) 0%, rgba(236,91,154,0.07) 45%, transparent 75%)',
        }}
      />

      {/* ── Encabezado ── */}
      <header className="relative flex items-center justify-between gap-3 pb-4 border-b border-line shrink-0">
        <div className="min-w-0">
          <p className="accent-label mb-0.5">Inteligencia</p>
          <h1 className="text-xl font-extrabold truncate">Agente OS</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative">
            <button
              onClick={() => setShowHistory((v) => !v)}
              className="h-9 px-3 rounded-xl border border-line text-xs font-semibold text-soft hover:border-primary/50 hover:text-white transition-all"
            >
              Historial
            </button>
            {showHistory && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowHistory(false)} />
                <div className="absolute right-0 top-11 z-50 w-72 card p-2 max-h-80 overflow-y-auto">
                  {(history?.threads ?? []).length === 0 ? (
                    <p className="text-xs text-muted px-3 py-4 text-center">
                      Todavía no hay conversaciones.
                    </p>
                  ) : (
                    history!.threads.map((t) => (
                      <div key={t.id} className="flex items-center gap-1 group">
                        <button
                          onClick={() => openThread(t.id)}
                          className={cn(
                            'flex-1 text-left px-3 py-2 rounded-lg text-xs transition-all min-w-0',
                            t.id === threadId
                              ? 'bg-primary/15 text-white'
                              : 'text-soft hover:bg-line/50'
                          )}
                        >
                          <span className="block truncate font-medium">
                            {t.title ?? 'Conversación'}
                          </span>
                          <span className="block text-[10px] text-muted mt-0.5">
                            {new Date(t.last_at).toLocaleDateString('es-CO')}
                          </span>
                        </button>
                        <button
                          onClick={() => deleteThread(t.id)}
                          aria-label="Borrar conversación"
                          className="h-7 w-7 rounded-lg flex items-center justify-center text-muted opacity-0 group-hover:opacity-100 hover:text-negative transition-all shrink-0"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
          <button
            onClick={() => setShowReports(true)}
            className="h-9 px-3 rounded-xl border border-line text-xs font-semibold text-soft hover:border-primary/50 hover:text-white transition-all flex items-center gap-1.5"
          >
            <FileText size={14} />
            <span className="hidden sm:inline">Reportes</span>
          </button>
          <button
            onClick={newThread}
            disabled={empty && !threadId}
            className="h-9 px-3 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary/85 disabled:opacity-40 transition-all flex items-center gap-1.5"
          >
            <MessageSquarePlus size={14} />
            <span className="hidden sm:inline">Nueva</span>
          </button>
        </div>
      </header>

      {empty ? (
        /* ── Estado inicial: hero centrado (del rediseño) ── */
        <div className="relative flex-1 flex flex-col items-center justify-center overflow-y-auto py-8">
          <div className="w-full max-w-3xl">
            <div className="text-center mb-8">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 border border-primary/30 mb-4">
                <Sparkles size={22} className="text-primary" />
              </div>
              <h2 className="text-3xl font-extrabold tracking-tight">
                ¿Qué miramos <span className="text-primary">hoy</span>?
              </h2>
              <p className="mt-2 text-sm text-muted max-w-lg mx-auto">
                Conoce tus métricas reales, tu voz y tu calendario. Pregúntale con lenguaje normal.
              </p>
            </div>

            {composer}

            <div className="flex items-center justify-center flex-wrap gap-2 mt-7">
              {QUICK_ACTIONS.map((a) => {
                const Icon = a.icon;
                // "Analizar un link" no se envía sola: necesita que el usuario
                // pegue la URL, así que solo rellena el campo.
                const needsInput = a.prompt.endsWith(': ');
                return (
                  <button
                    key={a.label}
                    onClick={() => {
                      if (needsInput) {
                        setInput(a.prompt);
                        textareaRef.current?.focus();
                        adjustHeight();
                      } else {
                        send(a.prompt);
                      }
                    }}
                    className="flex items-center gap-2 rounded-full border border-line bg-card px-3.5 py-2 text-xs text-soft hover:border-primary/50 hover:text-white transition-all"
                  >
                    <Icon size={14} className="text-primary" />
                    {a.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* ── Conversación ── */
        <>
          <div className="relative flex-1 overflow-y-auto py-6">
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.map((m, i) =>
                m.role === 'user' ? (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary/15 border border-primary/25 px-4 py-3 text-sm text-white whitespace-pre-wrap">
                      {m.content}
                    </div>
                  </div>
                ) : (
                  <div key={i} className="flex gap-3">
                    <div className="h-8 w-8 shrink-0 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
                      <Sparkles size={14} className="text-primary" />
                    </div>
                    <div className="min-w-0 flex-1 card p-4">
                      <MarkdownView md={m.content} />
                    </div>
                  </div>
                )
              )}

              {(busy || trace.length > 0) && (
                <div className="flex gap-3">
                  <div className="h-8 w-8 shrink-0 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
                    <Sparkles size={14} className="text-primary animate-pulse" />
                  </div>
                  <div className="min-w-0 flex-1 card p-4 space-y-1.5">
                    {trace.length === 0 ? (
                      <p className="text-xs text-muted">Pensando…</p>
                    ) : (
                      trace.map((s, i) => (
                        <p key={i} className="text-xs flex items-center gap-2">
                          <span
                            className={cn(
                              'h-1.5 w-1.5 rounded-full shrink-0',
                              s.error
                                ? 'bg-negative'
                                : s.done
                                  ? 'bg-positive'
                                  : 'bg-primary animate-pulse'
                            )}
                          />
                          <span className={s.done ? 'text-muted' : 'text-soft'}>{s.label}</span>
                          {/* El n en vivo: se ve sobre cuántas piezas está
                              hablando antes de leer la conclusión. */}
                          {s.n !== null && (
                            <span className="text-[10px] text-muted">n={s.n}</span>
                          )}
                          {s.error && (
                            <span className="text-[10px] text-negative truncate">{s.error}</span>
                          )}
                        </p>
                      ))
                    )}
                  </div>
                </div>
              )}

              {error && (
                <div className="max-w-3xl mx-auto rounded-xl border border-negative/30 bg-negative/10 px-4 py-3">
                  <p className="text-xs font-semibold text-negative mb-1">El agente no respondió</p>
                  <p className="text-xs text-soft">{error}</p>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          </div>

          <div className="relative shrink-0 pt-3 pb-1 border-t border-line">
            <div className="max-w-3xl mx-auto">{composer}</div>
          </div>
        </>
      )}

      {showReports && <ReportsPanel onClose={() => setShowReports(false)} />}
    </div>
  );
}
