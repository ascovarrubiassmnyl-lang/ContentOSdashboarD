'use client';

// Campana con contador de no leídas. Estaba duplicada como botón suelto en
// /resumen y /control; ahora es un solo componente para que el badge no viva
// en un sitio y falte en el otro.

import { Bell } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

export default function NotificationsBell({ onClick }: { onClick: () => void }) {
  const { data } = useQuery<{ unread: number }>({
    queryKey: ['notifications-unread'],
    queryFn: async () => (await fetch('/api/notifications')).json(),
    // Un minuto: el aviso real llega por push; esto solo mantiene el badge
    // razonablemente al día sin machacar el servidor.
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const unread = data?.unread ?? 0;

  return (
    <button
      onClick={onClick}
      aria-label={unread > 0 ? `Notificaciones (${unread} sin leer)` : 'Notificaciones'}
      className="relative h-10 w-10 rounded-full bg-card border border-line flex items-center justify-center text-muted hover:border-primary/50 hover:text-white transition-all"
    >
      <Bell size={18} />
      {unread > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center border-2 border-bg">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </button>
  );
}
