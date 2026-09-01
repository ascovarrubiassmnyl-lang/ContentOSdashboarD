'use client';

// Panel de notificaciones. Hasta la Fase 5 mostraba tres avisos inventados que
// nunca cambiaban; ahora lee el historial real de la cuenta activa, el mismo
// que alimenta los push al teléfono (lib/notifications/emit.ts es el único
// punto de emisión, así que panel y teléfono no pueden contar historias
// distintas).

import { X, Bell, CalendarDays, FileText, Plug, BellOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Spinner } from '@/components/ui';
import PushOptIn from '@/components/pwa/PushOptIn';
import { AppNotification, NotificationKind } from '@/lib/notifications/types';

const KIND_STYLE: Record<NotificationKind, { icon: typeof Bell; cls: string }> = {
  calendar_reminder: { icon: CalendarDays, cls: 'bg-orange/15 text-orange' },
  agent_activity: { icon: FileText, cls: 'bg-primary/15 text-primary' },
  system_alert: { icon: Plug, cls: 'bg-negative/15 text-negative' },
};

// "Hace 5 min" es más legible que una marca de tiempo absoluta para lo
// reciente, que es el 90% de lo que hay en esta bandeja.
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'Ahora mismo';
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'Ayer';
  if (days < 7) return `Hace ${days} días`;
  return new Date(iso).toLocaleDateString('es-MX');
}

export default function NotificationsPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();

  // Prevent scrolling on body when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [open]);

  const { data, isLoading } = useQuery<{ notifications: AppNotification[]; unread: number }>({
    queryKey: ['notifications'],
    queryFn: async () => (await fetch('/api/notifications')).json(),
    // Solo se consulta con el panel abierto: una bandeja cerrada no necesita
    // refrescarse y el push ya avisa por su cuenta.
    enabled: open,
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const notifications = data?.notifications ?? [];

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Slide-over panel */}
      <div
        className={cn(
          'fixed inset-y-0 right-0 z-[70] w-full max-w-sm bg-card border-l border-line shadow-glow flex flex-col transition-transform duration-300 ease-in-out',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <div className="flex items-center gap-2">
            <Bell size={18} className="text-primary" />
            <h2 className="text-base font-extrabold">Notificaciones</h2>
            {(data?.unread ?? 0) > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary text-white">
                {data!.unread}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-muted hover:bg-line/40 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <PushOptIn />

          {isLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted">
              <Spinner /> Cargando…
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-10">
              <BellOff size={24} className="text-muted/40 mx-auto mb-3" />
              <p className="text-sm font-bold text-soft mb-1">Nada por aquí</p>
              <p className="text-xs text-muted">
                Cuando se acerque la hora de una pieza programada o el agente termine un trabajo, te
                avisamos aquí y en tu teléfono.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {notifications.map((n) => {
                const style = KIND_STYLE[n.kind] ?? KIND_STYLE.system_alert;
                const Icon = style.icon;
                return (
                  <a
                    key={n.id}
                    href={n.url || '/'}
                    onClick={onClose}
                    className={cn(
                      'flex gap-4 p-4 rounded-xl border bg-bg transition-colors hover:border-primary/40',
                      n.read_at ? 'border-line opacity-70' : 'border-primary/25'
                    )}
                  >
                    <div
                      className={cn(
                        'h-10 w-10 shrink-0 flex items-center justify-center rounded-xl',
                        style.cls
                      )}
                    >
                      <Icon size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold leading-tight mb-1">{n.title}</p>
                      <p className="text-[12px] text-muted leading-relaxed mb-2">{n.body}</p>
                      <p className="text-[10px] font-semibold text-soft uppercase tracking-wider">
                        {relativeTime(n.created_at)}
                      </p>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-5 border-t border-line bg-bg">
          <Button
            variant="secondary"
            className="w-full text-xs"
            disabled={(data?.unread ?? 0) === 0 || markAllRead.isPending}
            onClick={() => markAllRead.mutate()}
          >
            Marcar todas como leídas
          </Button>
        </div>
      </div>
    </>
  );
}
