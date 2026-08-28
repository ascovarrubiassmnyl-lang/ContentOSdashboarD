import { NextResponse } from 'next/server';
import {
  accountPlatform,
  hasZernioFor,
  readSingletonFor,
  writeSingletonFor,
} from '@/lib/accounts';
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

// Desconectar (local — la conexión real se gestiona en el panel de Zernio)
export async function DELETE() {
  const r = await requireWorkspace();
  if ('error' in r) return r.error;
  const ws = r.ws;
  const account = await readSingletonFor<IgAccount>(ws, 'account');
  if (account) {
    account.connected = false;
    await writeSingletonFor(ws, 'account', account);
  }
  return NextResponse.json({ ok: true });
}

// Reconectar
export async function PATCH() {
  const r = await requireWorkspace();
  if ('error' in r) return r.error;
  const ws = r.ws;
  const account = await readSingletonFor<IgAccount>(ws, 'account');
  if (account) {
    account.connected = true;
    account.last_sync_at = new Date().toISOString();
    await writeSingletonFor(ws, 'account', account);
  }
  return NextResponse.json({ ok: true, account });
}
