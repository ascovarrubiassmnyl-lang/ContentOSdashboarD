import { NextResponse } from 'next/server';
import { readSingleton, writeSingleton } from '@/lib/db';
import { seedIfNeeded, touchSync } from '@/lib/mock';
import { hasZernioKey, syncFromZernio } from '@/lib/zernio';
import { IgAccount } from '@/types';

// Fuente de datos: Zernio (Instagram real) si hay API key; si no, demo.
function source(): 'zernio' | 'demo' {
  return hasZernioKey() ? 'zernio' : 'demo';
}

export async function GET() {
  if (source() === 'demo') await seedIfNeeded();
  let account = await readSingleton<IgAccount>('account');

  // Primer arranque con Zernio y BD vacía → sincroniza de una vez para
  // que el dashboard nunca aparezca en blanco.
  if (!account && source() === 'zernio') {
    try {
      await syncFromZernio();
      account = await readSingleton<IgAccount>('account');
    } catch {
      // sin conexión a Zernio en este momento — la UI ofrece "Sincronizar ahora"
    }
  }

  return NextResponse.json({
    account,
    source: source(),
    demoMode: source() === 'demo',
    realConnected: source() === 'zernio',
  });
}

// Sincronizar ahora
export async function POST() {
  if (source() === 'zernio') {
    try {
      const result = await syncFromZernio();
      const account = await readSingleton<IgAccount>('account');
      return NextResponse.json({ ok: true, account, source: 'zernio', result });
    } catch (err) {
      return NextResponse.json(
        { ok: false, error: `Error sincronizando con Zernio: ${(err as Error).message}` },
        { status: 502 }
      );
    }
  }
  await seedIfNeeded();
  await touchSync();
  const account = await readSingleton<IgAccount>('account');
  return NextResponse.json({ ok: true, account, source: 'demo' });
}

// Desconectar (local — la conexión real se gestiona en el panel de Zernio)
export async function DELETE() {
  const account = await readSingleton<IgAccount>('account');
  if (account) {
    account.connected = false;
    await writeSingleton('account', account);
  }
  return NextResponse.json({ ok: true });
}

// Reconectar
export async function PATCH() {
  const account = await readSingleton<IgAccount>('account');
  if (account) {
    account.connected = true;
    account.last_sync_at = new Date().toISOString();
    await writeSingleton('account', account);
  }
  return NextResponse.json({ ok: true, account });
}
