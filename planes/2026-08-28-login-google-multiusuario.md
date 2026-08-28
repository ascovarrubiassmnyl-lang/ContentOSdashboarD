# Plan: Login con Google y aislamiento multiusuario (primer paso hacia SaaS)

**Creado:** 2026-08-28
**Estado:** Borrador
**Pedido:** Reemplazar el login por magic-link + allowlist de un solo correo por un login "Continuar con Google" abierto a cualquier cuenta, y aislar los datos (Workspaces/cuentas de Instagram) por usuario para que sea multiusuario de verdad — primer paso hacia convertir ContentOS en un SaaS, empezando por validarlo el equipo mismo con sus marcas personales.

---

## Descripción General

### Qué Logra Este Plan

Cualquier persona podrá entrar a ContentOS con su cuenta de Google, sin invitación previa, y ver **únicamente** las cuentas de Instagram (Workspaces) que ella misma conectó — nunca las de otro usuario. Es el cambio de fondo (autenticación abierta + aislamiento de datos) que separa "una app personal con login" de "el esqueleto real de un SaaS".

### Por Qué Importa

Hoy la app es de un solo dueño: el login existe solo para bloquear el acceso a un correo (`OWNER_EMAIL`), y el registro de Workspaces (`lib/accounts.ts`) es una lista global — cualquier cuenta autenticada ve todas las cuentas de Instagram conectadas. Abrir el login a cualquier cuenta de Google **sin** resolver esto sería un problema de seguridad grave (cualquier persona que entre vería/editaría/borraría las cuentas de Instagram de las demás). Este plan resuelve ambas cosas juntas porque no tiene sentido — ni es seguro — hacerlas por separado.

---

## Estado Actual

### Estructura Existente Relevante

- **`middleware.ts`** — Protege toda la app con Supabase Auth. Si `OWNER_EMAIL` no coincide con el correo logueado, cierra la sesión y redirige a `/login?error=no_autorizado`. Sin variables de Supabase configuradas, la auth queda desactivada (modo demo local).
- **`app/login/page.tsx`** — Formulario de correo que pide un magic-link.
- **`app/api/auth/request-link/route.ts`** — Envía el magic-link, pero solo si el correo == `OWNER_EMAIL` (allowlist de un solo correo).
- **`app/auth/confirm/route.ts`** — Destino del magic-link: verifica el OTP y crea la sesión.
- **`app/api/auth/signout/route.ts`** — Cierra sesión (existe pero **no hay ningún botón en la UI que lo use** — no hay forma de cerrar sesión hoy).
- **`lib/supabase.ts`** — `isAuthEnabled()` exige `OWNER_EMAIL` además de las llaves de Supabase.
- **`lib/accounts.ts`** — Registro de Workspaces (cuentas de Instagram). Es una sola colección global (`ACCOUNTS_KEY = 'accounts'`), sin ningún campo de propietario. `activeWorkspace()` resuelve la cuenta activa vía cookie `co_account` buscando sobre **todas** las cuentas existentes, no solo las de un usuario.
- **`app/api/accounts/route.ts`**, **`app/api/accounts/[id]/route.ts`**, **`app/api/accounts/active/route.ts`** — CRUD de Workspaces. Ninguno valida propiedad: `PATCH`/`DELETE /api/accounts/[id]` y `POST /api/accounts/active` resuelven cualquier `id` de cuenta sin comprobar quién la creó.
- **`app/api/cron/sync/route.ts`** y **`lib/maintenance.ts`** — Usan `listAccounts()` (global, todas las cuentas de todos los usuarios) a propósito, porque el cron sincroniza todo el sistema. Esto **debe seguir siendo global**.
- No existe ningún cliente Supabase de navegador (`createBrowserClient`) — solo hay clientes de servidor (`middleware.ts`, `app/auth/confirm`, `app/api/auth/signout`).
- No existe ningún helper server-side para leer "quién es el usuario actual" dentro de una API route — solo el middleware sabe quién entró.
- No hay ningún botón de "Cerrar sesión" ni indicador de usuario logueado en la UI (`components/layout/Sidebar.tsx`).

### Brechas o Problemas que se Abordan

