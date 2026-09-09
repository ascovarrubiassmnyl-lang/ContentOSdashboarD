'use client';

// Publicar — sube un video o imagen UNA vez, elige día, hora y en qué
// perfiles sale (pueden ser de redes distintas), y ContentOS lo publica solo.
// Es la puerta directa: sin campos de calendario editorial de por medio.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format as fmt } from 'date-fns';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Film,
  Image as ImageIcon,
  Rocket,
  Send,
  Trash2,
  Upload,
} from 'lucide-react';
import { Button, Card, EmptyState, Spinner, Textarea } from '@/components/ui';
import {
  AccountAvatar,
  AccountRow,
  PlatformBadge,
  handle,
} from '@/components/layout/AccountSwitcher';
import { CalendarItem, PublishState } from '@/types';
import { cn } from '@/lib/utils';

const ACCEPT = 'video/mp4,video/quicktime,video/webm,image/jpeg,image/png,image/webp';

const STATE_META: Record<PublishState, { label: string; className: string; icon: typeof Clock }> = {
  off: { label: 'Sin publicar', className: 'text-muted border-line', icon: Clock },
  pendiente: {
    label: 'En espera',
    className: 'text-orange border-orange/40 bg-orange/10',
    icon: Clock,
  },
  programado: {
    label: 'Programada',
    className: 'text-primary border-primary/40 bg-primary/10',
    icon: Rocket,
  },
  publicado: {
    label: 'Publicada',
    className: 'text-positive border-positive/40 bg-positive/10',
    icon: CheckCircle2,
  },
  error: {
    label: 'No se pudo publicar',
    className: 'text-pink border-pink/40 bg-pink/10',
    icon: AlertTriangle,
  },
};

type ScheduledItem = CalendarItem & {
  account_label: string;
  account_platform: 'instagram' | 'facebook' | 'tiktok';
  account_color: string;
};

interface BatchResult {
  account_id: string;
  label: string;
  ok: boolean;
  error?: string;
}

