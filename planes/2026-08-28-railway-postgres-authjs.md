# Plan: Todo en Railway — Postgres propio, login con Auth.js y onboarding de credenciales

**Creado:** 2026-08-28
**Estado:** En progreso
**Reemplaza parcialmente:** `planes/2026-08-28-login-google-multiusuario.md` (ese plan ya está implementado y desplegado; este cambia el proveedor de auth y el backend de datos, y conserva TODO su trabajo de aislamiento multiusuario)

**Pedido:** "necesito levantar un nuevo servicio de postgres en railway, desecha el supabase de scav… me interesa que cuando quieras acceder al panel siendo nuevo, tengas la ventana del log in con Google, y que después de esa ventana haya un bloque donde solicite todas las credenciales que se necesitan para la conexión de sus cuentas de redes sociales."

---

## Descripción General

### Qué Logra Este Plan

ContentOS deja de depender de Supabase por completo. Los datos pasan al Postgres de Railway (mismo proyecto que la app), el login con Google pasa a Auth.js v5, y un usuario nuevo que entra por primera vez recibe, justo después del login, un bloque que le pide las credenciales para conectar su cuenta de Instagram — sin que nadie tenga que tocar variables de entorno por él.

### Por Qué Importa

El aislamiento multiusuario ya está hecho y desplegado, pero la app sigue atada a un proyecto de Supabase que pertenece a la etapa de un solo dueño (los datos de `@scav_86`) y que se descarta. Además, para que esto sea un SaaS de verdad, un usuario nuevo tiene que poder auto-servirse: hoy la primera cuenta dependía de `ZERNIO_API_KEY` en el entorno del servidor, lo cual solo funciona para el dueño de la instalación.

---

## Estado Actual

### Ya hecho (commit `cc5e260`, desplegado)

- Login con Google (sobre Supabase Auth), abierto a cualquier cuenta.
- `owner_user_id` por Workspace + `listAccountsForUser` / `getAccountForUser`.
- Verificación de propiedad en las rutas de cuentas (IDOR cerrado).
- `requireWorkspace()` en las 9 rutas de datos.
- Botón de cerrar sesión y estados vacíos para usuarios nuevos.

**Todo eso se conserva.** Este plan solo cambia de dónde viene la sesión y dónde viven los datos.

### Estructura existente relevante

- **`lib/db.ts`** — Almacén key-value con dos backends: JSON local o tabla `app_store` de Supabase. Todo el acoplamiento a Supabase para datos vive en 4 funciones (`kvGet`, `kvSet`, `deleteKey`, y los `isSupabaseConfigured()` que eligen backend). **No se usa Supabase Storage en ningún lado** — verificado.
- **`lib/supabase.ts`** — `isSupabaseConfigured()`, `isAuthEnabled()`, `supabaseAdmin()`.
- **`lib/auth.ts`** — `getSessionUser()` sobre `createServerClient` de `@supabase/ssr`.
- **`middleware.ts`**, **`app/login/page.tsx`**, **`app/auth/callback/route.ts`**, **`app/api/auth/signout/route.ts`**, **`lib/supabase-browser.ts`** — la capa de auth de Supabase.
- **`app/conexion/page.tsx`** — Ya tiene el flujo completo: pegar API key de Zernio → `POST /api/accounts/probe` lista las cuentas de IG de esa key → elegir una → `POST /api/accounts` la crea con su key cifrada. Es exactamente el bloque de credenciales que se pide; falta presentarlo como onboarding.
- **`lib/accounts.ts`** — `getZernioKey()` cae a `process.env.ZERNIO_API_KEY` para la cuenta `legacy`. Ese fallback ya no aplica a usuarios nuevos.

### Infraestructura ya provisionada (hecho en esta sesión)

- Proyecto Railway `innovative-smile`, servicio `ContentOSdashboarD`, URL `https://contentosdashboard-production.up.railway.app`.
- Servicio `Postgres` añadido al mismo proyecto.
- Variables ya puestas en el servicio de la app: `DATABASE_URL=${{Postgres.DATABASE_URL}}`, `ENCRYPTION_KEY` (generada), `CRON_SECRET` (generado).

---

## Cambios Propuestos

### Resumen

- `lib/db.ts` gana un backend de Postgres (`pg`) y pierde el de Supabase.
- Auth.js v5 (`next-auth@beta`) con provider Google y sesiones JWT reemplaza a Supabase Auth.
- Se borra todo rastro de `@supabase/*` del código y de las dependencias.
- `/conexion` gana un modo onboarding para el usuario recién llegado sin cuentas.
- `ZERNIO_API_KEY` de entorno deja de ser el camino principal: cada usuario trae la suya.

### Nuevos archivos