1. El login solo admite un correo — no sirve para multiusuario.
2. Los Workspaces no tienen dueño → fuga de datos entre usuarios en cuanto se abra el login.
3. Las rutas de Workspaces (`/api/accounts/[id]`, `/api/accounts/active`) no comprueban propiedad → IDOR (un usuario podría editar/borrar/activar la cuenta de Instagram de otro usuario adivinando o viendo su `id`, que sigue el patrón predecible `acc_<id_de_zernio>`).
4. No hay forma de cerrar sesión desde la UI.
5. Los datos existentes (la cuenta `@scav_86`, marcada `legacy: true`) no tienen dueño — hay que asignárselos al usuario correcto sin perder nada ni abrir una ventana insegura de "quien entre primero se los queda".

---

## Cambios Propuestos

### Resumen de Cambios

- Login exclusivamente con Google OAuth (se elimina el magic-link).
- Cualquier cuenta de Google puede entrar — sin allowlist. `OWNER_EMAIL` deja de controlar el acceso.
- Cada `Workspace` gana un campo `owner_user_id` (uuid de Supabase Auth).
- Nuevas funciones "por usuario" en `lib/accounts.ts` que filtran por `owner_user_id`; las funciones globales (`listAccounts()`, usada por el cron) se mantienen intactas para el cron/mantenimiento.
- Las rutas de API que tocan Workspaces exigen sesión y verifican propiedad antes de leer/editar/borrar/activar.
- Migración de los datos existentes: la primera vez que el correo actual del dueño (vía una variable de entorno de un solo uso) entra con Google, reclama automáticamente los Workspaces sin dueño (los que ya existen hoy).
- Nuevo helper de servidor `lib/auth.ts` con `getSessionUser()` para que cualquier API route sepa quién está pidiendo los datos.
- Nuevo cliente de navegador `lib/supabase-browser.ts` para disparar `signInWithOAuth`.
- Botón de "Cerrar sesión" + identidad del usuario (avatar/nombre de Google) en `Sidebar.tsx`.
- Estado vacío en `/conexion` y `AccountSwitcher` para usuarios nuevos sin ningún Workspace todavía.
- `.env.example` y `DEPLOY.md` actualizados con la configuración de Google OAuth en Supabase.

### Nuevos Archivos a Crear

| Ruta del Archivo | Propósito |
| --- | --- |
| `lib/supabase-browser.ts` | Cliente Supabase de navegador (`createBrowserClient`) para invocar `signInWithOAuth({ provider: 'google' })` desde `/login`. |
| `lib/auth.ts` | `getSessionUser()`: server helper que lee la sesión desde las cookies de la petición y devuelve `{ id, email, name, avatarUrl } \| null`. En modo demo (sin Supabase configurado) devuelve un usuario fijo `local-dev` para no romper el flujo local sin login. |
| `app/auth/callback/route.ts` | Destino del OAuth de Google: intercambia el `code` por sesión (`exchangeCodeForSession`), dispara el reclamo de Workspaces legacy si aplica, y redirige a `/resumen` (o a `/conexion` si el usuario no tiene ningún Workspace todavía). |

### Archivos a Modificar

