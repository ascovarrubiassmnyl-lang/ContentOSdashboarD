// Entrypoint propio del Worker de Cloudflare.
//
// OpenNext genera `.open-next/worker.js`, que solo sabe responder peticiones
// HTTP. Para que Cloudflare pueda dispararnos el cron diario hace falta un
// handler `scheduled`, así que envolvemos el worker generado: el `fetch` se
// delega tal cual y añadimos el `scheduled` encima.
//
// En JS (no .ts) a propósito: el tsconfig solo incluye **/*.ts, y este archivo
// importa de .open-next/, que no existe hasta después del build. Con .ts, el
// typecheck de `next build` fallaría en un clon limpio de CI.
import { default as handler } from './.open-next/worker.js';

// La petición del cron NO sale a internet: la resuelve el propio router de
// Next dentro del worker. El host solo tiene que ser una URL válida.
const DEFAULT_ORIGIN = 'https://dashboardscav.santycv86.workers.dev';

export default {
  fetch: handler.fetch,

  // Cron Trigger — la cadencia se define en wrangler.jsonc (triggers.crons).
  // Reutiliza /api/cron/sync (sincroniza TODAS las cuentas y purga los
  // calendarios) y /api/cron/reports (genera el reporte quincenal del
  // agente por cuenta cuando toca). Llamarlas por dentro evita una petición
  // de red extra y deja el CRON_SECRET sin salir nunca del worker.
  async scheduled(event, env, ctx) {
    const origin = env.CRON_ORIGIN || DEFAULT_ORIGIN;

    async function runCron(path) {
      const req = new Request(`${origin}${path}`, {
        method: 'POST',
        headers: { authorization: `Bearer ${env.CRON_SECRET ?? ''}` },
      });
      const res = await handler.fetch(req, env, ctx);
      const body = await res.text();
      // Visible en Observability / `wrangler tail`.
      console.log(`[cron ${path}] ${res.status} ${body.slice(0, 600)}`);
      if (!res.ok) {
        throw new Error(`${path} devolvió ${res.status}`);
      }
    }

    try {
      await runCron('/api/cron/sync');
      await runCron('/api/cron/reports');
      await runCron('/api/cron/competitors');
    } catch (err) {
      // Relanzar marca la ejecución como fallida en el panel de Cloudflare;
      // si se traga el error, un cron roto parece que va bien.
      console.error('[cron] falló:', err?.message ?? err);
      throw err;
    }
  },
};
