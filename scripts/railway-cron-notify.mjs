// Cron de ALTA FRECUENCIA: recordatorios de calendario y publicación.
//
// Va aparte de scripts/railway-cron.mjs a propósito. Aquel corre una vez al
// día (sync, reportes, competencia); ni un aviso de "faltan 2 horas para
// publicar" ni una pieza programada a las 10:15 existen con granularidad
// diaria. Este está pensado para un servicio de Railway con horario
// `*/15 * * * *`.
//
// Los dos endpoints van en el mismo tick para no tener que mantener dos
// servicios de cron con el mismo horario. Si uno falla, el otro se intenta
// igual: que no se pueda notificar no es motivo para no publicar.
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

const TASKS = [
  { name: 'notifications', path: '/api/cron/notifications' },
  { name: 'publish', path: '/api/cron/publish' },
];

let failures = 0;
for (const task of TASKS) {
  const started = Date.now();
  try {
    const res = await fetch(`${appUrl}${task.path}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${secret}` },
    });
    const body = await res.text();
    if (!res.ok) {
      console.error(`[cron ${task.name}] HTTP ${res.status} — ${body.slice(0, 800)}`);
      failures++;
      continue;
    }
    console.log(`[cron ${task.name}] OK en ${Date.now() - started}ms — ${body.slice(0, 800)}`);
  } catch (err) {
    console.error(`[cron ${task.name}] no se pudo contactar con la app:`, err?.message ?? err);
    failures++;
  }
}

if (failures > 0) process.exit(1);
