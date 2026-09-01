// Cron de ALTA FRECUENCIA: recordatorios de calendario.
//
// Va aparte de scripts/railway-cron.mjs a propósito. Aquel corre una vez al
// día (sync, reportes, competencia); un aviso de "faltan 2 horas para
// publicar" con granularidad diaria sencillamente no existe. Este está pensado
// para un servicio de Railway con horario `*/15 * * * *`.
//
// Variables que necesita ese servicio:
//   APP_URL      → la URL pública del servicio web (sin barra final)
//   CRON_SECRET  → el mismo secreto que usa el servicio web
const appUrl = (process.env.APP_URL || '').replace(/\/+$/, '');
const secret = process.env.CRON_SECRET;

if (!appUrl) {
  console.error('Falta APP_URL: apunta a la URL pública del servicio web.');
  process.exit(1);
}
if (!secret) {
  console.error('Falta CRON_SECRET: debe ser el mismo que el del servicio web.');
  process.exit(1);
}

const started = Date.now();
try {
  const res = await fetch(`${appUrl}/api/cron/notifications`, {
    method: 'POST',
    headers: { authorization: `Bearer ${secret}` },
  });
  const body = await res.text();
  if (!res.ok) {
    console.error(`[cron notifications] HTTP ${res.status} — ${body.slice(0, 800)}`);
    process.exit(1);
  }
  console.log(`[cron notifications] OK en ${Date.now() - started}ms — ${body.slice(0, 800)}`);
} catch (err) {
  console.error('[cron notifications] no se pudo contactar con la app:', err?.message ?? err);
  process.exit(1);
}
