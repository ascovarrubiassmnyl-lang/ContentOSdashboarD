import { NextRequest, NextResponse } from 'next/server';
import { listAccounts } from '@/lib/accounts';
import { refreshCompetitors } from '@/lib/competitors/refresh';

// Cron de competencia: refresca las observaciones de los competidores de cada
// cuenta. Mismo patrón de auth y tolerancia a fallos que los otros crones.
//
// Que falle es esperable (Instagram bloquea): por eso `ok` refleja solo si el
// proceso corrió, y el detalle por competidor va en `results`. Un competidor
// bloqueado no debe marcar la ejecución entera como rota en el panel del
// scheduler, o el cron acabaría en rojo permanente y nadie miraría los que sí
// importan.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'CRON_SECRET no está configurado en el servidor' },
      { status: 503 }
    );
  }
  const provided =
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
    req.nextUrl.searchParams.get('secret');
  if (provided !== secret) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const started = Date.now();
  const accounts = await listAccounts();
  const results: Record<string, unknown>[] = [];

  for (const ws of accounts) {
    const entry: Record<string, unknown> = { account: ws.label };
    try {
      const refreshed = await refreshCompetitors(ws);
      entry.competitors = refreshed.length;
      entry.ok = refreshed.filter((r) => r.ok).length;
      const failures = refreshed.filter((r) => !r.ok);
      if (failures.length > 0) {
        entry.failures = failures.map((f) => `@${f.username}: ${f.error}`);
      }
    } catch (err) {
      // Esto sí es un fallo de verdad (ej. COMPETITOR_PROVIDER inválido),
      // no un perfil bloqueado.
      entry.error = (err as Error).message;
    }
    results.push(entry);
  }

  return NextResponse.json({
    ok: true,
    accounts: results.length,
    results,
    tookMs: Date.now() - started,
    at: new Date().toISOString(),
  });
}

export const POST = GET;
