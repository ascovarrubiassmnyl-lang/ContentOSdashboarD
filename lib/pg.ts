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

// Las tablas se crean solas la primera vez. Evita tener que acordarse de correr
// una migración a mano en cada entorno nuevo — son dos tablas y los
// CREATE son idempotentes.
//
// `app_media` guarda los binarios (video o imagen) de las piezas del
// calendario. Va aparte de `app_store` a propósito: `app_store` es jsonb y se
// lee entera en cada consulta, así que meter ahí un video de 80 MB en base64
// haría lentísima cualquier lectura del calendario. Aquí el binario solo se
// toca cuando se pide por su clave.
let ready: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (!ready) {
    ready = pool()
      .query(
        `CREATE TABLE IF NOT EXISTS app_store (
           key        text PRIMARY KEY,
           value      jsonb NOT NULL,
           updated_at timestamptz NOT NULL DEFAULT now()
         );
         CREATE TABLE IF NOT EXISTS app_media (
           key        text PRIMARY KEY,
           filename   text NOT NULL,
           mime       text NOT NULL,
           size       bigint NOT NULL,
           bytes      bytea NOT NULL,
           created_at timestamptz NOT NULL DEFAULT now()
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