| Ruta | Propósito |
| --- | --- |
| `auth.ts` (raíz) | Config de Auth.js v5: provider Google, `session: { strategy: 'jwt' }`, `trustHost: true`. Exporta `handlers`, `auth`, `signIn`, `signOut`. |
| `app/api/auth/[...nextauth]/route.ts` | Reexporta `handlers` — es el endpoint que Google llama de vuelta. |
| `lib/pg.ts` | Pool de `pg` (singleton, como `supabaseAdmin()`) + creación idempotente de la tabla `app_store` en el primer uso. |
| `supabase/migrations/003_app_store_postgres.sql` → mejor `db/001_app_store.sql` | Esquema de `app_store` para Postgres plano (sin RLS: no hay cliente anónimo, solo el servidor toca la BD). |

### Archivos a modificar

| Ruta | Cambios |
| --- | --- |
| `lib/db.ts` | `kvGet`/`kvSet`/`deleteKey` pasan a `pg`. El selector de backend pasa de `isSupabaseConfigured()` a `isDbConfigured()` (`DATABASE_URL` presente). El backend JSON local se conserva intacto para el modo demo. |
| `lib/supabase.ts` | **Se elimina.** Sus dos usos se reemplazan: `isSupabaseConfigured` → `isDbConfigured` (en `lib/db.ts`), `isAuthEnabled` → `isAuthEnabled()` basada en las variables de Auth.js. |
| `lib/auth.ts` | `getSessionUser()` pasa a leer la sesión con `auth()` de Auth.js. Mantiene el mismo contrato (`SessionUser | null` + usuario `local-dev` en modo demo), así que **ninguna de las 17 rutas que lo usan cambia**. |
| `middleware.ts` | Deja de crear un cliente de Supabase; usa `auth()` de Auth.js para saber si hay sesión. Misma lógica de rutas públicas y de 401-en-API / redirect-en-página. |
| `app/login/page.tsx` | El botón llama `signIn('google', { callbackUrl: '/resumen' })` de `next-auth/react` en vez de `supabaseBrowser().auth.signInWithOAuth`. El diseño queda igual. |
| `components/layout/UserMenu.tsx` | "Cerrar sesión" llama `signOut({ callbackUrl: '/login' })` de Auth.js. |
| `app/conexion/page.tsx` | El bloque de bienvenida (ya añadido) pasa a abrir el modal de "Añadir cuenta" automáticamente y explica qué credencial hace falta y de dónde sacarla. |
| `lib/accounts.ts` | `getZernioKey`/`zernioKeyState`: el fallback a `process.env.ZERNIO_API_KEY` se limita a la cuenta legacy de una instalación local; un Workspace de un usuario SaaS siempre usa su key propia. |
| `.env.example`, `DEPLOY.md`, `Estado de el sistema.md` | Reflejan Railway Postgres + Auth.js en vez de Supabase. |

### Archivos a eliminar

| Ruta | Por qué |
| --- | --- |
| `lib/supabase.ts`, `lib/supabase-browser.ts` | Ya no hay Supabase. |
| `app/auth/callback/route.ts` | Auth.js trae su propio callback en `/api/auth/callback/google`. |
| `app/api/auth/signout/route.ts` | Auth.js expone su propio signout. |
| `supabase/migrations/*` | El esquema pasa a Postgres plano. (Conservar el archivo como referencia histórica es opcional.) |
| Dependencias `@supabase/ssr`, `@supabase/supabase-js` | Fuera de `package.json`. |

---

## Decisiones de Diseño

1. **Auth.js v5 con sesiones JWT, sin adaptador de base de datos** — decisión del usuario (todo en Railway). Con JWT la sesión va firmada en la cookie: no hace falta tabla de usuarios ni de sesiones, así que el login no depende del Postgres y una caída de la BD no deja a nadie fuera. El `user.id` que usa `owner_user_id` es el `sub` estable que devuelve Google.
2. **Se conserva el key-value `app_store` en vez de rediseñar el esquema** — tentador normalizar ahora que hay un Postgres de verdad, pero eso tocaría `lib/accounts.ts`, `lib/metrics.ts`, `lib/reports.ts` y las 17 rutas a la vez. Cambiar de proveedor y de modelo de datos en el mismo paso hace imposible saber qué rompió qué. El esquema normalizado queda como plan aparte.
3. **El backend JSON local se conserva** — es lo que permite `npm run dev` sin ninguna credencial, y el modo demo sigue siendo la red de seguridad para desarrollar.
4. **`getSessionUser()` mantiene exactamente su firma y su contrato** — por eso el cambio de proveedor de auth no toca ninguna de las rutas de API ni el aislamiento por usuario ya implementado. Es el punto de corte que hace este cambio barato.
5. **El onboarding reutiliza `/conexion`, no se crea una pantalla nueva** — el flujo que se pide (pedir credenciales y conectar la cuenta) ya existe ahí y funciona; duplicarlo en una pantalla de bienvenida crearía dos caminos que mantener y que se desincronizan.
6. **Solo Zernio en esta versión** — decisión del usuario. Conectar Instagram/Facebook directo exige app de Meta, permisos `instagram_manage_insights` y App Review de Meta (semanas). Zernio existe precisamente para saltarse eso.

