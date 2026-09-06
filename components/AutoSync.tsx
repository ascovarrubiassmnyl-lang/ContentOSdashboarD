'use client';

// Refresco automático de las cuentas conectadas y de la publicación programada.
//
// Va montado en el shell de la app, así que corre en todas las pantallas: el
// usuario no tiene que ir a Conexión ni pulsar nada para que los números se
// actualicen. Aquí solo se decide CUÁNDO preguntar; qué cuentas tocan de
// verdad lo decide el servidor (lib/auto-sync.ts), que aplica el intervalo.
//
// Además del sync, dispara el pase de publicación: empuja a Zernio las piezas
// que entran en la ventana de subida y pone al día el estado de las ya
// programadas. Es la red de seguridad del cron — con la app abierta, lo
// pendiente avanza aunque el servicio de cron no esté desplegado.
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';

// Cada cuánto se le pregunta al servidor. Es más frecuente que el intervalo de
// sincronización real a propósito: así, cuando una cuenta cumple su tiempo, se
// refresca enseguida en vez de esperar a la siguiente ronda completa.
const POLL_MS = 5 * 60_000;

// Las vistas que dependen de los datos sincronizados. Al refrescar algo hay
// que invalidarlas; la clave de este propio componente NO está en la lista,
// para no encadenar una sincronización con la siguiente.
const DEPENDENT_KEYS = [
  'accounts',
  'connection',
  'metrics',
  'posts',
  'reports',
  'notifications',
];

export interface AutoSyncReport {
  synced: { id: string; label: string; postsSynced?: number }[];
  failed: { id: string; label: string; error?: string }[];
  fresh: number;
  cooling: number;
  pending: number;
  intervalMinutes: number;
  at: string;
}

interface PublishTick {
  changed: number;
  at: string;
}

export default function AutoSync() {
  const qc = useQueryClient();
  const router = useRouter();
  const lastApplied = useRef<string | null>(null);
  const lastPublish = useRef<string | null>(null);

  const { data } = useQuery<AutoSyncReport>({
    queryKey: ['auto-sync'],
    queryFn: async () => {
      const res = await fetch('/api/accounts/sync', { method: 'POST' });
      if (!res.ok) throw new Error('auto-sync no disponible');
      return res.json();
    },
    refetchInterval: POLL_MS,
    // Volver a la pestaña es la señal más clara de "quiero ver esto ahora".
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    staleTime: POLL_MS,
    // Un fallo puntual (sin sesión, red caída) no debe reintentar en bucle:
    // en POLL_MS vuelve a intentarlo solo.
    retry: false,
  });

  const { data: tick } = useQuery<PublishTick>({
    queryKey: ['publish-tick'],
    queryFn: async () => {
      const res = await fetch('/api/publish/tick', { method: 'POST' });
      if (!res.ok) throw new Error('pase de publicación no disponible');
      return res.json();
    },
    refetchInterval: POLL_MS,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    staleTime: POLL_MS,
    retry: false,
  });

  // Si alguna pieza se empujó o se publicó, el calendario ya no es el que se ve.
  useEffect(() => {
    if (!tick || tick.changed === 0) return;
    if (lastPublish.current === tick.at) return;
    lastPublish.current = tick.at;
    qc.invalidateQueries({ queryKey: ['calendar'] });
    qc.invalidateQueries({ queryKey: ['notifications'] });
    router.refresh();
  }, [tick, qc, router]);

  // Si algo se refrescó de verdad, hay que rehacer lo que se ve en pantalla.
  useEffect(() => {
    if (!data || data.synced.length === 0) return;
    if (lastApplied.current === data.at) return;
    lastApplied.current = data.at;
    for (const key of DEPENDENT_KEYS) {
      qc.invalidateQueries({ queryKey: [key] });
    }
    // Las páginas de servidor (control, resumen) leen sus datos sin React
    // Query: sin esto se quedarían con los números anteriores.
    router.refresh();
  }, [data, qc, router]);

  return null;
}
