# Deploy a producción

Guía para llevar Content OS a producción. El código ya está preparado: la app
detecta las variables de entorno y cambia sola de modo local a producción.

Hay dos destinos soportados. **Railway** es el recomendado: corre Next.js tal
cual, sin adaptadores. Cloudflare Workers sigue funcionando y su guía está más
abajo.

---

# A) Railway (recomendado)

Next.js se ejecuta nativo en Node: sin OpenNext, sin `custom-worker.js` y sin
el límite de 50 subrequests por petición que tiene Workers.

**No hay que migrar datos.** Todo el estado vive en Supabase; Railway solo
ejecuta el código.

## Servicio 1 — la app web

1. railway.app → **New Project → Deploy from GitHub repo** → este repo.
2. Railway detecta `railway.json` y usa `npm run build` + `npm start`.
   `next start` lee el `PORT` que inyecta Railway.
3. **Variables** — añade las mismas que en local:

   | Variable | Nota |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | |
   | `SUPABASE_SERVICE_ROLE_KEY` | secreta |
   | `ZERNIO_API_KEY` | key de la cuenta original |
   | `ENCRYPTION_KEY` | ⚠️ **la MISMA de `.env.local`** — si cambia, las API keys de Zernio guardadas dejan de descifrarse |
   | `CRON_SECRET` | |
   | `ANTHROPIC_API_KEY` | opcional, activa la IA real |
   | `LEGACY_OWNER_EMAIL` | opcional, una sola vez — ver "Login con Google" |

4. **Settings → Networking → Generate Domain** para obtener la URL pública.
5. Comprueba `https://<tu-url>/api/health`: debe responder `ok: true` y mostrar
   `supabase`, `zernio`, `encryption` y `cron` en `true`.

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

## Login con Google

El login es con Google OAuth, abierto a cualquier cuenta (sin allowlist de
correos) — es multiusuario: cada quien ve solo las cuentas de Instagram que
conectó. Se configura una sola vez por proyecto de Supabase:

