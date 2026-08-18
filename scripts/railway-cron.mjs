// Cron de Railway: sincroniza todas las cuentas y purga los calendarios.
//
// En Cloudflare esto lo hacía un handler `scheduled` dentro del propio worker
// (custom-worker.js). Railway no tiene ese concepto: se despliega un servicio
// aparte, desde este mismo repo, con Start Command `npm run cron` y su propio
// horario. El contenedor arranca, llama al endpoint y termina.
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
  const res = await fetch(`${appUrl}/api/cron/sync`, {
    method: 'POST',
    headers: { authorization: `Bearer ${secret}` },
  });
  const body = await res.text();

  if (!res.ok) {
    // Salir con error hace que Railway marque la ejecución como fallida en
    // lugar de aparentar que fue bien: un cron roto en silencio es peor que
    // no tener cron.
    console.error(`[cron] HTTP ${res.status} — ${body.slice(0, 800)}`);
    process.exit(1);
  }

  console.log(`[cron] OK en ${Date.now() - started}ms — ${body.slice(0, 800)}`);
} catch (err) {
  console.error('[cron] no se pudo contactar con la app:', err?.message ?? err);
  process.exit(1);
}
