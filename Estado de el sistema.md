# 🔍 Auditoría Técnica Completa — ContentOS

**Proyecto:** Content OS · Command Center
**Fecha:** 28 de agosto de 2026 (actualizado tras la migración a Railway/Auth.js y el soporte de Facebook)
**Alcance:** Arquitectura, stack, capacidades, fortalezas, debilidades

---

## 1. Visión General del Sistema

ContentOS es un **dashboard multiusuario de Instagram y Facebook** para creadores de contenido. Funciona como un "Command Center" que centraliza métricas, generación de guiones con IA, reportes, banco de ideas, banco de fuentes y calendario editorial.

El sistema ya es **SaaS multiusuario real**: cualquier cuenta de Google puede entrar (sin allowlist), o darse de alta con usuario/contraseña, y cada quien ve únicamente los workspaces (cuentas de Instagram o Páginas de Facebook) que conectó con su propia API key de Zernio. Falta lo que aún no se ha construido para venderlo como producto: planes, facturación, roles dentro de un mismo workspace.

| Dato | Valor |
|---|---|
| **Líneas de código** | ~8,000 (TypeScript/TSX) |
| **Páginas** | 10 vistas principales + login |
| **API Routes** | 18 endpoints REST |
| **Módulos de negocio** | 16 archivos en `lib/` |

---

## 2. Stack Tecnológico / Infraestructura

### Frontend

| Tecnología | Versión | Rol |
|---|---|---|
| **Next.js** | 15.5 (App Router) | Framework principal, SSR + API routes |
| **React** | 19.0.0 | Librería de UI |
| **TypeScript** | 5.7.3 | Tipado estático |
| **Tailwind CSS** | 3.4.17 | Estilos utility-first |
| **Recharts** | 2.15.0 | Gráficas y visualizaciones |
| **Lucide React** | 0.474.0 | Iconografía |
| **TanStack Query** | 5.64.0 | Cache y estado servidor |
| **Zustand** | 5.0.3 | Estado global cliente (declarado, uso limitado) |
| **date-fns** | 4.1.0 | Manipulación de fechas |
| **clsx + tailwind-merge** | — | Composición de clases |
| **Inter** (Google Fonts) | — | Tipografía |

### Backend / Auth

| Tecnología | Rol |
|---|---|
| **Next.js API Routes** | Endpoints REST (server-side) |
| **Auth.js v5** (`next-auth` beta) | Login con Google (abierto, sin allowlist) y usuario/contraseña; sesiones JWT |
| **Zod** | Validación de payloads, tolerante a datos parciales de Zernio |
| **WebCrypto (AES-256-GCM)** | Cifrado de API keys de Zernio en reposo |
| **scrypt** (`lib/password.ts`) | Hash de contraseñas de usuario |
| **Anthropic API (Claude Sonnet 5)** | Generación de guiones y reportes con IA |

### Datos

| Componente | Modo | Rol |
|---|---|---|
| **Archivos JSON** (`data/`) | Desarrollo / Demo | Almacén local sin dependencias |
| **Postgres propio en Railway** | Producción | BD dedicada del proyecto (ya no Supabase) |
| **Tabla `app_store`** | Producción | Key-value store (`text` → `jsonb`) |

Supabase quedó **retirado por completo**: la BD de producción es un servicio de Postgres levantado en el mismo proyecto de Railway, en su red privada. `supabase/migrations/002_app_store.sql` se conserva solo como referencia del esquema (misma tabla `app_store`, ahora en Postgres propio).

### Fuente de Datos: Instagram y Facebook