### Alternativas consideradas

- **Mantener Supabase solo para el login** — descartado por el usuario: dos proveedores para un solo producto.
- **Auth.js con adaptador de Postgres (sesiones en BD)** — descartado: añade tablas y una dependencia del Postgres en el camino crítico del login, a cambio de nada que este producto necesite hoy (revocar sesiones al instante).
- **Migrar los datos de `@scav_86` desde Supabase** — descartado por el usuario ("desecha el supabase de scav"). La base nueva arranca vacía; por eso `LEGACY_OWNER_EMAIL` deja de tener sentido y se retira.

---

## Tareas Paso a Paso

### Paso 1 — Google OAuth Client (manual, bloquea el login)
En Google Cloud Console → Credentials → OAuth client ID (Web application):
- **Authorized redirect URIs**: `https://contentosdashboard-production.up.railway.app/api/auth/callback/google` y `http://localhost:3333/api/auth/callback/google`.
- Guardar Client ID y Client Secret → van a Railway como `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`.

### Paso 2 — Dependencias
`npm i next-auth@beta pg` · `npm i -D @types/pg` · `npm rm @supabase/ssr @supabase/supabase-js`

### Paso 3 — Backend Postgres (`lib/pg.ts`, `lib/db.ts`)
Pool singleton + `CREATE TABLE IF NOT EXISTS app_store (key text primary key, value jsonb not null, updated_at timestamptz default now())`. `kvGet`/`kvSet`/`deleteKey` con SQL parametrizado.

### Paso 4 — Auth.js (`auth.ts`, `app/api/auth/[...nextauth]/route.ts`, `lib/auth.ts`, `middleware.ts`)
Config, handlers, y reescritura de `getSessionUser()` conservando su contrato.

### Paso 5 — UI de login y logout
`app/login/page.tsx` y `components/layout/UserMenu.tsx` a `signIn`/`signOut` de Auth.js.

### Paso 6 — Limpieza de Supabase
Borrar `lib/supabase.ts`, `lib/supabase-browser.ts`, `app/auth/callback/`, `app/api/auth/signout/`, y las referencias a `LEGACY_OWNER_EMAIL`.

### Paso 7 — Onboarding en `/conexion`
Abrir el modal automáticamente para el usuario sin cuentas y ajustar el copy con de dónde sacar la API key de Zernio.

### Paso 8 — Variables en Railway y documentación
`AUTH_SECRET` (generada), `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `NEXTAUTH_URL`/`AUTH_URL`. Actualizar `.env.example`, `DEPLOY.md`, `Estado de el sistema.md`.

### Paso 9 — Validación
Build local, `/api/health`, login real con Google, alta de cuenta con una API key de Zernio, y una segunda cuenta de Google que no debe ver nada de la primera.

---

## Lista de Validación

- [ ] `npm run build` pasa y `npx tsc --noEmit` está limpio.
- [ ] No queda ninguna referencia a `@supabase` en el código ni en `package.json`.
- [ ] `/api/health` reporta `db: true`, `auth: true`, `encryption: true`, `cron: true`.
- [ ] Login con Google real entra y crea sesión.
- [ ] Usuario nuevo cae en el bloque de credenciales y puede conectar su cuenta con SU propia API key de Zernio (sin `ZERNIO_API_KEY` en el entorno).
- [ ] Una segunda cuenta de Google no ve, ni edita, ni borra las cuentas de la primera (incluye probar los ids directo por API).
- [ ] Los datos persisten en Postgres entre redeploys (tabla `app_store` con filas).
- [ ] `npm run dev` sin credenciales sigue funcionando en modo demo, sin login.
- [ ] El cron sigue sincronizando todas las cuentas de todos los usuarios.

## Criterios de Éxito

1. ContentOS corre entero sobre Railway (app + Postgres), sin ninguna dependencia de Supabase.
2. Una persona ajena al equipo entra con Google, conecta su cuenta de Instagram con su propia API key de Zernio, y ve sus métricas — sin que nadie toque el servidor.
3. El aislamiento entre usuarios logrado en el commit anterior sigue intacto tras el cambio de proveedor de auth.

## Notas

- `ENCRYPTION_KEY` y `CRON_SECRET` de producción se generaron en esta sesión y viven solo en Railway. Si se pierden: `CRON_SECRET` se puede rotar sin consecuencias, pero cambiar `ENCRYPTION_KEY` deja ilegibles las API keys de Zernio ya guardadas y cada usuario tendría que volver a pegar la suya.
- Sigue pendiente lo que ya señalaba el plan anterior: **no hay un solo test** sobre el código de aislamiento (`listAccountsForUser`, `getAccountForUser`). Con usuarios reales entrando, ese es el siguiente plan.
