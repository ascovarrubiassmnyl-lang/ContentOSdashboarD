'use client';

// Bloque de "publicación automática" dentro del modal de una pieza del
// calendario: el archivo, el texto que sale publicado y el interruptor.
//
// Vive aparte de la página porque tiene su propio ciclo de vida: el archivo se
// sube a la pieza YA GUARDADA, así que mientras la pieza es nueva solo puede
// quedarse en espera y subirse justo después de crearla.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Film,
  Image as ImageIcon,
  Rocket,
  Trash2,
  Upload,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Textarea } from '@/components/ui';
import { CalendarFormat, CalendarItem, PublishState } from '@/types';
import { cn } from '@/lib/utils';

const ACCEPT = 'video/mp4,video/quicktime,video/webm,image/jpeg,image/png,image/webp';

const STATE_META: Record<
  PublishState,
  { label: string; className: string; icon: typeof Clock }
> = {
  off: { label: 'Sin publicar', className: 'text-muted border-line', icon: Clock },
  pendiente: {
    label: 'En espera',
    className: 'text-orange border-orange/40 bg-orange/10',
    icon: Clock,
  },
  programado: {
    label: 'Programada en Zernio',
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

function humanSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

interface Props {
  item: CalendarItem | null; // null mientras la pieza aún no existe
  format: CalendarFormat;
  file: File | null;
  onFile: (f: File | null) => void;
  caption: string;
  onCaption: (v: string) => void;
  auto: boolean;
  onAuto: (v: boolean) => void;
}

export default function PublishBlock({
  item,
  format,
  file,
  onFile,
  caption,
  onCaption,
  auto,
  onAuto,
}: Props) {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  // Vista previa del archivo todavía sin subir. Se libera al cambiarlo: cada
  // createObjectURL retiene el archivo en memoria hasta que se revoca.
  const stagedUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (stagedUrl) URL.revokeObjectURL(stagedUrl); }, [stagedUrl]);

  const media = item?.media ?? null;
  const publish = item?.publish ?? null;
  const state: PublishState = publish?.state ?? 'off';
  const meta = STATE_META[state];
  const StateIcon = meta.icon;

  const isAd = format === 'ad';
  const kind = file ? (file.type.startsWith('video') ? 'video' : 'image') : media?.kind ?? null;

  const removeMedia = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/calendar/${item!.id}/media`, { method: 'DELETE' });
      if (!res.ok) throw new Error('No se pudo quitar el archivo');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar'] }),
  });

  const send = useMutation({
    mutationFn: async (mode: 'now' | 'auto') => {
      const res = await fetch(`/api/calendar/${item!.id}/publish`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? 'No se pudo publicar');
    },
    onSuccess: () => {
      setError(null);
      qc.invalidateQueries({ queryKey: ['calendar'] });
    },
    onError: (e: Error) => setError(e.message),
  });

  if (isAd) {
    return (
      <div className="mb-4 rounded-xl border border-line bg-bg px-3 py-2.5 text-xs text-muted">
        Los anuncios no se publican desde aquí: Meta Ads es otra superficie de la API y
        necesita su propio permiso.
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-xl border border-line bg-bg p-3">
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <span className="section-label">Publicación automática</span>
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-extrabold',
            meta.className
          )}
        >
          <StateIcon size={11} />
          {meta.label}
        </span>
      </div>

      {/* Archivo */}
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          setError(null);
          onFile(f);
          // Permite volver a elegir el mismo archivo después de quitarlo.
          e.target.value = '';
        }}
      />

      {stagedUrl || media ? (
        <div className="flex items-start gap-3 mb-3">
          <div className="h-24 w-16 shrink-0 overflow-hidden rounded-lg border border-line bg-black/40">
            {kind === 'video' ? (
              <video
                src={stagedUrl ?? `/api/calendar/${item!.id}/media`}
                className="h-full w-full object-cover"
                controls
                preload="metadata"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={stagedUrl ?? `/api/calendar/${item!.id}/media`}
                alt=""
                className="h-full w-full object-cover"
              />
            )}
          </div>
          <div className="min-w-0 flex-1 text-xs">
            <p className="font-bold truncate flex items-center gap-1.5">
              {kind === 'video' ? <Film size={12} /> : <ImageIcon size={12} />}
              {file?.name ?? media?.filename}
            </p>
            <p className="text-muted mt-0.5">
              {humanSize(file?.size ?? media?.size ?? 0)}
              {file && ' · se sube al guardar'}
            </p>
            <div className="flex gap-2 mt-2">
              <Button variant="ghost" onClick={() => input.current?.click()}>
                Cambiar
              </Button>
              <Button
                variant="ghost"
                disabled={removeMedia.isPending}
                onClick={() => {
                  if (file) return onFile(null);
                  if (item?.media) removeMedia.mutate();
                }}
              >
                <Trash2 size={12} className="inline mr-1 -mt-0.5" />
                Quitar
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="w-full mb-3 rounded-xl border border-dashed border-line py-4 text-center text-xs text-muted hover:border-primary/50 hover:text-white transition-colors"
        >
          <Upload size={15} className="inline mr-1.5 -mt-0.5" />
          Subir video o imagen
          <span className="block text-[10px] mt-1 opacity-70">
            MP4, MOV o WebM · JPG, PNG o WebP
          </span>
        </button>
      )}

      <Textarea
        label="Texto de la publicación"
        value={caption}
        onChange={onCaption}
        rows={3}
        placeholder="El pie de foto que sale publicado. Si lo dejas vacío se usa el título."
      />

      {/* Interruptor */}
      <button
        type="button"
        onClick={() => onAuto(!auto)}
        className={cn(
          'w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all',
          auto
            ? 'border-positive/40 bg-positive/10'
            : 'border-line bg-bg hover:border-primary/30'
        )}
      >
        <span
          className={cn(
            'h-5 w-9 rounded-full p-0.5 shrink-0 transition-colors',
            auto ? 'bg-positive' : 'bg-line'
          )}
        >
          <span
            className={cn(
              'block h-4 w-4 rounded-full bg-white transition-transform',
              auto && 'translate-x-4'
            )}
          />
        </span>
        <span className="text-xs">
          <span className="block font-extrabold">Publicar sola a esta hora</span>
          <span className="block text-muted mt-0.5">
            ContentOS guarda el archivo y lo manda a Zernio poco antes. No hay que abrir la
            app.
          </span>
        </span>
      </button>

      {/* Estado detallado */}
      {publish?.error && state === 'error' && (
        <div className="mt-2">
          <p className="text-xs text-pink flex items-start gap-1.5">
            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
            {publish.error}
          </p>
          {item && media && (
            <button
              type="button"
              disabled={send.isPending}
              onClick={() => send.mutate('auto')}
              className="mt-1.5 text-[11px] font-bold text-primary hover:underline disabled:opacity-50"
            >
              {send.isPending ? 'Reintentando…' : 'Reintentar ahora'}
            </button>
          )}
        </div>
      )}
      {error && (
        <p className="mt-2 text-xs text-pink flex items-start gap-1.5">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}
      {state === 'pendiente' && (
        <p className="mt-2 text-[11px] text-muted">
          Queda en espera hasta unos días antes de su fecha: los archivos subidos a Zernio
          caducan a los 7 días, así que ContentOS lo guarda hasta entonces.
        </p>
      )}
      {publish?.permalink && (
        <a
          href={publish.permalink}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-positive hover:underline"
        >
          <ExternalLink size={12} />
          Ver la publicación
        </a>
      )}

      {item && (media || file) && state !== 'publicado' && (
        <div className="mt-3 pt-3 border-t border-line">
          <Button
            variant="secondary"
            disabled={send.isPending || Boolean(file)}
            title={file ? 'Guarda primero para subir el archivo' : 'Publicar ahora mismo'}
            onClick={() => {
              if (confirm('¿Publicar esta pieza ahora mismo? Sale de inmediato.')) {
                send.mutate('now');
              }
            }}
          >
            <Rocket size={13} className="inline mr-1.5 -mt-0.5" />
            {send.isPending ? 'Publicando…' : 'Publicar ahora'}
          </Button>
        </div>
      )}
    </div>
  );
}