| Ruta del Archivo | Cambios |
| --- | --- |
| `app/login/page.tsx` | Se reemplaza el formulario de correo por un botón único "Continuar con Google" que llama a `supabase.auth.signInWithOAuth(...)` desde `lib/supabase-browser.ts`. Se conservan los estados de error (leídos de `?error=`), se ajusta el copy (ya no dice "acceso restringido a un correo"). |
| `middleware.ts` | Se elimina el bloque de allowlist (`user.email !== owner`). Ahora solo exige que exista sesión (`user` no nulo); cualquier cuenta de Google autenticada pasa. `isAuthEnabled` deja de depender de `OWNER_EMAIL` (ver `lib/supabase.ts`). |
| `lib/supabase.ts` | `isAuthEnabled()` pasa a depender solo de `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (ya no de `OWNER_EMAIL`). |
| `app/api/auth/signout/route.ts` | Sin cambios de lógica; se conecta por primera vez a un botón real en `Sidebar.tsx`. |
| `app/api/auth/request-link/route.ts` | **Se elimina** (magic-link ya no existe). |
| `app/auth/confirm/route.ts` | **Se elimina** (era el destino del magic-link; lo reemplaza `app/auth/callback/route.ts`). |
| `lib/accounts.ts` | Ver detalle completo en Decisiones de Diseño y Paso 3 — se agrega `owner_user_id` a `Workspace`, `listAccountsForUser()`, `getAccountForUser()`, ownership check en `updateAccount`/`deleteAccount`, y `claimLegacyWorkspaces()`. `activeWorkspace()` pasa a requerir `userId` y a resolver solo entre las cuentas de ese usuario. `createAccount()` exige `ownerUserId`. |
| `app/api/accounts/route.ts` | `GET`/`POST` usan `getSessionUser()` + `listAccountsForUser`/`activeWorkspace(userId)`/`createAccount({..., ownerUserId})`. Si el usuario no tiene ningún Workspace, `GET` devuelve `{ accounts: [], activeId: null }` en vez de lanzar. |
| `app/api/accounts/[id]/route.ts` | `PATCH`/`DELETE` usan `getAccountForUser(id, userId)` para confirmar propiedad antes de tocar nada; 404 si la cuenta no existe o no es del usuario (mismo código de error que "no existe" — no revelar que pertenece a otro usuario). |
| `app/api/accounts/active/route.ts` | Usa `getAccountForUser(id, userId)` en vez de `getAccount(id)`. |
| `app/api/accounts/probe/route.ts` | Revisar y aplicar `getSessionUser()` si toca datos de cuenta (confirmar en el Paso 4). |
| Las 9 rutas que llaman `activeWorkspace()` (`app/api/metrics`, `app/api/posts`, `app/api/calendar`, `app/api/calendar/[id]`, `app/api/connection`, `app/api/scripts`, `app/api/ideas`, `app/api/ideas/[id]`, `app/api/reports`) | Todas pasan a llamar `getSessionUser()` primero y `activeWorkspace(user.id)` en vez de `activeWorkspace()`. Si el usuario no tiene Workspace, responden 409 con un mensaje claro ("Conectá tu primera cuenta de Instagram en /conexion") en vez de que la función lance una excepción genérica. |
| `app/api/cron/sync/route.ts`, `lib/maintenance.ts` | **Sin cambios** — siguen usando `listAccounts()` global a propósito (el cron sincroniza todas las cuentas de todos los usuarios). |
| `components/layout/Sidebar.tsx` | Se agrega, en el footer, el nombre/avatar del usuario logueado (de `getSessionUser()`, pasado desde un server component padre) y un botón "Cerrar sesión" que llama `POST /api/auth/signout` y redirige a `/login`. |
| `components/layout/AccountSwitcher.tsx` | Estado vacío cuando `accounts.length === 0`: en vez de quedarse en skeleton infinito, muestra un CTA "Conectá tu primera cuenta" que lleva a `/conexion`. |
| `app/conexion/page.tsx` | Ajustar el estado inicial para que el flujo de "Añadir cuenta" sea el camino principal (no secundario) cuando no hay ninguna cuenta todavía — copy de bienvenida para el primer Workspace. |
| `app/api/health/route.ts` | El flag `auth` pasa a reflejar `isAuthEnabled()` (URL + anon key) en vez de `Boolean(process.env.OWNER_EMAIL)`. |
| `.env.example` | `OWNER_EMAIL` se redocumenta como `LEGACY_OWNER_EMAIL` (uso único, para el reclamo de datos existentes — ver Paso 3) y se agregan las instrucciones de Google OAuth. |
| `DEPLOY.md` | Se agrega la sección "Configurar login con Google" (pasos en Google Cloud Console + Supabase Dashboard, ver Paso 1). |
| `Estado de el sistema.md` | Se actualiza la sección de autenticación para reflejar Google OAuth abierto + aislamiento por usuario (siguiendo la instrucción de CLAUDE.md de mantener la documentación viva). |

### Archivos a Eliminar

| Ruta | Por qué |
| --- | --- |
| `app/api/auth/request-link/route.ts` | El login por magic-link se reemplaza por completo por Google OAuth. |
| `app/auth/confirm/route.ts` | Era el destino del magic-link (`verifyOtp`); Google usa un flujo distinto (`exchangeCodeForSession`) en `app/auth/callback/route.ts`. |

---

## Decisiones de Diseño

### Decisiones Clave Tomadas

1. **Login abierto a cualquier cuenta de Google, sin allowlist** — decisión del usuario: quieren validar el modelo SaaS real desde ya, probando con las marcas personales del equipo. Un allowlist habría sido más simple de acotar, pero no responde a "queremos que esto sea SaaS".
2. **Se reemplaza el magic-link por completo (no coexisten)** — decisión del usuario: un solo método de login reduce superficie de mantenimiento (menos rutas, menos estados de error, menos que romper) para un equipo chico. Esto implica borrar, no solo agregar.
3. **Aislamiento real por usuario (`owner_user_id` en cada Workspace)** — decisión del usuario, y la única opción segura una vez que el login se abre a cualquier cuenta. La alternativa ("todos comparten los mismos Workspaces") habría dejado ver/editar/borrar datos ajenos a cualquiera que entrara.
4. **`listAccounts()` (global) se conserva intacta para el cron** — el cron (`/api/cron/sync`) necesita sincronizar *todas* las cuentas de *todos* los usuarios, no las de un usuario en particular; no tiene sesión de usuario porque lo llama un scheduler externo con `CRON_SECRET`. Se agrega `listAccountsForUser()` como función nueva en paralelo, no se reemplaza la global.
5. **Reclamo de los datos legacy vía variable de entorno de un solo uso (`LEGACY_OWNER_EMAIL`)** — la cuenta `@scav_86` y cualquier Workspace creado antes de este cambio no tiene `owner_user_id`. En vez de asignarlos a "quien entre primero" (inseguro: cualquiera que probara el login antes que el dueño real se los quedaría) o dejarlos huérfanos (el dueño real perdería acceso a sus propios datos), se usa una variable de entorno que solo el equipo conoce: la primera vez que un usuario con ese correo entra, el sistema le asigna automáticamente los Workspaces sin dueño. Una vez reclamados, la variable puede borrarse — no vuelve a hacer nada.
6. **`getSessionUser()` devuelve un usuario fijo `local-dev` en modo demo** — preserva la promesa existente de "sin llaves de Supabase, la app corre local sin fricción" (ver `CLAUDE.md`/auditoría). Sin esto, correr `npm run dev` sin configurar Supabase dejaría de funcionar porque ninguna ruta sabría "de quién" son los Workspaces.
7. **Los errores de "cuenta no encontrada" y "cuenta de otro usuario" devuelven el mismo 404** — no confirmar la existencia de un `id` ajeno evita que un usuario pueda usar los mensajes de error para enumerar cuentas de otros.

### Alternativas Consideradas

- **RLS de Postgres por fila** — descartado: `app_store` guarda una colección entera como un solo `jsonb` por clave (no una fila por Workspace), así que RLS no puede filtrar Workspaces individuales sin rediseñar el esquema completo (que es justamente la deuda que señala `Estado de el sistema.md` sobre `001_schema.sql` vs `002_app_store.sql`, fuera de alcance de este plan). El aislamiento se hace en la capa de aplicación (`lib/accounts.ts`), igual que ya hace el sistema de namespacing por cuenta (`ideas__acc_123`).
- **Tabla `profiles` espejo de `auth.users`** — descartado por ahora: Supabase Auth ya guarda email, nombre y avatar de Google en `user_metadata`; no hace falta duplicarlo. Si el futuro SaaS necesita planes/roles/facturación, ahí sí se justifica una tabla propia — se deja como nota en "Notas".
- **Seguir soportando magic-link como alternativa** — descartado por decisión explícita del usuario (simplicidad de mantenimiento).

### Preguntas Abiertas

- Ninguna bloqueante — las tres decisiones de producto (acceso, método de login, aislamiento) ya están tomadas. Antes de ejecutar el Paso 1 hace falta que el usuario cree el OAuth Client de Google (ver Paso 1) y decida qué correo va en `LEGACY_OWNER_EMAIL` (probablemente `covarrubiasmataemiliano@gmail.com` u otro correo del equipo con el que vayan a entrar primero).

---

## Tareas Paso a Paso

### Paso 1: Configurar Google OAuth en Supabase (manual, fuera del código)

No es código — es configuración externa, pero bloquea todo lo demás.

**Acciones:**

- En Google Cloud Console: crear un OAuth Client ID (tipo "Web application"). Origen autorizado: la URL de producción y `http://localhost:3333`. URI de redirección autorizado: `https://<proyecto>.supabase.co/auth/v1/callback` (Supabase la muestra en su panel).
- En el Dashboard de Supabase → Authentication → Providers → Google: activar, pegar Client ID y Client Secret.
- En Authentication → URL Configuration: confirmar que Site URL y Redirect URLs incluyen `http://localhost:3333/auth/callback` y `https://<dominio-produccion>/auth/callback`.
- Documentar estos pasos en `DEPLOY.md` (ver Paso 8).

