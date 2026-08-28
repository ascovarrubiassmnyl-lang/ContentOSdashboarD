// Conexión al Postgres de Railway. Sustituye a Supabase como backend de
// producción; el esquema es el mismo key-value que ya usaba la app
// (`app_store`), así que ninguna capa de arriba cambia.
import { Pool } from 'pg';

export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

let _pool: Pool | null = null;

export function pool(): Pool {
  if (!_pool) {
    const url = process.env.DATABASE_URL ?? '';
    // Dentro de Railway se va por la red privada (`*.railway.internal`), que
    // no habla TLS: pedirlo ahí tumba la conexión. Desde fuera (URL pública,
    // o cualquier Postgres gestionado) sí hace falta, con el certificado
    // propio del proveedor.
    const internal = url.includes('.railway.internal') || url.includes('localhost');
    _pool = new Pool({
      connectionString: url,
      ssl: internal ? undefined : { rejectUnauthorized: false },
      max: 5,
    });
  }
  return _pool;
}

// La tabla se crea sola la primera vez. Evita tener que acordarse de correr
// una migración a mano en cada entorno nuevo — es una sola tabla y el
// CREATE es idempotente.
let ready: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (!ready) {
    ready = pool()
      .query(
        `CREATE TABLE IF NOT EXISTS app_store (
           key        text PRIMARY KEY,
           value      jsonb NOT NULL,
           updated_at timestamptz NOT NULL DEFAULT now()
         )`
      )
      .then(() => undefined)
      .catch((err) => {
        // Si falla, el próximo intento vuelve a probar en vez de quedarse
        // con una promesa rechazada cacheada para siempre.
        ready = null;
        throw err;
      });
  }
  return ready;
}
