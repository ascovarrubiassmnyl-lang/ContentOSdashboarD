// Pase de publicación disparado por el navegador, para las cuentas del usuario.
//
// Hace exactamente lo mismo que /api/cron/publish pero autenticado con la
// sesión en vez de con CRON_SECRET, y solo sobre las cuentas de quien pregunta.
//
// Existe porque el cron no puede ser la ÚNICA vía: si el servicio de cron no
// está desplegado, o estuvo caído, una pieza programada a más de la ventana de
// subida se quedaría esperando para siempre. Con esto, basta con que alguien
// abra ContentOS para que lo pendiente se empuje y los estados se pongan al
// día. El cron sigue siendo lo que hace que funcione con la app cerrada.
import { NextResponse } from 'next/server';
import { listAccountsForUser } from '@/lib/accounts';
import { getSessionUser } from '@/lib/auth';
import { PublishTickReport, runPublishTick } from '@/lib/publish';

export const runtime = 'nodejs';

export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const results: PublishTickReport[] = [];
  let changed = 0;
  for (const ws of await listAccountsForUser(user.id)) {
    try {
      const r = await runPublishTick(ws);
      results.push(r);
      changed += r.pushed.length + r.published.length;
    } catch {
      // Una cuenta rota no puede impedir que las demás avancen.
    }
  }
  return NextResponse.json({ ok: true, changed, results, at: new Date().toISOString() });
}