**Archivos afectados:**

- Ninguno todavía (configuración externa) — se documenta en `DEPLOY.md`.

---

### Paso 2: Cliente de navegador y helper de sesión en servidor

**Acciones:**

- Crear `lib/supabase-browser.ts`:
  ```ts
  import { createBrowserClient } from '@supabase/ssr';

  export function supabaseBrowser() {
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  ```
- Crear `lib/auth.ts` con `getSessionUser()`:
  - Si `!isAuthEnabled()` (modo demo, sin Supabase) → devuelve `{ id: 'local-dev', email: 'demo@local', name: 'Demo', avatarUrl: null }`.
  - Si hay Supabase configurado: crea un `createServerClient` (patrón idéntico al de `middleware.ts`, leyendo cookies vía `next/headers`), llama `auth.getUser()`, y devuelve `null` si no hay sesión o el `{ id, email, name, avatarUrl }` armado desde `user.email` y `user.user_metadata.full_name` / `user.user_metadata.avatar_url` (los campos que Google entrega).
  - Exportar también un tipo `SessionUser`.

**Archivos afectados:**

- `lib/supabase-browser.ts` (nuevo)
- `lib/auth.ts` (nuevo)

---

### Paso 3: `lib/accounts.ts` — dueño por Workspace y funciones "por usuario"