// Si el servidor corta la respuesta a medias (timeout, video muy pesado) el
// cuerpo llega vacío y `res.json()` revienta con "Unexpected end of JSON
// input" — un error que no dice nada al usuario. Mejor un objeto vacío y un
// mensaje genérico que se pueda entender.
async function safeJson(res: Response): Promise<{ error?: string; results?: BatchResult[] }> {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

export default function PublicarPage() {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [date, setDate] = useState(() => fmt(new Date(), 'yyyy-MM-dd'));
  const [time, setTime] = useState('12:00');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<BatchResult[] | null>(null);

  const accountsQuery = useQuery<{ accounts: AccountRow[] }>({
    queryKey: ['accounts'],
    queryFn: async () => (await fetch('/api/accounts')).json(),
  });
  const accounts = accountsQuery.data?.accounts ?? [];

  const scheduledQuery = useQuery<{ items: ScheduledItem[] }>({
    queryKey: ['publish-batch'],
    queryFn: async () => (await fetch('/api/publish-batch')).json(),
  });
  const scheduled = scheduledQuery.data?.items ?? [];

  // Vista previa del archivo antes de subirlo. Se libera al cambiarlo o al
  // salir de la página: cada createObjectURL retiene el archivo en memoria.
  const stagedUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (stagedUrl) URL.revokeObjectURL(stagedUrl); }, [stagedUrl]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const submit = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Sube un video o una imagen primero.');
      if (selected.size === 0) throw new Error('Elige al menos un perfil.');
      const scheduled_at = new Date(`${date}T${time}:00`).toISOString();
      const body = new FormData();
      body.append('file', file);
      body.append('caption', caption);
      body.append('scheduled_at', scheduled_at);
      body.append('account_ids', JSON.stringify([...selected]));
      const res = await fetch('/api/publish-batch', { method: 'POST', body });
      const data = await safeJson(res);
      if (!res.ok) {
        throw new Error(
          data.error ??
            'El servidor no respondió (puede ser un video muy pesado o la conexión). Intenta de nuevo, o con un archivo más chico.'
        );
      }
      return data.results as BatchResult[];
    },
    onSuccess: (results) => {
      setError(null);
      setFeedback(results);
      setFile(null);
      setCaption('');
      qc.invalidateQueries({ queryKey: ['publish-batch'] });
    },
    onError: (e: Error) => {
      setFeedback(null);
      setError(e.message);
    },
  });

  const remove = useMutation({
    mutationFn: async ({ id, accountId }: { id: string; accountId: string }) => {
      const res = await fetch(`/api/publish-batch/${id}?account_id=${accountId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await safeJson(res);
        throw new Error(data.error ?? 'No se pudo quitar.');
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['publish-batch'] }),
  });

  return (
    <div>
      <div className="mb-6">
        <p className="accent-label mb-1">Publicación automática</p>
        <h1 className="text-xl font-extrabold flex items-center gap-2">
          <Send size={20} className="text-primary" />
          Publicar
        </h1>
        <p className="text-sm text-muted mt-1 max-w-2xl">
          Sube el video de tu cliente, escribe el texto, elige el día y la hora, y marca en qué
          perfiles sale. Si la fecha es de los próximos días, queda &ldquo;Programada&rdquo; de
          una vez; si es más adelante, se guarda &ldquo;En espera&rdquo; y avanza sola cuando se
          acerca — no hace falta volver a abrir la app.
        </p>
      </div>

      <Card className="mb-6">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setFeedback(null);
            setError(null);
            e.target.value = '';
          }}
        />
        {file ? (
          <div className="flex items-start gap-3 mb-4">
            <div className="h-28 w-20 shrink-0 overflow-hidden rounded-lg border border-line bg-black/40">
              {file.type.startsWith('video') ? (
                <video
                  src={stagedUrl ?? undefined}
                  className="h-full w-full object-cover"
                  controls
                  preload="metadata"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={stagedUrl ?? undefined} alt="" className="h-full w-full object-cover" />
              )}
            </div>
            <div className="min-w-0 flex-1 text-xs">
              <p className="font-bold truncate flex items-center gap-1.5">
                {file.type.startsWith('video') ? <Film size={12} /> : <ImageIcon size={12} />}
                {file.name}
              </p>
              <p className="text-muted mt-0.5">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
              <Button
                variant="ghost"
                className="mt-2 !px-2.5 !py-1.5 !text-xs"
                onClick={() => inputRef.current?.click()}
              >
                Cambiar archivo
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-full mb-4 rounded-xl border border-dashed border-line py-8 text-center text-sm text-muted hover:border-primary/50 hover:text-white transition-colors"
          >
            <Upload size={20} className="inline mr-2 -mt-1" />
            Subir video o imagen
            <span className="block text-xs mt-1.5 opacity-70">
              MP4, MOV o WebM · JPG, PNG o WebP
            </span>
          </button>
        )}

        <Textarea
          label="Texto de la publicación"
          value={caption}
          onChange={setCaption}
          rows={3}
          placeholder="El pie de foto que sale publicado."
        />

        <div className="grid grid-cols-2 gap-3 mb-4">
          <label className="block">
            <span className="section-label block mb-1.5">Día</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-bg border border-line rounded-xl px-3.5 py-2.5 text-sm focus:border-primary focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="section-label block mb-1.5">Hora</span>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full bg-bg border border-line rounded-xl px-3.5 py-2.5 text-sm focus:border-primary focus:outline-none"
            />
          </label>
        </div>

        <div className="mb-4">
          <span className="section-label block mb-1.5">Perfiles donde publicar</span>
          {accountsQuery.isLoading ? (
            <Spinner />
          ) : accounts.length === 0 ? (
            <p className="text-xs text-muted">
              Todavía no conectaste ningún perfil.{' '}
              <a href="/conexion" className="text-primary hover:underline font-semibold">
                Conectar en Integraciones
              </a>
              .
            </p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2">
              {accounts.map((a) => {
                const active = selected.has(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggle(a.id)}
                    className={cn(
                      'flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all',
                      active
                        ? 'border-primary/50 bg-primary/10'
                        : 'border-line bg-bg hover:border-primary/30'
                    )}
                  >
                    <AccountAvatar label={a.label} color={a.color} size={30} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-xs font-bold truncate">
                        <PlatformBadge platform={a.platform} />
                        <span className="truncate">{a.label}</span>
                      </span>
                      <span className="block text-[11px] text-muted truncate">
                        {handle(a.username, a.platform)}
                      </span>
                    </span>
                    <span
                      className={cn(
                        'h-4 w-4 rounded shrink-0 border flex items-center justify-center',
                        active ? 'bg-primary border-primary' : 'border-line'
                      )}
                    >
                      {active && <CheckCircle2 size={12} className="text-white" />}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {error && (
          <p className="mb-3 text-xs text-pink flex items-start gap-1.5">
            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
            {error}
          </p>
        )}
        {feedback && (
          <div className="mb-3 space-y-1">
            {feedback.map((f, i) => (
              <p
                key={i}
                className={cn(
                  'text-xs flex items-start gap-1.5',
                  f.ok ? 'text-positive' : 'text-pink'
                )}
              >
                {f.ok ? (
                  <CheckCircle2 size={12} className="mt-0.5 shrink-0" />
                ) : (
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                )}
                {f.label}: {f.ok ? 'programada' : f.error}
              </p>
            ))}
          </div>
        )}

        <Button onClick={() => submit.mutate()} disabled={submit.isPending}>
          <span className="flex items-center gap-2">
            {submit.isPending ? <Spinner /> : <Rocket size={15} />}
            {submit.isPending ? 'Programando…' : 'Programar publicación'}
          </span>
        </Button>
      </Card>

      <p className="section-label mb-3">Programado</p>
      {scheduledQuery.isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted gap-3">
          <Spinner /> Cargando…
        </div>
      ) : scheduled.length === 0 ? (
        <EmptyState
          icon={<Send size={30} />}
          title="Todavía no programaste nada"
          subtitle="Lo que subas arriba aparece aquí con su estado en cada perfil."
        />
      ) : (
        <div className="space-y-2">
          {scheduled.map((item) => {
            const state: PublishState = item.publish?.state ?? 'off';
            const meta = STATE_META[state];
            const StateIcon = meta.icon;
            const when = new Date(item.scheduled_at);
            return (
              <div
                key={`${item.account_id}-${item.id}`}
                className="flex items-center gap-3 flex-wrap rounded-xl border border-line bg-bg px-3.5 py-3"
              >
                <AccountAvatar label={item.account_label} color={item.account_color} size={34} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold truncate flex items-center gap-2">
                    <PlatformBadge platform={item.account_platform} />
                    {item.account_label}
                  </p>
                  <p className="text-xs text-muted truncate">{item.caption?.trim() || item.title}</p>
                </div>
                <p className="text-xs text-muted whitespace-nowrap">
                  {when.toLocaleDateString('es', { day: '2-digit', month: 'short' })} ·{' '}
                  {when.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                </p>
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-extrabold whitespace-nowrap',
                    meta.className
                  )}
                >
                  <StateIcon size={11} />
                  {meta.label}
                </span>
                {item.publish?.permalink && (
                  <a
                    href={item.publish.permalink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted hover:text-positive"
                    title="Ver la publicación"
                  >
                    <ExternalLink size={14} />
                  </a>
                )}
                {state !== 'publicado' && (
                  <button
                    onClick={() => {
                      if (confirm(`¿Quitar esta pieza de ${item.account_label}?`)) {
                        remove.mutate({ id: item.id, accountId: item.account_id });
                      }
                    }}
                    className="text-muted hover:text-negative"
                    aria-label="Quitar"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
