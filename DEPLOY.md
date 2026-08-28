# Deploy a producción

Guía para llevar Content OS a producción. El código ya está preparado: la app
detecta las variables de entorno y cambia sola de modo local a producción.

El destino soportado es **Railway**: corre Next.js nativo en Node, con el
Postgres en el mismo proyecto.

---

# Railway

Next.js se ejecuta nativo en Node. Todo el estado vive en el servicio Postgres
del mismo proyecto; el servicio web solo ejecuta el código.

## Servicio 1 — la app web

1. railway.app → **New Project → Deploy from GitHub repo** → este repo.
2. Railway detecta `railway.json` y usa `npm run build` + `npm start`.
   `next start` lee el `PORT` que inyecta Railway.
3. **Variables** — añade las mismas que en local:

   | Variable | Nota |
   |---|---|
   | `DATABASE_URL` | referencia al Postgres: `${{Postgres.DATABASE_URL}}` |
   | `AUTH_GOOGLE_ID` | Client ID de Google — ver "Login con Google" |
   | `AUTH_GOOGLE_SECRET` | secreta |
   | `AUTH_SECRET` | `openssl rand -base64 32` |
   | `AUTH_URL` | la URL pública de la app, sin barra final |
   | `ENCRYPTION_KEY` | ⚠️ cifra las API keys de Zernio. Si cambia, las guardadas dejan de descifrarse y cada usuario tiene que volver a pegar la suya |
   | `CRON_SECRET` | |
   | `ANTHROPIC_API_KEY` | opcional, activa la IA real |

   `ZERNIO_API_KEY` ya **no** hace falta: cada usuario pega la suya desde la
   app y se guarda cifrada. Solo sirve como fallback de una instalación local.

4. **Settings → Networking → Generate Domain** para obtener la URL pública.
5. Comprueba `https://<tu-url>/api/health`: debe responder `ok: true` y mostrar
   `db`, `auth`, `encryption` y `cron` en `true`.

## Servicio 2 — el cron diario

Railway no tiene handler `scheduled`: el cron es un servicio aparte que arranca,
llama al endpoint y termina.

1. En el MISMO proyecto: **New → GitHub Repo** → el mismo repo.
2. **Settings → Config-as-code**: `railway.cron.json`.
3. **Settings → Cron Schedule**: `0 13 * * *` (13:00 UTC = 7:00 a.m. CDMX).
4. **Variables** de ese servicio:
   - `APP_URL` → la URL pública del servicio 1, sin barra final
   - `CRON_SECRET` → el mismo del servicio 1
5. Pruébalo con **Deploy** manual: en los logs debe salir
   `[cron] OK en …ms — {"ok":true,"accounts":2,…}`.

Si falla, el script sale con código 1 y Railway marca la ejecución como fallida
en lugar de aparentar que fue bien.

## Cambiar el dominio

Mientras validas Railway puedes dejar Cloudflare corriendo: son independientes y
comparten la misma base de datos. Cuando Railway responda bien, apunta tu dominio
allí y desactiva el Cron Trigger de Cloudflare (`triggers.crons` en
`wrangler.jsonc`) para que no sincronicen los dos a la vez.

---

## Login con Google (Auth.js)

El login es con Google, abierto a cualquier cuenta (sin allowlist): es
multiusuario, cada quien ve solo las cuentas de Instagram que conectó.
No hace falta Supabase ni ningún otro proveedor — Auth.js corre dentro de
la propia app, con sesiones JWT firmadas en la cookie.

1. **Google Cloud Console** → [console.cloud.google.com](https://console.cloud.google.com)
   → **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   → tipo **Web application**.
   - **Authorized redirect URIs** (exactas, este path lo define Auth.js):
     - `https://<tu-dominio>/api/auth/callback/google`
     - `http://localhost:3333/api/auth/callback/google`
2. Copia el **Client ID** y el **Client Secret** a las variables de la app:
   `AUTH_GOOGLE_ID` y `AUTH_GOOGLE_SECRET`.
3. Genera `AUTH_SECRET` con `openssl rand -base64 32` (firma las cookies de
   sesión; si cambia, todas las sesiones abiertas se invalidan).
4. `AUTH_URL` = la URL pública de la app, sin barra final. Hace falta porque
   Railway sirve detrás de un proxy.

Sin `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` la app corre sin login, en modo
demo con un usuario fijo — que es como funciona en local.

## Base de datos (Postgres)

Los datos viven en Postgres, en una sola tabla key-value `app_store` que **se
crea sola** en el primer arranque: no hay migración que correr a mano.

En Railway: **New → Database → Postgres** en el mismo proyecto, y en el
servicio de la app define `DATABASE_URL` con el valor de referencia
`${{Postgres.DATABASE_URL}}` (así usa la red privada, sin salir a internet).

Sin `DATABASE_URL`, la app guarda en `./data/*.json` — el modo local.

---

# Cloudflare Workers — ya no soportado

La app corrió un tiempo en Cloudflare Workers con el adaptador OpenNext. Ya
no: el almacenamiento pasó a Postgres (`pg` es un cliente TCP de Node, que
Workers no ejecuta) y en Workers no hay disco para el modo local.

Los restos de esa etapa (`open-next.config.ts`, `wrangler.jsonc`,
`custom-worker.js`) siguen en el repo pero no se usan. Si Railway queda
confirmado, se pueden borrar junto con las dependencias
`@opennextjs/cloudflare` y `wrangler`.