**Acciones:**

- Agregar `owner_user_id: string | null` a la interfaz `Workspace` (`null` = legacy sin reclamar todavía).
- `bootstrapLegacy()`: al crear el Workspace legacy, dejar `owner_user_id: null` (se reclama en el siguiente punto).
- Nueva función:
  ```ts
  export async function listAccountsForUser(userId: string): Promise<Workspace[]> {
    return (await listAccounts()).filter((w) => w.owner_user_id === userId);
  }
  ```
- Nueva función `getAccountForUser(id, userId)`: como `getAccount`, pero además exige `owner_user_id === userId`; devuelve `null` en caso contrario (mismo camino que "no existe", ver Decisión #7).
- `createAccount(input)`: agregar campo obligatorio `ownerUserId: string` a `input`; el `Workspace` creado se guarda con `owner_user_id: input.ownerUserId`.
- `updateAccount`/`deleteAccount`: agregar parámetro `userId`; antes de mutar, verificar que `rows[idx].owner_user_id === userId` (o `getAccountForUser` primero) — si no, lanzar el mismo error que "cuenta no encontrada".
- `activeWorkspace(userId: string)`: cambiar la firma actual (sin argumentos) a requerir `userId`. Nueva lógica:
  ```ts
  export async function activeWorkspace(userId: string): Promise<Workspace> {
    const mine = await listAccountsForUser(userId);
    if (mine.length === 0) {
      throw new Error('SIN_WORKSPACE'); // la API lo traduce a 409 con mensaje claro
    }
    let selected: string | undefined;
    try {
      selected = (await cookies()).get(ACTIVE_COOKIE)?.value;
    } catch {}
    return mine.find((w) => w.id === selected) ?? mine[0];
  }
  ```
  (Nótese que ahora busca solo dentro de `mine` — una cookie con el id de la cuenta de otro usuario ya no puede "colarse".)
- Nueva función `claimLegacyWorkspaces(userId: string, email: string): Promise<number>`:
  ```ts
  export async function claimLegacyWorkspaces(userId: string, email: string): Promise<number> {
    const legacyOwnerEmail = process.env.LEGACY_OWNER_EMAIL;
    if (!legacyOwnerEmail || legacyOwnerEmail.toLowerCase() !== email.toLowerCase()) return 0;
    const rows = await listAccounts();
    let claimed = 0;
    for (const w of rows) {
      if (!w.owner_user_id) {
        w.owner_user_id = userId;
        claimed++;
      }
    }
    if (claimed > 0) await saveAccounts(rows);
    return claimed;
  }
  ```

**Archivos afectados:**

- `lib/accounts.ts`

---

### Paso 4: API routes — sesión + propiedad

**Acciones:**

- `app/api/accounts/route.ts`:
  - `GET`: `const user = await getSessionUser(); if (!user) return 401;` luego `listAccountsForUser(user.id)`. Si está vacío, `active` es `null` (no llamar `activeWorkspace` cuando no hay cuentas).
  - `POST`: agregar `ownerUserId: user.id` al llamar `createAccount`.
- `app/api/accounts/[id]/route.ts`: `PATCH`/`DELETE` resuelven la cuenta con `getAccountForUser(id, user.id)` antes de tocarla; 404 si no es del usuario.
- `app/api/accounts/active/route.ts`: usa `getAccountForUser(id, user.id)`.
- `app/api/accounts/probe/route.ts`: revisar su contenido actual y aplicar el mismo patrón si toca un Workspace por id.
- Las 9 rutas que hoy llaman `activeWorkspace()` sin argumentos (`metrics`, `posts`, `calendar`, `calendar/[id]`, `connection`, `scripts`, `ideas`, `ideas/[id]`, `reports`): agregar al inicio de cada handler
  ```ts
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  let ws;
  try {
    ws = await activeWorkspace(user.id);
  } catch (err) {
    if ((err as Error).message === 'SIN_WORKSPACE') {
      return NextResponse.json(
        { error: 'Todavía no conectaste ninguna cuenta de Instagram.' },
        { status: 409 }
      );
    }
    throw err;
  }
  ```
  reemplazando el `await activeWorkspace()` existente.

**Archivos afectados:**

- `app/api/accounts/route.ts`
- `app/api/accounts/[id]/route.ts`
- `app/api/accounts/active/route.ts`
- `app/api/accounts/probe/route.ts`
- `app/api/metrics/route.ts`
- `app/api/posts/route.ts`
- `app/api/calendar/route.ts`
- `app/api/calendar/[id]/route.ts`
- `app/api/connection/route.ts`
- `app/api/scripts/route.ts`
- `app/api/ideas/route.ts`
- `app/api/ideas/[id]/route.ts`
- `app/api/reports/route.ts`

---

### Paso 5: Reemplazar el login (UI + rutas de auth)

**Acciones:**

- Reescribir `app/login/page.tsx`: quitar el formulario de correo; un solo botón "Continuar con Google" (ícono de Google + texto) que llama:
  ```ts
  await supabaseBrowser().auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  });
  ```
  Conservar el manejo de `?error=` (agregar el caso `sin_workspace` si aplica, y mantener `enlace_invalido` → renombrar a un mensaje genérico de error de login). Quitar el copy "acceso restringido — solo el correo autorizado".
- Crear `app/auth/callback/route.ts` (reemplaza a `app/auth/confirm/route.ts`):
  ```ts
  export async function GET(req: NextRequest) {
    const code = req.nextUrl.searchParams.get('code');
    const origin = req.nextUrl.origin;
    if (!code) return NextResponse.redirect(`${origin}/login?error=enlace_invalido`);

    const res = NextResponse.redirect(`${origin}/resumen`);
    const supabase = createServerClient(/* igual patrón que middleware.ts, con res */);
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(`${origin}/login?error=enlace_invalido`);

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await claimLegacyWorkspaces(user.id, user.email ?? '');
      const mine = await listAccountsForUser(user.id);
      if (mine.length === 0) {
        return NextResponse.redirect(`${origin}/conexion`);
      }
    }
    return res;
  }
  ```
- Borrar `app/api/auth/request-link/route.ts` y `app/auth/confirm/route.ts`.
- `middleware.ts`: quitar el bloque `if (user.email?.toLowerCase() !== owner...)` completo (incluida la variable `owner`); agregar `/auth/callback` a `PUBLIC_PREFIXES` (ya cubierto por el prefijo `/auth`, confirmar que sigue funcionando).
- `lib/supabase.ts`: `isAuthEnabled()` sin el `&& process.env.OWNER_EMAIL`.
- `app/api/health/route.ts`: `auth: isAuthEnabled()` en vez de `Boolean(process.env.OWNER_EMAIL)`.

**Archivos afectados:**

- `app/login/page.tsx`
- `app/auth/callback/route.ts` (nuevo)
- `app/auth/confirm/route.ts` (eliminar)
- `app/api/auth/request-link/route.ts` (eliminar)
- `middleware.ts`
- `lib/supabase.ts`
- `app/api/health/route.ts`

---

### Paso 6: Identidad de usuario y cerrar sesión en la UI

**Acciones:**

- `app/layout.tsx` o un nuevo server component envoltorio: leer `getSessionUser()` en servidor y pasarlo a `AppShell`/`Sidebar` como prop (evitar hacerlo desde el cliente para no exponer una llamada extra).
- `components/layout/Sidebar.tsx`: en el footer (donde hoy dice "v1.0 · Producción/Modo demo"), agregar arriba una fila con avatar (si `avatarUrl`, `<img>`; si no, iniciales) + nombre/correo del usuario, y un botón "Cerrar sesión" que hace `POST /api/auth/signout` y luego `router.push('/login')` (esto requiere que `Sidebar` sea o incluya una parte cliente para el `onClick`; puede quedar como sub-componente `'use client'` `UserMenu`).

**Archivos afectados:**

- `app/layout.tsx`
- `components/layout/Sidebar.tsx`
- `components/layout/UserMenu.tsx` (nuevo, si se separa la parte cliente)

---

### Paso 7: Estados vacíos para usuarios sin Workspaces

**Acciones:**

- `components/layout/AccountSwitcher.tsx`: cuando `data?.accounts.length === 0` (y no `isLoading`), mostrar un botón "Conectá tu primera cuenta de Instagram" en vez del skeleton de carga infinito, enlazando a `/conexion`.
- `app/conexion/page.tsx`: si `accounts.length === 0`, abrir el flujo de "Añadir cuenta" como estado principal de la página (no como acción secundaria detrás de una lista vacía) — ajustar el copy de bienvenida.
- Revisar que las páginas que dependen de `activeWorkspace` (`/resumen`, `/control`, `/videos`, etc.) no truenen si la API devuelve 409 `SIN_WORKSPACE`: deben mostrar un estado "conectá tu primera cuenta" en vez de un error genérico. (Confirmar el patrón de manejo de errores ya usado en esas páginas con React Query y replicarlo — no reinventar.)

**Archivos afectados:**

- `components/layout/AccountSwitcher.tsx`
- `app/conexion/page.tsx`
- Páginas cliente que consultan datos de Workspace (revisar `app/resumen/page.tsx` y similares durante la implementación)

---

### Paso 8: Variables de entorno y documentación

**Acciones:**

- `.env.example`: quitar `OWNER_EMAIL` de la sección de producción; agregar:
  ```
  # ══ LOGIN CON GOOGLE ═════════════════════════════════════════
  # Configurar el provider de Google en Supabase Dashboard →
  # Authentication → Providers (ver DEPLOY.md). No hace falta ninguna
  # variable extra acá — las credenciales de Google viven en Supabase.

  # Correo que reclama, la primera vez que entra, las cuentas de
  # Instagram creadas ANTES de este cambio (que todavía no tienen
  # dueño). Usalo una sola vez y después podés borrarlo.
  LEGACY_OWNER_EMAIL=
  ```
- `DEPLOY.md`: agregar sección "Login con Google" con los pasos del Paso 1 de este plan.
- `Estado de el sistema.md`: actualizar la sección de seguridad/auth para reflejar: login Google abierto, aislamiento por `owner_user_id`, sin allowlist.
- `CLAUDE.md`: no requiere cambios de estructura (este plan no agrega comandos ni carpetas nuevas al workspace de Claude), pero revisar si "Instrucción Crítica: Mantener Este Archivo" aplica — no aplica aquí porque no cambia la estructura de `contexto/`, `planes/`, etc.

**Archivos afectados:**

- `.env.example`
- `DEPLOY.md`
- `Estado de el sistema.md`

---

### Paso 9: Validación manual

**Acciones:**

- Correr local sin Supabase configurado (`npm run dev`): confirmar que la app sigue funcionando sin login (modo demo, `getSessionUser()` devuelve `local-dev`).
- Configurar Supabase + Google OAuth en un entorno de prueba: entrar con la cuenta del equipo (la de `LEGACY_OWNER_EMAIL`) y confirmar que la cuenta `@scav_86` (u otro Workspace legacy) aparece reclamada automáticamente.
- Entrar con una **segunda** cuenta de Google (personal, ajena al equipo): confirmar que ve `accounts: []`, que `/conexion` la guía a conectar su primera cuenta, y que ninguna ruta le devuelve datos del primer usuario.
- Con la segunda cuenta, intentar `PATCH`/`DELETE /api/accounts/<id-del-primer-usuario>` y `POST /api/accounts/active` con ese `id` directamente (curl o devtools): confirmar 404 en los tres casos.
- Confirmar que "Cerrar sesión" desde `Sidebar` realmente termina la sesión (recargar y quedar redirigido a `/login`).
- Confirmar que `GET /api/cron/sync` (con `CRON_SECRET`) sigue sincronizando **todas** las cuentas de **ambos** usuarios de prueba.

---

## Conexiones y Dependencias

### Archivos que Referencian Esta Área

- Todas las rutas de API bajo `app/api/` que hoy llaman `activeWorkspace()` o `listAccounts()` (listadas en el Paso 4).
- `components/layout/AccountSwitcher.tsx` y `app/conexion/page.tsx` consumen `GET /api/accounts`, cuyo shape de respuesta no cambia (sigue siendo `{ accounts, activeId }`) — solo cambia que `activeId` puede ser `null`.
- `lib/maintenance.ts` y `app/api/cron/sync/route.ts` dependen de `listAccounts()` global — **no tocar su firma**.

### Actualizaciones Necesarias para Consistencia

- `.env.example`, `DEPLOY.md`, `Estado de el sistema.md` (Paso 8).
- Cualquier README o nota que mencione "acceso restringido a un solo correo" (buscar referencias a `OWNER_EMAIL` fuera de código, ya cubiertas por el grep hecho en la investigación: `DEPLOY.md` y `Estado de el sistema.md`).

### Impacto en Flujos de Trabajo Existentes

- El flujo de "Añadir cuenta" en `/conexion` (Zernio) no cambia en su lógica de conexión — solo gana el parámetro `ownerUserId` al crear el Workspace.
- El cron diario no cambia de comportamiento (sigue siendo global).
- Cualquier sesión activa de un usuario ya logueado con magic-link quedará inválida tras el deploy (se elimina esa ruta) — el usuario deberá volver a entrar, esta vez con Google. Vale la pena avisarlo si hay alguna sesión "viva" en producción al momento de desplegar.

---

## Lista de Validación

- [ ] Login funciona de punta a punta con una cuenta de Google real (`signInWithOAuth` → `app/auth/callback` → sesión creada → redirect correcto).
- [ ] `middleware.ts` ya no contiene ninguna referencia a `OWNER_EMAIL` ni a un allowlist de correo.
- [ ] Un usuario nuevo (sin Workspaces) puede entrar, ve el estado vacío en `/conexion`, conecta su primera cuenta de Zernio y queda como `owner_user_id` de ese Workspace.
- [ ] El correo de `LEGACY_OWNER_EMAIL` reclama automáticamente los Workspaces preexistentes la primera vez que entra, y no vuelve a reclamar nada en logins posteriores (idempotente).
- [ ] Ningún endpoint de Workspaces (`/api/accounts*`, ni las 9 rutas que resuelven `activeWorkspace`) devuelve datos de una cuenta que no pertenece al usuario autenticado — verificado con una segunda cuenta de prueba.
- [ ] `PATCH`/`DELETE /api/accounts/[id]` y `POST /api/accounts/active` devuelven 404 al intentar operar sobre el `id` de un Workspace ajeno.
- [ ] El cron (`/api/cron/sync`) sigue procesando las cuentas de todos los usuarios sin cambios de comportamiento.
- [ ] Botón "Cerrar sesión" visible y funcional en `Sidebar`, muestra el nombre/avatar del usuario logueado.
- [ ] Modo demo local (`npm run dev` sin Supabase) sigue funcionando sin pedir login.
- [ ] `app/api/auth/request-link/route.ts` y `app/auth/confirm/route.ts` ya no existen en el repo.
- [ ] `.env.example`, `DEPLOY.md` y `Estado de el sistema.md` reflejan el nuevo esquema de auth.

## Criterios de Éxito

1. Cualquier persona con una cuenta de Google puede crear su propio espacio de trabajo en ContentOS sin intervención manual del equipo.
2. Es imposible, vía la UI o llamando a la API directamente, que un usuario lea, edite, borre o active el Workspace de otro usuario.
3. Los datos y el flujo de trabajo actuales del equipo (cuenta `@scav_86`, ideas, calendario, reportes ya generados) siguen intactos y accesibles después del cambio, ahora bajo la cuenta de Google del dueño.
4. El cron diario sigue sincronizando todas las cuentas conectadas, sin importar de qué usuario sean.

---

## Notas

- Este plan **no** incluye: roles/permisos dentro de un mismo Workspace compartido entre varias personas, planes de precio/facturación, ni invitar colaboradores a una misma cuenta de Instagram — son pasos lógicos siguientes del camino a SaaS, pero no estaban en el pedido de hoy ("necesito login con Google y probarlo con nuestras marcas").
- Cuando llegue el momento de facturación/roles, ahí sí se justifica una tabla `profiles`/`organizations` propia en vez de apoyarse solo en `auth.users` — dejar anotado para un plan futuro.
- La deuda ya señalada en `Estado de el sistema.md` (esquema `app_store` como key-value plano, sin tests, sin rate limiting) no se resuelve acá; de hecho, al multiplicar usuarios, el riesgo de "cero tests" en el código de aislamiento de datos (`lib/accounts.ts`) sube de prioridad — vale la pena que el próximo plan después de este sea agregar tests, empezando justo por `listAccountsForUser`/`getAccountForUser`/`claimLegacyWorkspaces`.
