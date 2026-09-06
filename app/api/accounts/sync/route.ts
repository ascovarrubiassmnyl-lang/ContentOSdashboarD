import { NextRequest, NextResponse } from 'next/server';
import { AUTO_SYNC_MINUTES, autoSyncUser } from '@/lib/auto-sync';
import { getSessionUser } from '@/lib/auth';

// Sincronización automática de TODAS las cuentas del usuario. La dispara el
// cliente sola (al abrir la app, al volver a la pestaña y cada pocos minutos):
// el servidor decide qué cuentas están viejas de verdad, así que llamarlo de
// más no castiga a Zernio.
//
//   POST /api/accounts/sync          → refresca solo lo que toca
//   POST /api/accounts/sync?force=1  → refresca todo ya (botón manual)
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const force = ['1', 'true'].includes(
    (req.nextUrl.searchParams.get('force') ?? '').toLowerCase()
  );

  const report = await autoSyncUser(user.id, {
    force,
    // Forzando, el usuario está esperando delante: se refrescan todas.
    max: force ? 20 : undefined,
  });

  return NextResponse.json({ ok: report.failed.length === 0, ...report });
}

// Estado de la sincronización automática, sin ejecutar nada.
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  return NextResponse.json({ intervalMinutes: AUTO_SYNC_MINUTES });
}
