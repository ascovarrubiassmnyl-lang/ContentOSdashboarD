import { NextResponse } from 'next/server';
import {
  accountPlatform,
  deleteAccount,
  hasZernioFor,
  readSingletonFor,
  writeSingletonFor,
} from '@/lib/accounts';
import { AUTO_SYNC_MINUTES, isStale } from '@/lib/auto-sync';
import { requireWorkspace } from '@/lib/session';
import { seedIfNeeded, touchSync } from '@/lib/mock';
import { syncFromZernio } from '@/lib/zernio';
import { IgAccount } from '@/types';

// Fuente de datos de la CUENTA ACTIVA: Zernio (Instagram real) si esa cuenta
// tiene API key propia (o hereda la del entorno); si no, demo.
export async function GET() {
  const r = await requireWorkspace();
  if ('error' in r) return r.error;
  const ws = r.ws;
  const real = await hasZernioFor(ws);
  if (!real) await seedIfNeeded(ws);

  let account = await readSingletonFor<IgAccount>(ws, 'account');

  // Primer arranque con Zernio y BD vacía → sincroniza de una vez para
  // que el dashboard nunca aparezca en blanco.
  let syncError: string | null = null;
  if (!account && real) {
    try {
      await syncFromZernio(ws);
      account = await readSingletonFor<IgAccount>(ws, 'account');
    } catch (err) {
      // Antes se tragaba el error en silencio y la cuenta parecía conectada
      // pero sin datos, sin explicación. Ahora se devuelve para que la UI
      // pueda decir exactamente qué falta (p. ej. el add-on de Zernio).
      syncError = (err as Error).message;
    }
  }

  return NextResponse.json({
    account,
    workspace: {
      id: ws.id,
      label: ws.label,
      username: ws.username,
      platform: accountPlatform(ws),
    },
    source: real ? 'zernio' : 'demo',
    demoMode: !real,
    realConnected: real,
    hasData: Boolean(account),
    syncError,
    // La UI dice cada cuánto se refresca sola y si esta cuenta está esperando
    // turno, para que nadie tenga que adivinar si el botón hace falta.
    autoSync: {
      intervalMinutes: AUTO_SYNC_MINUTES,
      lastSyncAt: ws.last_sync_at,
      stale: real && isStale(ws),
    },
  });
}

// Sincronizar ahora (la cuenta activa)
export async function POST() {
  const r = await requireWorkspace();
  if ('error' in r) return r.error;
  const ws = r.ws;
  if (await hasZernioFor(ws)) {
    try {
      const result = await syncFromZernio(ws);
      const account = await readSingletonFor<IgAccount>(ws, 'account');
      return NextResponse.json({ ok: true, account, source: 'zernio', result });
    } catch (err) {
      return NextResponse.json(
        { ok: false, error: `Error sincronizando con Zernio: ${(err as Error).message}` },
        { status: 502 }
      );
    }
  }
  await seedIfNeeded(ws);
  await touchSync(ws);
  const account = await readSingletonFor<IgAccount>(ws, 'account');
  return NextResponse.json({ ok: true, account, source: 'demo' });
}

// Desconectar la cuenta activa: se va del panel con todos sus datos y su API
// key. Antes solo marcaba `connected: false` en el registro interno, así que
// la cuenta seguía listada en Integraciones y parecía que el botón no hacía
// nada. Desconectar es irse: si se quiere volver, se añade otra vez con la key.
export async function DELETE() {
  const r = await requireWorkspace();
  if ('error' in r) return r.error;
  try {
    await deleteAccount(r.ws.id, r.user.id);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 409 });
  }
  return NextResponse.json({ ok: true, disconnected: r.ws.id });
}

// Reconectar una cuenta que quedó marcada como desconectada por una versión
// anterior de la app (hoy desconectar la elimina, así que esto es solo para
// datos antiguos). Reconectar trae datos frescos de una vez: quedarse
// "conectada" pero con los números viejos no le sirve a nadie.
export async function PATCH() {
  const r = await requireWorkspace();
  if ('error' in r) return r.error;
  const ws = r.ws;
  let syncError: string | null = null;
  if (await hasZernioFor(ws)) {
    try {
      await syncFromZernio(ws);
    } catch (err) {
      syncError = (err as Error).message;
    }
  }
  const account = await readSingletonFor<IgAccount>(ws, 'account');
  if (account && !account.connected) {
    account.connected = true;
    await writeSingletonFor(ws, 'account', account);
  }
  return NextResponse.json({ ok: !syncError, account, syncError });
}