| Servicio | Rol |
|---|---|
| **[Zernio](https://zernio.com)** | Proxy a Instagram y Facebook. Evita necesitar app de Meta propia. Cada usuario trae su propia API key, que puede tener conectadas varias cuentas de IG **y** Páginas de Facebook a la vez |

Una sola API key de Zernio puede traer varias cuentas — de ambas plataformas — y el modal de "Añadir cuenta" permite darlas de alta una por una sin volver a pegar la key.

### Hosting / Deploy

| Opción | Estado | Detalles |
|---|---|---|
| **Railway** | **En producción** | Servicio de la app + servicio de Postgres, ambos en el mismo proyecto/red privada. `railway.json` (Config-as-Code declarado deprecado por Railway a favor de `.railway/railway.ts`, sigue funcionando hasta dic. 2026) |
| **Cloudflare Workers** | Retirado | Ya no soportado: `pg` no corre en Workers. Quedan archivos sin uso (`open-next.config.ts`, `wrangler`) |
| **Local** (desarrollo) | Funcional | `npm run dev` en puerto 3333, modo demo sin keys, login desactivado si no hay `AUTH_SECRET`/credenciales de Google |

### Cron / Tareas Programadas

| Plataforma | Mecanismo | Estado |
|---|---|---|
| Railway | Servicio separado con `railway.cron.json` ejecutando `scripts/railway-cron.mjs` | **Pendiente de configurar** — el servicio aún no existe en el proyecto de Railway |
| Genérico | `GET /api/cron/sync` con Bearer token (`CRON_SECRET`) | Implementado, listo para que el servicio cron lo llame |

---

## 3. Arquitectura del Sistema

### Diagrama de Arquitectura

```
┌─────────────────────────────────────────────────┐
│                CLIENTE (Browser)                │
│  ┌──────────────────┐  ┌──────────────────────┐ │
│  │ Páginas React     │  │ TanStack Query       │ │
│  │ (App Router)      │──│ (cache + refetch)    │ │
│  └──────────────────┘  └──────────┬───────────┘ │
└───────────────────────────────────┼─────────────┘
                                    │ fetch
┌───────────────────────────────────┼─────────────┐
│              SERVIDOR (Next.js)   │             │
│  ┌────────────────────┐           │             │
│  │ Middleware (Edge)   │ ← Auth.js: Google       │
│  │ auth.config.ts       │  + usuario/contraseña   │
│  └────────┬───────────┘                         │
│           ▼                                     │
│  ┌────────────────────┐                         │
│  │ API Routes          │ ← 18 endpoints REST    │
│  │ (server-side, Node) │                        │
│  └────────┬───────────┘                         │
│           ▼                                     │
│  ┌────────────────────┐                         │
│  │ Módulos de negocio  │                        │
│  │ (lib/)              │                        │
│  └──┬─────┬─────┬─────┘                        │
└─────┼─────┼─────┼──────────────────────────────-┘
      │     │     │
      ▼     ▼     ▼
┌─────────┐ ┌─────────┐ ┌──────────────┐
│ Zernio  │ │Anthropic│ │Postgres propio│
│(IG+FB)  │ │(Claude) │ │(Railway)      │
└─────────┘ └─────────┘ └──────────────┘

      ▲
      │ GET /api/cron/sync (Bearer)
┌─────┴──────────┐
│ CRON (7 AM)    │
│ Railway         │ ← servicio pendiente de crear
└────────────────┘
```

Nota de runtime: `middleware.ts` importa `auth.config.ts`, **no** `auth.ts` — el middleware corre en el Edge de Next.js, donde `pg` no puede cargarse. `auth.ts` (Node) trae los providers reales (Google + Credentials) y todo lo que toca Postgres; `auth.config.ts` solo sabe leer la cookie JWT. Esta separación es lo que mantiene el bundle del Middleware en ~86 kB y evita que una importación indebida de `pg` rompa el build.

### Patrón de Almacenamiento: Key-Value Dual

La pieza más original de la arquitectura es `lib/db.ts`:

```
db.ts → ¿DATABASE_URL definida?
  ├─ SÍ → Postgres, tabla app_store (key text PK, value jsonb)
  └─ NO → data/{nombre}.json
```

Las mismas funciones (`readCollection`, `writeCollection`, `readSingleton`, `writeSingleton`) abstraen los dos backends. **Esto permite correr la app completa sin ninguna dependencia externa.**

### Autenticación y Registro de Usuarios

- **Dos puertas, una identidad**: `lib/users.ts` unifica Google y usuario/contraseña bajo el mismo correo (en minúsculas) como clave. Quien entró primero con Google puede después ponerse contraseña desde `/cuenta` sin perder sus workspaces — el `id` de la fila sigue siendo el `sub` de Google, así que nada necesita migrarse.
- **Alta pública por contraseña** (`/api/auth/register`) rechaza correos que ya entran por Google, para que nadie "complete" esa cuenta sabiendo solo el correo.
- **Login abierto**: cualquier cuenta de Google es válida, sin allowlist — es multiusuario real.
- Auth se **autodesactiva** si no hay `AUTH_SECRET` configurado (modo local/demo, app abierta).

### Sistema Multicuenta (Workspaces)

`lib/accounts.ts` implementa un sistema de **workspaces**, uno por cuenta de Instagram o Página de Facebook:

- Cada Workspace tiene un **dueño** (`owner_user_id`, el id del usuario en `lib/users.ts`) — un usuario
  solo ve, cambia y sincroniza los suyos (`listAccountsForUser`, `getAccountForUser`)
- `PLATFORMS = ['instagram', 'facebook']` — el mismo modelo de workspace sirve para ambas plataformas
- La cuenta activa se persiste en una cookie `httpOnly` (`co_account`), resuelta
  siempre dentro de las cuentas del usuario logueado
- Las colecciones se separan por **namespace**: `ideas__acc_123`, `calendar_items__acc_123`
- La primera cuenta ("legacy") conserva claves sin sufijo para evitar migraciones
- Las API keys de Zernio se guardan **cifradas** con AES-256-GCM (`lib/crypto.ts`) por workspace — cada workspace puede tener su propia key, y el modal de alta reutiliza una key ya pegada para dar de alta varias cuentas seguidas sin repetir el paso

### Seguridad

- **Login**: Auth.js v5 con sesiones JWT — Google OAuth (abierto, sin allowlist) o
  usuario/contraseña (scrypt), ambos resolviendo a la misma fila de usuario
- **Middleware** (`middleware.ts`, Edge): exige sesión para toda la app salvo las
  rutas públicas (`/login`, `/api/auth`, `/api/cron`, `/api/health`)
- **Aislamiento de datos**: cada Workspace tiene dueño (`owner_user_id`); las
  rutas de cuentas verifican propiedad antes de leer/editar/borrar/activar
  (`getAccountForUser`) — cierra el IDOR que existía antes de abrir el login
- **Cifrado**: AES-256-GCM vía WebCrypto para las API keys de Zernio
- **Base de datos**: solo el servidor la toca (no hay cliente anónimo), así que
  el aislamiento se aplica en la capa de aplicación, no con RLS
- **Validación** con Zod en endpoints de escritura — el alta de cuentas es deliberadamente
  **tolerante**: solo la API key y el id de Zernio son obligatorios, el resto se recorta o
  descarta en vez de rechazar la operación (ver §4, "Páginas de Facebook")
- Las API keys y contraseñas nunca viajan al cliente — la UI solo sabe si existen

---

## 4. Módulos y Capacidades — Qué Puede Hacer

### ✅ Lo que SÍ hace (con precisión)

| Módulo | Ruta | Capacidad |
|---|---|---|
| **Vista Ejecutiva** | `/resumen` | KPIs de la semana, vista rápida del estado de la cuenta |
| **Control de Métricas** | `/control` | 12 KPIs con deltas vs periodo anterior, gráficas de seguidores, dona de reacciones, alcance por formato, top 5 posts, heatmap horarios, distribución de watch time de reels |
| **Videos** | `/videos` | Chat con IA para generar guiones con los "7 Frameworks de Viralidad" **+** galería del contenido publicado con métricas por pieza, incluyendo seguidores ganados por pieza |
| **Reportes** | `/reportes` | Reportes ejecutivos por periodo con comparativa, exportables a Markdown |
| **Banco de Ideas** | `/ideas` | Ideas organizadas por etapa del funnel (TOFU/MOFU/BOFU), CRUD completo |
| **Calendario Editorial** | `/calendario` | Programación de piezas por formato y nivel de funnel, auto-purga 24h |
| **Conexión** | `/conexion` | Gestión multicuenta (IG **y** Facebook), sync manual, probe de API key, alta de varias cuentas con una sola key, eliminar cuentas |
| **Cuenta** | `/cuenta` | Ver método(s) de login activos y definir/cambiar contraseña sin perder la sesión de Google |
| **Login** | `/login` | Google OAuth o usuario/contraseña, alta pública por contraseña |
| **Cron Diario** | `/api/cron/sync` | Sincronización automática de TODAS las cuentas de TODOS los usuarios + purga de calendario (servicio Railway aún por configurar) |
| **Modo Demo** | automático | Datos realistas generados con PRNG determinista (estables entre recargas) |

### Métricas que obtiene (vía Zernio)

| Métrica | Instagram | Facebook (Páginas) |
|---|---|---|
| Alcance por post | ✅ | ✅ |
| Impresiones/Vistas | ✅ | ✅ |
| Likes | ✅ | ✅ |
| Comentarios | ✅ | ✅ |
| Guardados | ✅ | ⚠️ Meta no siempre lo expone para Páginas |
| Compartidos | ✅ | ✅ |
| Watch time promedio de reels | ✅ | ⚠️ Meta no siempre lo expone para Páginas |
| Follows por post | ✅ (parcial) | — |

### Páginas de Facebook: soporte añadido y su fix

- El modelo de Workspace ya soportaba `platform: 'facebook'` desde su diseño original,
  pero el alta de cuentas (`app/api/accounts/route.ts`) validaba los datos que llegan de
  Zernio a rajatabla, asumiendo la forma de una cuenta de Instagram.
- Una Página de Facebook rompía el alta de tres formas a la vez: **sin nombre de
  usuario** (Zernio manda `""`, no `null`, y el código usaba `??` que no cubre la cadena
  vacía), con un **avatar cuya URL firmada por la CDN de Meta** pasa los 600 caracteres
  que se admitían, y con el **contador de seguidores llegando como texto**. Cualquiera de
  los tres tumbaba el alta con un "Datos inválidos" que no decía cuál.
- Arreglado en dos capas: `lib/zernio.ts` construye el nombre visible de forma
  "blank-safe" (para Facebook prioriza el nombre de la Página sobre un username que
  puede no existir), y `app/api/accounts/route.ts` ahora solo exige la API key y el id de
  Zernio — el resto se recorta o descarta en vez de rechazar el alta. Si algo vuelve a
  fallar, el error ahora nombra el campo (`Datos inválidos: avatarUrl.`).
- Commits: `296dc60` (soporte inicial), `6e59c0e` (varias cuentas con una key), `8fb0aba`
  (fix del alta de Páginas).

### ❌ Lo que NO puede hacer / Limitaciones conocidas

| Limitación | Por qué |
|---|---|
| **Sin curva de retención segundo a segundo** | Zernio no la entrega — la UI degrada con elegancia (muestra distribución por buckets) |
| **Sin métricas de Historias** | Zernio no expone historias en el plan actual |
| **Sin histórico de seguidores nativo** | Se construye acumulativamente snapshot por snapshot al sincronizar cada día |
| **Sin taps al link / CTR de bio** | Zernio no entrega estos datos — los KPIs se muestran con "No disponible en esta fuente" |
| **Guardados y watch time en Páginas de Facebook** | Meta no siempre expone estos campos para Páginas — pueden salir en cero sin que sea un error |
| **Sin scheduling real de publicaciones** | El calendario es solo planificación — no publica automáticamente |
| **Sin roles / permisos dentro de un mismo Workspace** | Multiusuario real (Google o contraseña), pero no hay colaboradores compartiendo un mismo workspace |
| **Sin recuperación de contraseña por correo** | No hay proveedor de email configurado — documentado en `/cuenta` y `DEPLOY.md` |
| **Sin comentarios / DMs** | No hay gestión de inbox ni respuestas |
| **Sin análisis de competidores** | Solo analiza las propias cuentas |
| **Sin notificaciones / alertas** | No avisa de caídas de métricas, cambios bruscos, etc. |
| **Sin A/B testing** | No hay comparación de variaciones de contenido |
| **Sin histórico de cambios** | No hay versionado de guiones ni auditoría de acciones |

---

## 5. Mapa de Archivos Clave

```
ContentOS/
├── middleware.ts                     # Auth.js en Edge — protege toda la app
├── auth.config.ts                    # Config Edge-safe (lee la cookie JWT)
├── auth.ts                           # Providers reales (Google + Credentials, Node/pg)
├── app/
│   ├── layout.tsx                    # Root layout (Inter, dark mode, AppShell)
│   ├── page.tsx                      # Redirect a /resumen
│   ├── resumen/page.tsx              # Vista ejecutiva (~356 LOC)
│   ├── control/page.tsx              # Panel de métricas (~202 LOC)
│   ├── videos/page.tsx               # Generador de guiones IA + galería (~432 LOC)
│   ├── reportes/page.tsx             # Reportes ejecutivos (~293 LOC)
│   ├── ideas/page.tsx                # Banco de ideas TOFU/MOFU/BOFU (~267 LOC)
│   ├── calendario/page.tsx           # Calendario editorial (~552 LOC)
│   ├── conexion/page.tsx             # Gestión multicuenta IG+FB (~798 LOC) ← MAYOR
│   ├── cuenta/page.tsx               # Definir/cambiar contraseña (~168 LOC)
│   ├── login/page.tsx                # Login Google + usuario/contraseña
│   └── api/                          # 18 API routes
│       ├── metrics/route.ts          # GET métricas por periodo
│       ├── connection/route.ts       # GET/POST/DELETE/PATCH conexión (legacy)
│       ├── accounts/                 # CRUD multicuenta (IG + FB), probe, activar
│       ├── calendar/                 # CRUD calendario
│       ├── ideas/                    # CRUD ideas
│       ├── posts/route.ts            # Datos de la galería de contenido
│       ├── scripts/route.ts          # Guiones generados
│       ├── reports/route.ts          # Generación de reportes
│       ├── cron/sync/route.ts        # Cron diario
│       ├── health/route.ts           # Healthcheck (público)
│       └── auth/
│           ├── [...nextauth]/         # Endpoints de Auth.js (Google + Credentials)
│           ├── password/route.ts      # Definir/cambiar contraseña con sesión abierta
│           └── register/route.ts      # Alta pública por contraseña
├── lib/
│   ├── db.ts                         # Abstracción dual JSON/Postgres
│   ├── accounts.ts                   # Sistema multicuenta + workspaces (IG + FB)
│   ├── zernio.ts                     # Cliente API Zernio (Instagram + Facebook)
│   ├── metrics.ts                    # Cómputo de 12 KPIs + derivados
│   ├── reports.ts                    # Generación de reportes (IA o plantilla)
│   ├── claude.ts                     # Cliente Anthropic API
│   ├── crypto.ts                     # AES-256-GCM (WebCrypto)
│   ├── mock.ts                       # Datos demo deterministas (PRNG)
│   ├── maintenance.ts                # Purga de calendario
│   ├── pg.ts                         # Pool de Postgres + esquema auto
│   ├── auth.ts                       # Providers Auth.js (Node) + getSessionUser()
│   ├── auth-flags.ts                 # isAuthEnabled() — auto-desactivación sin AUTH_SECRET
│   ├── users.ts                      # Registro de usuarios, Google + contraseña unificados
│   ├── password.ts                   # Hash scrypt de contraseñas
│   ├── session.ts                    # Helpers de sesión
│   └── utils.ts                      # Formateo de números
├── components/
│   ├── ui.tsx                        # Design system (Card, Button, Modal, etc.)
│   ├── providers.tsx                 # QueryClientProvider
│   ├── layout/
│   │   ├── AppShell.tsx              # Layout principal (sidebar + main, hamburguesa en móvil)
│   │   ├── Sidebar.tsx               # Navegación lateral
│   │   └── AccountSwitcher.tsx       # Selector multicuenta
│   └── control/
│       ├── charts.tsx                # Componentes Recharts
│       └── widgets.tsx               # Widgets del panel de control
├── types/index.ts                    # Tipos del dominio
├── supabase/migrations/
│   ├── 001_schema.sql                # Esquema relacional (referencia, NO usado)
│   └── 002_app_store.sql             # Key-value store — esquema de referencia (ahora en Postgres propio de Railway, no Supabase)
└── scripts/
    ├── railway-cron.mjs              # Script cron para Railway
    └── probe-zernio.mjs              # Diagnóstico de API Zernio
```

---

## 6. Fortalezas

### 🟢 Arquitectura

| Fortaleza | Detalle |
|---|---|
| **Modo dual sin migración** | La app cambia automáticamente entre JSON local y Postgres según `DATABASE_URL`. Cero fricción para desarrollo. |
| **Degradación elegante** | Sin IA → plantillas con datos reales. Sin Zernio → demo. Sin Postgres → JSON. Sin `AUTH_SECRET` → app abierta. Cada capa es opcional. |
| **Multicuenta con aislamiento** | Los datos de cada workspace están completamente separados por namespace y por dueño. Borrar una cuenta borra todo lo suyo sin afectar otras ni a otros usuarios. |
| **Cuenta legacy sin migración** | La primera cuenta conserva las claves originales — no hay riesgo de pérdida de datos al activar multicuenta. |
| **Un mismo modelo para IG y Facebook** | El workspace no distingue plataforma más allá de un campo — añadir Facebook no requirió un sistema paralelo. |

### 🟢 Seguridad

| Fortaleza | Detalle |
|---|---|
| **Cifrado real en reposo** | AES-256-GCM vía WebCrypto para las API keys de Zernio. No es ofuscación. |
| **Contraseñas con scrypt** | Hash con salt, nunca en texto plano. |
| **Keys y contraseñas nunca en el cliente** | La UI solo sabe si existen, nunca su valor. |
| **Split Edge/Node del auth** | `middleware.ts` nunca carga `pg` — el aislamiento del runtime está verificado por el tamaño del bundle del Middleware. |
| **Login abierto pero aislado** | Sin allowlist, pero cada usuario solo ve sus propios workspaces — verificado en cada ruta de `accounts`. |
| **Cron protegido** | Bearer token (`CRON_SECRET`) obligatorio para el endpoint de sync. |

### 🟢 Código

| Fortaleza | Detalle |
|---|---|
| **Codebase compacto** | ~8,000 LOC para un SaaS multiusuario completo. Fácil de auditar y mantener. |
| **Tipado estricto** | TypeScript end-to-end con tipos del dominio centralizados en `types/index.ts`. |
| **Sin magia** | No hay ORMs, no hay code generation, no hay dependencias pesadas. |
| **Demo determinista** | PRNG con semilla fija para datos estables entre recargas. |
| **Comentarios extensos** | El código documenta bien los edge cases y las decisiones de diseño — incluida la razón de cada validación tolerante. |
| **Validación defensiva ante datos externos** | El alta de cuentas (Zernio) asume que los datos externos pueden venir incompletos o con formas inesperadas, y degrada en vez de romperse. |

### 🟢 UX / Producto

| Fortaleza | Detalle |
|---|---|
| **Reportes inteligentes** | Detecta periodos sin datos y dice "no hay datos" en vez de generar un reporte vacío con análisis falso. |
| **Mensajes de error accionables** | Los errores nombran el campo o la causa concreta (Zernio, validación de alta) en vez de mensajes genéricos. |
| **Alta de varias cuentas sin fricción** | Una sola API key de Zernio puede dar de alta varias cuentas (IG y FB) sin volver a pegarla. |

---

## 7. Debilidades y Riesgos

### 🔴 Crítico

| Debilidad | Impacto | Detalle |
|---|---|---|
| **Base de datos como key-value (no relacional)** | Escalabilidad y consultas | La tabla `app_store` guarda TODO como jsonb. No hay índices, no hay joins, no hay queries complejas. Cada lectura trae la colección ENTERA a memoria. Con miles de posts o muchos usuarios esto se vuelve lento. |
| **Sin tests** | Calidad | No hay ni un solo test unitario, de integración ni E2E — ni en la lógica de negocio ni en el aislamiento por usuario (`listAccountsForUser`, `getAccountForUser`, `owns`) ni en auth. Cualquier refactor es arriesgado. |
| **Sin rate limiting** | Seguridad | Los API routes no tienen límite de peticiones. Un actor malicioso podría agotar la API de Anthropic (con costo real en $) haciendo POST repetidos al generador. |
| **Sin backups automáticos** | Resiliencia | No hay estrategia de respaldos del Postgres de Railway. Si la tabla `app_store` se corrompe, se pierden los datos de TODOS los usuarios. |

### 🟡 Importante

| Debilidad | Impacto | Detalle |
|---|---|---|
| **Esquema relacional abandonado** | Deuda técnica | `001_schema.sql` define un esquema relacional completo (tablas normalizadas con FK, constraints), pero la app NO lo usa. Usa `002_app_store.sql` (una sola tabla key-value). |
| **Páginas monolíticas** | Mantenimiento | `conexion/page.tsx` tiene **~798 LOC** en un solo archivo (creció al añadir soporte de Facebook). `calendario/page.tsx` tiene **~552 LOC**. Deberían descomponerse. |
| **`uid()` no es criptográficamente seguro** | Integridad | `Date.now().toString(36) + Math.random()` puede colisionar en alta concurrencia. Debería usar `crypto.randomUUID()`. |
| **Sin caché de API Zernio** | Performance | Cada sync trae TODOS los posts de 90 días, de cada cuenta de cada usuario. No hay deduplicación ni sync incremental. |
| **`engaged_accounts` es estimado** | Precisión de datos | Se calcula como `Math.round(interactions * 0.8)` — es una estimación arbitraria, no un dato real de Instagram/Facebook. |
| **Sin logging estructurado** | Observabilidad | No hay sistema de logs. Los errores del cron se devuelven en JSON pero no se persisten. |
| **Sin monitoreo** | Operaciones | No hay alertas si el cron falla, si Zernio devuelve errores, si la BD se llena. |
| **Cron aún sin desplegar** | Sincronización | El endpoint `/api/cron/sync` existe y está protegido, pero el servicio Railway que debe llamarlo diariamente todavía no está configurado. |
| **Sin recuperación de contraseña por correo** | UX | Quien olvida su contraseña y no tiene Google vinculado no puede recuperarla — falta un proveedor de email. |

### 🟠 Menor

| Debilidad | Impacto | Detalle |
|---|---|---|
| **Zustand declarado pero sin uso visible** | Dependencia innecesaria | Está en `package.json` pero no se encontró un store implementado. |
| **Sin internacionalización** | Alcance | Todo hardcodeado en español. Sería difícil traducir. |
| **Sin PWA** | UX móvil | No hay service worker ni manifest — no se puede "instalar" como app. |
| **Sin CI/CD definido** | Proceso | No hay pipeline de GitHub Actions ni similar. |
| **Railway Config-as-Code deprecado** | Mantenimiento | `railway.json` funciona hasta dic. 2026; falta migrar a `.railway/railway.ts` (`railway config migrate`). |
| **Restos de Cloudflare Workers** | Limpieza | `open-next.config.ts`, `wrangler` y dependencias asociadas ya no se usan en producción. |

---

## 8. Análisis de Dependencias

### Dependencias de Producción

| Paquete | Riesgo | Nota |
|---|---|---|
| `next` 15.5 | 🟢 Bajo | Framework maduro, activamente mantenido |
| `react` / `react-dom` 19.0.0 | 🟢 Bajo | Estable |
| `next-auth` (Auth.js v5, beta) | 🟡 Medio | Versión beta — API puede cambiar antes del release estable |
| `pg` | 🟢 Bajo | Cliente oficial de Postgres |
| `@tanstack/react-query` | 🟢 Bajo | Estándar de la industria |
| `recharts` | 🟡 Medio | Funcional pero puede tener limitaciones con datasets grandes |
| `zod` | 🟢 Bajo | Validación robusta |
| `zustand` | 🟡 Medio | No se encontró uso activo — posible dependencia huérfana |
| `lucide-react` | 🟢 Bajo | Iconos tree-shakeable |
| `date-fns` | 🟢 Bajo | Funciones de fecha tree-shakeable |
| `clsx` + `tailwind-merge` | 🟢 Bajo | Utilidades mínimas |

> Nota: `@supabase/ssr` y `@supabase/supabase-js` ya **no** están en `package.json` — el proyecto migró a Postgres propio en Railway con el cliente `pg` directo.

### Dependencias de Desarrollo

| Paquete | Nota |
|---|---|
| `@opennextjs/cloudflare`, `wrangler` | Adaptador/CLI de Cloudflare — sin uso en producción, candidatos a limpieza |
| `typescript`, `@types/*` | Tipado |
| `tailwindcss`, `postcss`, `autoprefixer` | Build de CSS |

---

## 9. Flujo de Datos

```
═══════════════════════════════════════════════════════════
                        LOGIN
═══════════════════════════════════════════════════════════

  Browser ──/login──▶ Auth.js v5
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
         Google OAuth            Usuario/contraseña
         (abierto, sin            (scrypt, lib/users.ts)
          allowlist)
              │                       │
              └───────────┬───────────┘
                           ▼
                  Misma fila de usuario
                  (correo en minúsculas
                   como clave de identidad)
                           ▼
                     Sesión JWT
                     ──▶ Browser

═══════════════════════════════════════════════════════════
               SINCRONIZACIÓN DIARIA (CRON)
═══════════════════════════════════════════════════════════

  Cron ──GET /api/cron/sync──▶ API Routes
                                  │
                        ┌─────────┴─────────┐
                        │ Por cada workspace │
                        │ de cada usuario    │
                        ▼                    ▼
                   Zernio API          Calendario
                   (IG o FB, 90 días)  (purga 24h)
                        │                    │
                        ▼                    ▼
                  Posts + Métricas    Items expirados
                        │            eliminados
                        ▼
                  Postgres (Railway)
                   (guardar)

═══════════════════════════════════════════════════════════
                ALTA DE UNA CUENTA (Zernio)
═══════════════════════════════════════════════════════════

  Browser ──POST /api/accounts/probe──▶ Lista de cuentas
                                          (IG + Páginas FB)
              │
              ▼
  Usuario elige una ──POST /api/accounts──▶ Validación tolerante
                                              (solo apiKey + id
                                               son obligatorios)
              │
              ▼
        Workspace creado + primer sync
              │
              ▼
        JSON response ──▶ Browser

═══════════════════════════════════════════════════════════
                   USUARIO NAVEGA
═══════════════════════════════════════════════════════════

  Browser ──GET /api/metrics──▶ API Routes
                                   │
                                   ▼
                         Verificar dueño del workspace
                                   │
                                   ▼
                              Leer snapshots
                              + posts de BD
                                   │
                                   ▼
                              Computar KPIs,
                              charts, top posts
                                   │
                                   ▼
                              JSON response
                              ──▶ Browser
```

---

## 10. Recomendaciones Prioritarias

### 🔴 Prioridad Alta

1. **Agregar tests** — sobre todo en el aislamiento multiusuario (`listAccountsForUser`, `getAccountForUser`, `owns`, `deleteAccount`) y en auth (`lib/users.ts`, `lib/auth.ts`); luego `metrics.ts`, `reports.ts`, `zernio.ts`.

2. **Configurar el servicio de cron en Railway** — el endpoint ya existe y está protegido; falta el servicio que lo llame diariamente.

3. **Implementar rate limiting** — mínimo en `/api/scripts` y `/api/reports` para evitar abuso de la API de Anthropic ($).

4. **Backups automáticos** del Postgres de Railway — ahora afecta a todos los usuarios, no solo a uno.

### 🟡 Prioridad Media

5. **Migrar a esquema relacional** — el esquema ya existe en `001_schema.sql`.

6. **Descomponer páginas grandes** — `conexion/page.tsx` (~798 LOC) y `calendario/page.tsx` (~552 LOC).

7. **Sync incremental** — comparar con los datos existentes en vez de traer 90 días completos cada vez, multiplicado ahora por cada usuario.

8. **Logging estructurado y monitoreo** — especialmente del cron y de los llamados a Zernio, que ahora corren para múltiples usuarios.

9. **Recuperación de contraseña por correo** — requiere elegir un proveedor de email.

10. **CI/CD** — GitHub Actions para lint + build en cada push.

### 🟠 Prioridad Baja

11. **Limpiar restos de Cloudflare** (`open-next.config.ts`, `wrangler`) y **Zustand** si sigue sin usarse.

12. **Reemplazar `uid()`** por `crypto.randomUUID()`.

13. **Migrar `railway.json`** a `.railway/railway.ts` antes de dic. 2026.

---

## 11. Conclusión Ejecutiva

ContentOS pasó de ser un dashboard personal a un **SaaS multiusuario en producción sobre Railway**: login con Google (abierto) o usuario/contraseña, Postgres propio, aislamiento de datos por usuario, y soporte de Instagram **y** Facebook a través de Zernio con un mismo modelo de workspace. La migración fuera de Supabase y Cloudflare Workers se completó sin romper compatibilidad con las cuentas ya existentes ("legacy").

Su mayor fortaleza sigue siendo la **simplicidad pragmática** — un codebase compacto (~8K LOC), dependencias mínimas, y una degradación elegante que permite correr sin ninguna configuración externa. La incorporación de Facebook confirmó ese diseño: no hizo falta un sistema paralelo, solo hacer la validación del alta tolerante a datos que Zernio manda incompletos para Páginas.

Las **debilidades principales** siguen siendo de **madurez**, y ahora pesan más porque hay múltiples usuarios reales: falta de tests (sobre todo en el aislamiento multiusuario), logging, monitoreo, backups y un esquema de datos que escale.

> ⚠️ **Riesgo más alto:** la **ausencia total de tests** combinada con **datos de producción de varios usuarios reales** en una sola tabla key-value — un cambio mal calculado en `accounts.ts`, `users.ts` o `db.ts` podría corromper o mezclar datos entre cuentas sin que nadie lo detecte, y ahora el radio de impacto no es una sola persona.

El sistema está en buen punto para **estabilizar antes de sumar usuarios**: documentación sólida, arquitectura clara, decisiones bien justificadas en comentarios. Antes de seguir con features nuevos, la recomendación es invertir en tests del aislamiento multiusuario, backups y observabilidad del cron.
