'use client';

import { useMutation } from '@tanstack/react-query';
import { ArrowUp, Check, Copy, Database, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Spinner } from '@/components/ui';
import { cn } from '@/lib/utils';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTIONS = [
  'Un reel sobre por qué la disciplina le gana a la motivación',
  'Carrusel con 5 errores que matan el alcance de tus reels',
  'Un reel de ventas para invitar a mi comunidad',
  'Una historia con encuesta para activar a mi audiencia',
];

// Render mínimo de Markdown (negritas, saltos de línea)
function renderMarkdown(md: string): string {
  return md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-bold">$1</strong>')
    .replace(/^### (.*)$/gm, '<p class="font-extrabold text-primary mt-3 mb-1">$1</p>')
    .replace(/\n/g, '<br/>');
}

function AssistantBubble({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(content.replace(/\*\*/g, ''));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="group flex gap-3 max-w-3xl">
      <span className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary to-pink flex items-center justify-center shrink-0 text-white">
        <Sparkles size={15} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="card p-4 text-sm leading-relaxed text-soft">
          <div dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }} />
        </div>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 text-[11px] font-semibold text-muted hover:text-primary mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copiado' : 'Copiar guion'}
        </button>
      </div>
    </div>
  );
}

export default function GeneradorPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const send = useMutation({
    mutationFn: async (text: string) => {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: text, history }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Error generando');
      return (await res.json()).reply as string;
    },
    onSuccess: (reply) => {
      setMessages((m) => [...m, { id: crypto.randomUUID(), role: 'assistant', content: reply }]);
    },
    onError: (err) => {
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `⚠️ ${(err as Error).message}`,
        },
      ]);
    },
  });

  const submit = (text: string) => {
    const t = text.trim();
    if (!t || send.isPending) return;
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: 'user', content: t }]);
    setInput('');
    send.mutate(t);
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, send.isPending]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit(input);
    }
  };

  const autoGrow = () => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
  };
  useEffect(autoGrow, [input]);

  const empty = messages.length === 0;

  return (
    // Altura: en móvil descuenta la barra superior (dvh evita saltos con la
    // barra del navegador); en desktop, el padding del layout.
    <div className="flex flex-col h-[calc(100dvh-6.5rem)] md:h-[calc(100vh-3.5rem)]">
      {/* Header */}
      <div className="mb-4 shrink-0">
        <p className="accent-label mb-1">IA con tus datos</p>
        <h1 className="text-xl font-extrabold">Generador de contenido</h1>
        <p className="text-sm text-muted mt-1 flex items-center gap-1.5">
          <Database size={13} className="text-primary" />
          Escribe qué guion necesitas — uso tus métricas reales y todo tu banco de fuentes.
        </p>
      </div>

      {/* Chat */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-5 pr-1">
        {empty ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <span className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-pink flex items-center justify-center text-white shadow-glow mb-4">
              <Sparkles size={26} />
            </span>
            <h2 className="font-extrabold text-lg mb-1">¿Qué guion necesitas hoy?</h2>
            <p className="text-sm text-muted max-w-md mb-6">
              Descríbelo con tus palabras. Escribo el guion usando tus hooks que funcionaron,
              tu retención real y todo tu banco de fuentes.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 w-full max-w-2xl">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => submit(s)}
                  className="card card-glow text-left text-sm p-3.5 text-soft hover:text-white"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) =>
            m.role === 'user' ? (
              <div key={m.id} className="flex justify-end">
                <div className="bg-primary/15 border border-primary/30 rounded-2xl rounded-br-md px-4 py-2.5 text-sm max-w-lg">
                  {m.content}
                </div>
              </div>
            ) : (
              <AssistantBubble key={m.id} content={m.content} />
            )
          )
        )}
        {send.isPending && (
          <div className="flex gap-3 max-w-3xl">
            <span className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary to-pink flex items-center justify-center shrink-0 text-white">
              <Sparkles size={15} />
            </span>
            <div className="card p-4 flex items-center gap-2 text-sm text-muted">
              <Spinner /> Escribiendo tu guion…
            </div>
          </div>
        )}
      </div>

      {/* Barra de escritura */}
      <div className="shrink-0 pt-4">
        <div className="card !p-2 flex items-end gap-2 focus-within:border-primary/50 transition-colors">
          <textarea
            ref={taRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            rows={1}
            placeholder="Describe el guion que necesitas… (Enter para enviar, Shift+Enter para salto de línea)"
            className="flex-1 bg-transparent resize-none px-3 py-2 text-sm focus:outline-none placeholder:text-muted/60 max-h-40"
          />
          <button
            onClick={() => submit(input)}
            disabled={!input.trim() || send.isPending}
            className="h-9 w-9 rounded-xl bg-primary text-white flex items-center justify-center shrink-0 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-primary/85 transition-colors"
          >
            <ArrowUp size={17} />
          </button>
        </div>
        <p className="text-[11px] text-muted text-center mt-2">
          El generador usa todo tu banco de fuentes por defecto.
        </p>
      </div>
    </div>
  );
}
