'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Database,
  Download,
  FileText,
  Mic,
  MessageCircle,
  Phone,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  Upload,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import {
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  Select,
  Spinner,
  Tabs,
  Textarea,
} from '@/components/ui';
import { Source, SourceType } from '@/types';
import { cn, relativeTime } from '@/lib/utils';

const TYPE_META: Record<SourceType, { label: string; icon: typeof Mic; color: string }> = {
  transcripcion: { label: 'Transcripción', icon: Mic, color: 'text-primary bg-primary/10' },
  dm: { label: 'DM', icon: MessageCircle, color: 'text-pink bg-pink/10' },
  llamada: { label: 'Llamada', icon: Phone, color: 'text-orange bg-orange/10' },
  comentario: { label: 'Comentario', icon: MessageCircle, color: 'text-positive bg-positive/10' },
  objecion: { label: 'Objeción', icon: ShieldAlert, color: 'text-negative bg-negative/10' },
  documento: { label: 'Documento', icon: FileText, color: 'text-orange bg-orange/10' },
};

const ACCEPTED = '.pdf,.docx,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.webp,.gif';

function humanSize(bytes?: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function FuentesPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<'texto' | 'archivo'>('texto');
  const [form, setForm] = useState({
    type: 'transcripcion',
    title: '',
    content: '',
    tags: '',
  });
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetModal = () => {
    setModalOpen(false);
    setMode('texto');
    setFile(null);
    setForm({ type: 'transcripcion', title: '', content: '', tags: '' });
  };

  const { data, isLoading } = useQuery<{ sources: Source[] }>({
    queryKey: ['sources'],
    queryFn: async () => (await fetch('/api/sources')).json(),
  });

  const create = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/sources', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: form.type,
          title: form.title,
          content: form.content,
          tags: form.tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Error');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sources'] });
      resetModal();
    },
  });

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Selecciona un archivo');
      const fd = new FormData();
      fd.append('file', file);
      fd.append('type', form.type === 'transcripcion' ? 'documento' : form.type);
      fd.append('title', form.title);
      fd.append('tags', form.tags);
      const res = await fetch('/api/sources/upload', { method: 'POST', body: fd });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Error subiendo el archivo');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sources'] });
      resetModal();
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => fetch(`/api/sources/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sources'] }),
  });

  const sources = useMemo(() => {
    let rows = data?.sources ?? [];
    if (filter !== 'all') rows = rows.filter((s) => s.type === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.content.toLowerCase().includes(q) ||
          s.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return rows;
  }, [data, filter, search]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <p className="accent-label mb-1">Materia prima</p>
          <h1 className="text-xl font-extrabold">Banco de fuentes</h1>
          <p className="text-sm text-muted mt-1">
            Transcripciones, DMs, objeciones y <strong>documentos (PDF, Word, imágenes)</strong>{' '}
            — el generador se vuelve más inteligente con todo lo que anexes aquí.
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus size={14} className="inline mr-1.5 -mt-0.5" />
          Nueva fuente
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <Tabs
          tabs={[
            { value: 'all', label: 'Todas' },
            { value: 'documento', label: 'Documentos' },
            { value: 'transcripcion', label: 'Transcripciones' },
            { value: 'dm', label: 'DMs' },
            { value: 'llamada', label: 'Llamadas' },
            { value: 'comentario', label: 'Comentarios' },
            { value: 'objecion', label: 'Objeciones' },
          ]}
          active={filter}
          onChange={setFilter}
        />
        <div className="relative flex-1 min-w-[200px] max-w-xs ml-auto">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título, contenido o tag…"
            className="w-full bg-card border border-line rounded-xl pl-9 pr-3 py-2 text-sm focus:border-primary focus:outline-none placeholder:text-muted/50"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      ) : sources.length === 0 ? (
        <EmptyState
          icon={<Database size={36} />}
          title="Sin fuentes cargadas para esta cuenta"
          subtitle="Añade transcripciones, DMs u objeciones reales. El generador las usará como contexto."
          action={
            <Button onClick={() => setModalOpen(true)}>
              <Plus size={14} className="inline mr-1.5 -mt-0.5" />
              Nueva fuente
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-12 gap-4">
          {sources.map((s) => {
            const meta = TYPE_META[s.type];
            const Icon = meta.icon;
            return (
              <Card key={s.id} className="col-span-12 md:col-span-6 xl:col-span-4 flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-1 rounded-lg',
                      meta.color
                    )}
                  >
                    <Icon size={12} />
                    {meta.label}
                  </span>
                  <button
                    onClick={() => remove.mutate(s.id)}
                    className="text-muted hover:text-negative transition-colors"
                    title="Eliminar fuente"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <h3 className="font-bold text-sm mb-2">{s.title}</h3>

                {s.file_url && (
                  <a
                    href={s.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-bg border border-line rounded-lg px-2.5 py-2 mb-2 hover:border-primary/50 transition-colors group"
                  >
                    <FileText size={14} className="text-orange shrink-0" />
                    <span className="text-[11px] font-semibold truncate flex-1 group-hover:text-primary">
                      {s.file_name}
                    </span>
                    <span className="text-[10px] text-muted shrink-0">
                      {humanSize(s.file_size)}
                    </span>
                    <Download size={12} className="text-muted shrink-0" />
                  </a>
                )}

                <p className="text-xs text-muted leading-relaxed line-clamp-4 flex-1">
                  {s.content}
                </p>

                {s.extract_note && (
                  <div className="flex items-start gap-1.5 mt-2 bg-orange/5 border border-orange/20 rounded-lg px-2 py-1.5">
                    <AlertCircle size={11} className="text-orange shrink-0 mt-0.5" />
                    <span className="text-[10px] text-orange/90 leading-tight">
                      {s.extract_note}
                    </span>
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5 mt-3">
                  {s.tags.map((t) => (
                    <span
                      key={t}
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-line text-soft"
                    >
                      #{t}
                    </span>
                  ))}
                  <span className="text-[10px] text-muted ml-auto">
                    {relativeTime(s.created_at)}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={resetModal} title="Nueva fuente">
        <div className="mb-4">
          <Tabs
            tabs={[
              { value: 'texto', label: '✍️ Texto' },
              { value: 'archivo', label: '📎 Archivo' },
            ]}
            active={mode}
            onChange={(v) => setMode(v as 'texto' | 'archivo')}
          />
        </div>

        <Select
          label="Tipo"
          value={form.type}
          onChange={(v) => setForm({ ...form, type: v })}
          options={Object.entries(TYPE_META).map(([value, m]) => ({
            value,
            label: m.label,
          }))}
        />
        <Input
          label={mode === 'archivo' ? 'Título (opcional — usa el nombre del archivo)' : 'Título'}
          value={form.title}
          onChange={(v) => setForm({ ...form, title: v })}
          placeholder="Ej: Guía de marca, transcripción de webinar…"
        />

        {mode === 'texto' ? (
          <Textarea
            label="Contenido"
            value={form.content}
            onChange={(v) => setForm({ ...form, content: v })}
            placeholder="Pega aquí la transcripción, el DM o el comentario textual…"
            rows={6}
          />
        ) : (
          <div className="mb-4">
            <span className="section-label block mb-1.5">Archivo</span>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED}
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'w-full border border-dashed rounded-xl px-4 py-8 flex flex-col items-center justify-center gap-2 transition-colors',
                file
                  ? 'border-primary/50 bg-primary/5'
                  : 'border-line hover:border-primary/40 bg-bg'
              )}
            >
              {file ? (
                <>
                  <FileText size={22} className="text-primary" />
                  <span className="text-sm font-semibold">{file.name}</span>
                  <span className="text-[11px] text-muted">
                    {humanSize(file.size)} · clic para cambiar
                  </span>
                </>
              ) : (
                <>
                  <Upload size={22} className="text-muted" />
                  <span className="text-sm font-semibold text-soft">
                    Clic para elegir un archivo
                  </span>
                  <span className="text-[11px] text-muted">
                    PDF, Word, TXT, CSV, imágenes · máx 15 MB
                  </span>
                </>
              )}
            </button>
            <p className="text-[11px] text-muted mt-2 leading-relaxed">
              Extraigo el texto del archivo y lo guardo como contexto. El generador lo usará
              para escribir con esta información.
            </p>
          </div>
        )}

        <Input
          label="Tags (separados por coma)"
          value={form.tags}
          onChange={(v) => setForm({ ...form, tags: v })}
          placeholder="marca, guía, hooks"
        />

        {(create.isError || upload.isError) && (
          <p className="text-xs text-negative mb-3">
            {((create.error ?? upload.error) as Error)?.message}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={resetModal}>
            Cancelar
          </Button>
          {mode === 'texto' ? (
            <Button
              onClick={() => create.mutate()}
              disabled={create.isPending || form.title.length < 3 || form.content.length < 10}
            >
              {create.isPending ? 'Guardando…' : 'Guardar fuente'}
            </Button>
          ) : (
            <Button onClick={() => upload.mutate()} disabled={upload.isPending || !file}>
              {upload.isPending ? (
                <span className="flex items-center gap-2">
                  <Spinner /> Subiendo y extrayendo texto…
                </span>
              ) : (
                'Subir y procesar'
              )}
            </Button>
          )}
        </div>
      </Modal>
    </div>
  );
}
