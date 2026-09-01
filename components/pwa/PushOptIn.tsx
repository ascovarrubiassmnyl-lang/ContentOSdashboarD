'use client';

// Activación de notificaciones push.
//
// El permiso DEBE pedirse desde un gesto del usuario (en iOS es obligatorio, y
// en el resto es lo correcto). Por eso esto es un botón y no un efecto que se
// dispare solo al cargar: un prompt de permisos sin contexto se deniega, y una
// denegación es difícil de revertir para el usuario medio.

import { useCallback, useEffect, useState } from 'react';
import { Bell, BellOff, BellRing, Smartphone } from 'lucide-react';
import { Spinner } from '@/components/ui';

type Status =
  | 'cargando'
  | 'no_soportado'
  | 'ios_sin_instalar'
  | 'sin_claves'
  | 'denegado'
  | 'inactivo'
  | 'activo';

// La clave pública viaja en base64url y hay que convertirla a Uint8Array.
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // Safari en iOS expone esto en vez de display-mode.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export default function PushOptIn() {
  const [status, setStatus] = useState<Status>('cargando');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = useCallback(async () => {
    if (typeof window === 'undefined') return;

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      // En iOS el push existe SOLO si la PWA está instalada en la pantalla de
      // inicio. Decirlo es más útil que un "no soportado" que el usuario no
      // puede accionar.
      setStatus(isIos() && !isStandalone() ? 'ios_sin_instalar' : 'no_soportado');
      return;
    }
    if (Notification.permission === 'denied') {
      setStatus('denegado');
      return;
    }

    try {
      const res = await fetch('/api/push');
      const data = await res.json();
      if (!data.configured) {
        setStatus('sin_claves');
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setStatus(sub ? 'activo' : 'inactivo');
    } catch {
      setStatus('inactivo');
    }
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  async function activate() {
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'denegado' : 'inactivo');
        return;
      }

      const res = await fetch('/api/push');
      const data = await res.json();
      if (!data.public_key) throw new Error('El servidor no tiene claves VAPID configuradas.');

      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(data.public_key) as BufferSource,
      });

      const saved = await fetch('/api/push', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!saved.ok) {
        const body = await saved.json();
        throw new Error(body.error ?? 'No se pudo guardar la suscripción.');
      }
      setStatus('activo');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function deactivate() {
    setBusy(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/push', {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setStatus('inactivo');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (status === 'cargando') return null;

  const shell = 'rounded-xl border px-4 py-3 mb-4 text-xs';

  if (status === 'ios_sin_instalar') {
    return (
      <div className={`${shell} border-line bg-bg text-muted`}>
        <p className="font-semibold text-soft flex items-center gap-1.5 mb-1">
          <Smartphone size={13} /> Instala ContentOS en tu iPhone
        </p>
        <p>
          En iOS las notificaciones solo funcionan con la app añadida a la pantalla de inicio:
          Compartir → «Añadir a inicio», y vuelve a entrar desde ahí.
        </p>
      </div>
    );
  }

  if (status === 'no_soportado') {
    return (
      <div className={`${shell} border-line bg-bg text-muted`}>
        Este navegador no soporta notificaciones push. Los avisos siguen apareciendo aquí.
      </div>
    );
  }

  if (status === 'sin_claves') {
    return (
      <div className={`${shell} border-line bg-bg text-muted`}>
        El servidor todavía no tiene claves VAPID, así que no puede enviar notificaciones al
        teléfono. Los avisos siguen apareciendo en este panel.
      </div>
    );
  }

  if (status === 'denegado') {
    return (
      <div className={`${shell} border-negative/30 bg-negative/5 text-soft`}>
        <p className="font-semibold text-negative flex items-center gap-1.5 mb-1">
          <BellOff size={13} /> Notificaciones bloqueadas
        </p>
        <p className="text-muted">
          Las bloqueaste para este sitio. Habilítalas desde los ajustes del navegador y vuelve a
          intentarlo.
        </p>
      </div>
    );
  }

  if (status === 'activo') {
    return (
      <div className={`${shell} border-positive/30 bg-positive/5 flex items-center gap-2`}>
        <BellRing size={14} className="text-positive shrink-0" />
        <span className="text-soft">Este dispositivo recibe avisos.</span>
        <button
          onClick={deactivate}
          disabled={busy}
          className="ml-auto text-muted hover:text-negative font-semibold disabled:opacity-50"
        >
          {busy ? <Spinner /> : 'Desactivar'}
        </button>
      </div>
    );
  }

  return (
    <div className={`${shell} border-primary/30 bg-primary/5`}>
      <p className="font-semibold text-soft flex items-center gap-1.5 mb-1">
        <Bell size={13} className="text-primary" /> Recibe los avisos en el teléfono
      </p>
      <p className="text-muted mb-3">
        Recordatorios de tus piezas programadas, trabajo del agente y alertas — con el sonido de
        notificación de tu dispositivo, aunque tengas la app cerrada.
      </p>
      {error && <p className="text-negative mb-2">{error}</p>}
      <button
        onClick={activate}
        disabled={busy}
        className="px-3 py-1.5 rounded-lg bg-primary text-white font-semibold hover:bg-primary/85 disabled:opacity-50 transition-all flex items-center gap-1.5"
      >
        {busy ? <Spinner /> : <Bell size={13} />} Activar notificaciones
      </button>
    </div>
  );
}
