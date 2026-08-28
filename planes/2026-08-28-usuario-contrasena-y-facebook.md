# Plan — Login con usuario/contraseña + cuentas de Facebook

Fecha: 2026-08-28
Estado: implementado

## Qué pidió el usuario

1. "Me gustaría que cada usuario tuviese su usuario y contraseña" — hoy el único
   modo de entrar es Google.
2. "Ya conecté Zernio y a Zernio están conectadas mis cuentas de IG y FB, pero en
   ContentOS solo veo IG" — hay que poder añadir Páginas de Facebook.

## Decisión de alcance

**Contraseña convive con Google, no lo reemplaza.** El usuario ya entró con Google
y su workspace pertenece a ese identificador; quitar Google lo dejaría fuera. Además
él mismo dijo que entrar con Google "no está mal". Registro abierto, coherente con la
decisión previa de no tener lista blanca.

**Fuera de alcance en v1: recuperar contraseña por correo.** Necesita un proveedor de
email (Resend/SMTP) que no está contratado. Mitigación: quien entró con Google puede
definir su contraseña desde `/cuenta` sin perder su cuenta.

---

## Parte A — Usuario y contraseña

### El problema real: dos logins, un solo usuario

Hoy `owner_user_id` de cada workspace es el `sub` de Google. Si el login por
contraseña generase un id nuevo, el mismo humano entraría a un panel vacío. Por eso
se añade una tabla de usuarios donde **el correo es la identidad** y los dos métodos
convergen en la misma fila.

Detalle que evita cualquier migración de datos: cuando la fila se crea desde Google,
su `id` **es** el `sub` de Google. Así los workspaces que ya existen siguen apuntando
a su dueño sin tocar un solo registro.

### Piezas

| Archivo | Rol |
|---|---|
| `lib/auth-flags.ts` | predicados de entorno puros (sin imports) — los usa el middleware, que corre en el Edge |
| `lib/password.ts` | hash PBKDF2-SHA256 (210k iter.) con WebCrypto — cero dependencias nuevas |
| `lib/users.ts` | colección `users` en el almacén; alta, verificación y enlace Google↔correo |
| `auth.config.ts` | configuración compartida y apta para Edge (la usa el middleware) |
| `auth.ts` | añade el provider `Credentials` (solo Node) sobre esa base |
| `app/api/auth/register/route.ts` | alta pública |
| `app/api/auth/password/route.ts` | definir/cambiar contraseña, ya autenticado |
| `app/cuenta/page.tsx` | pantalla de cuenta con el formulario de contraseña |
| `app/login/page.tsx` | pestañas Entrar / Crear cuenta + botón de Google |

### Regla de seguridad al registrarse

Si el correo ya existe **como cuenta de Google sin contraseña**, el alta se rechaza.
Permitirla sería secuestrar la cuenta de alguien con solo saber su correo. La vía
correcta es entrar con Google y definir la contraseña desde `/cuenta`.

### Middleware

`middleware.ts` no puede importar `auth.ts` una vez que este arrastra `pg`. Se parte
la configuración en `auth.config.ts` (patrón estándar de Auth.js v5). El middleware
solo decodifica la cookie JWT, que es apto para Edge.

---

## Parte B — Cuentas de Facebook

### Causa

`lib/zernio.ts` fija `platform: 'instagram'` en `GET /v1/accounts`. La API de Zernio
trata ese parámetro como **opcional** (verificado en el SDK oficial,
`zernio-dev/zernio-node`, tipo `ListAccountsData`): omitirlo devuelve todas las
plataformas. Lo mismo en `/v1/analytics`, donde `platform` es opcional y ya se filtra
por `accountId`.

### Cambios

1. `listInstagramAccounts` → `listConnectedAccounts`: sin filtro de plataforma, y se
   queda con `instagram` y `facebook` (no con anuncios, WhatsApp, etc.).
2. `Workspace.platform`: `'instagram' | 'facebook'`. Las filas existentes no lo
   traen; se leen como `instagram`.
3. `/v1/analytics` deja de mandar `platform`.
4. Las métricas que Facebook no entrega (guardados, watch time de reels) ya caían a
   `0`/`null` — no hace falta tocar el mapeo.
5. UI: distintivo de plataforma en el selector, en la lista de cuentas y al añadir.
   La arroba solo se antepone en Instagram; una Página se llama por su nombre.
6. Corrección de paso: el avatar salía de `metadata.profileData.profileUrl`, que es
   el **enlace al perfil**, no la imagen. El campo correcto es `profilePicture`.

---

## Verificación

- `npx tsc --noEmit` limpio.
- Login con contraseña recién creada, y con Google, llegan al mismo panel.
- Registro con un correo que ya entró por Google → rechazado con mensaje claro.
- `/api/accounts/probe` devuelve también las Páginas de Facebook.
