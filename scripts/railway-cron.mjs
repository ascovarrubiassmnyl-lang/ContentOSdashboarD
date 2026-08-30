// Cron de Railway: sincroniza todas las cuentas, purga los calendarios y
// genera el reporte quincenal de cada cuenta que le toque.
//
// En Cloudflare esto lo hacía un handler `scheduled` dentro del propio worker
// (custom-worker.js). Railway no tiene ese concepto: se despliega un servicio
// aparte, desde este mismo repo, con Start Command `npm run cron` y su propio
// horario. El contenedor arranca, llama a los endpoints y termina.
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

// Cada endpoint corre aparte: que uno falle no debe impedir que el otro se
// intente. Se sale con error al final si alguno falló — un cron roto en
// silencio es peor que no tener cron.
async function callCron(path) {
  const started = Date.now();
  try {
    const res = await fetch(`${appUrl}${path}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${secret}` },
    });
    const body = await res.text();
    if (!res.ok) {
      console.error(`[cron ${path}] HTTP ${res.status} — ${body.slice(0, 800)}`);
      return false;
    }
    console.log(`[cron ${path}] OK en ${Date.now() - started}ms — ${body.slice(0, 800)}`);
    return true;
  } catch (err) {
    console.error(`[cron ${path}] no se pudo contactar con la app:`, err?.message ?? err);
    return false;
  }
}

const okSync = await callCron('/api/cron/sync');
const okReports = await callCron('/api/cron/reports');
const okCompetitors = await callCron('/api/cron/competitors');

if (!okSync || !okReports || !okCompetitors) process.exit(1);