1. **Google Cloud Console** → [console.cloud.google.com](https://console.cloud.google.com)
   → crea (o reusa) un proyecto → **APIs & Services → Credentials → Create
   Credentials → OAuth client ID** → tipo **Web application**.
   - **Authorized JavaScript origins**: la URL de producción y
     `http://localhost:3333`.
   - **Authorized redirect URIs**: `https://<tu-proyecto>.supabase.co/auth/v1/callback`
     (Supabase te la muestra tal cual en el paso siguiente).
2. **Supabase Dashboard → Authentication → Providers → Google**: actívalo,
   pega el **Client ID** y el **Client Secret** que te dio Google Cloud Console.
3. **Supabase Dashboard → Authentication → URL Configuration**: confirma que
   **Site URL** y **Redirect URLs** incluyen `http://localhost:3333/auth/callback`
   y `https://<tu-dominio-producción>/auth/callback`.
4. En las variables de entorno de la app, `LEGACY_OWNER_EMAIL` (opcional):
   el correo del equipo con el que van a entrar primero — la primera vez que
   entra ese correo, reclama automáticamente las cuentas de Instagram que ya
   existían antes de este login (p. ej. `@scav_86`). Después de esa primera
   entrada se puede borrar la variable; no vuelve a hacer nada.

Sin `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` configuradas
(modo demo local), no hay login: la app corre abierta con un usuario fijo,
igual que siempre.

---

# B) Cloudflare Workers

## Requisitos previos (cuentas)

| Servicio | Para qué | Plan |
|---|---|---|
| [Supabase](https://supabase.com) | BD + archivos + login | Gratis |
| [Cloudflare](https://dash.cloudflare.com) | Hosting (Workers) | Gratis |
| [Anthropic](https://console.anthropic.com) | IA del generador/reportes | Pago por uso (centavos) |
| GitHub | Repo para el deploy con git | Gratis |

---

## Paso 1 — Supabase (15 min)

1. Crea un proyecto en supabase.com (región cercana, p. ej. `us-east-1`).
2. **SQL Editor** → pega y ejecuta `supabase/migrations/002_app_store.sql`.
3. **Authentication → Providers → Google**: seguí la guía de la sección
   "Login con Google" más arriba.
4. **Authentication → URL Configuration**: agrega la URL de producción como
   Site URL (cuando la tengas) y `http://localhost:3333` en Redirect URLs.
5. **Settings → API**: copia estos 3 valores:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ secreta, solo servidor)

**Prueba local antes del deploy:** pega esas 3 variables en `.env.local`,
reiniciá el servidor y verificá que (a) te pide login con Google, (b) entrás
con tu cuenta y llegás a /resumen (o a /conexion si es tu primera vez), (c)
los datos se guardan en Supabase (tabla `app_store` se va llenando). Después
sincroniza desde /conexion para poblar la BD con tus datos reales.

## Paso 2 — Cloudflare Workers

Next.js corre en Cloudflare con el adaptador **OpenNext**
([opennext.js.org/cloudflare](https://opennext.js.org/cloudflare)).

⚠️ **Aviso importante — versión de Node:** el adaptador y `wrangler` requieren
**Node 20+** y esta Mac tiene Node 18. Dos salidas:
- **(Recomendada)** Deploy vía **Workers Builds**: conectas el repo de GitHub en
  el dashboard de Cloudflare y ellos compilan en la nube (no dependes del Node local).
- O actualizar Node local (`brew install node@22`) y desplegar con wrangler.

El repo YA incluye la configuración del adaptador: `open-next.config.ts`,
`wrangler.jsonc` (worker "dashboardscav", flag nodejs_compat, keep_vars) y las
dependencias `@opennextjs/cloudflare` + `wrangler`.

Pasos (vía Workers Builds):
1. Sube el proyecto a un repo de GitHub (privado).
2. En Cloudflare: **Workers & Pages → Create → conectar repo**.
3. En **Settings → Build** del worker:
   - Build command: `npx opennextjs-cloudflare build`
   - Deploy command: `npx wrangler deploy`
4. En **Settings → Variables and Secrets**: agrega como **Secret**
   ZERNIO_API_KEY, ENCRYPTION_KEY, NEXT_PUBLIC_SUPABASE_URL,
   NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY y CRON_SECRET
   (y ANTHROPIC_API_KEY cuando exista).
   **ENCRYPTION_KEY** cifra las API keys de Zernio de las cuentas que añadas
   desde la app. Genérala con `openssl rand -hex 32` y usa la MISMA que en
   `.env.local` — si no, las cuentas guardadas en local no se descifran en
   producción y hay que volver a pegar su key desde Conexión.
   **Login:** la app pide login automáticamente en cuanto configuras las 3
   variables de Supabase — ver "Login con Google" más arriba.
5. Retry build / push → te da la URL `https://<worker>.workers.dev`.
6. Supabase → Authentication → URL Configuration → agrega esa URL a Site URL
   y a Redirect URLs (con `/auth/callback`).

⚠️ **Producción requiere Supabase configurado**: en Workers no existe disco,
así que el modo local de archivos JSON no funciona ahí. Sin las variables de
Supabase, la app no podrá guardar datos.

⚠️ **Extracción de PDF/Word en Workers**: `pdf-parse` y `mammoth` son librerías
de Node; con `nodejs_compat` deberían funcionar, pero pruébalo tras el deploy
(sube un PDF en Fuentes). Si fallara, la subida guarda el archivo igualmente y
lo marcamos para procesar de otra forma.

## Paso 3 — Cron diario (7:00 a.m.)

El endpoint ya existe: `GET /api/cron/sync` con header
`authorization: Bearer <CRON_SECRET>`. Sincroniza Instagram y purga el calendario.

Opción A — **Cloudflare Cron Trigger** (mismo dashboard):
un Worker mínimo programado que llama a la URL. Cron en UTC:
- 7:00 a.m. Ciudad de México → `0 13 * * *`
- 7:00 a.m. Bogotá → `0 12 * * *`

Opción B — **cron-job.org** (más simple, sin código): job diario a la URL
`https://<tu-app>/api/cron/sync?secret=<CRON_SECRET>`.

## Paso 4 — Verificación final

- [ ] Entrar desde el celular a la URL de producción → pide login con Google
- [ ] Login con Google entra con cualquier cuenta; el correo de
      `LEGACY_OWNER_EMAIL` reclama las cuentas de Instagram preexistentes al
      entrar la primera vez
- [ ] /conexion → Sincronizar ahora → métricas reales
- [ ] Subir un PDF en Fuentes → texto extraído
- [ ] Generar un guion en el chat
- [ ] Disparar el cron a mano (`curl -H "authorization: Bearer <secreto>" https://<app>/api/cron/sync`)
