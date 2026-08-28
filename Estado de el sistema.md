# 🔍 Auditoría Técnica Completa — ContentOS

**Proyecto:** Content OS · Command Center  
**Fecha:** 28 de agosto de 2026  
**Alcance:** Arquitectura, stack, capacidades, fortalezas, debilidades  

---

## 1. Visión General del Sistema

ContentOS es un **dashboard personal de Instagram** diseñado para creadores de contenido. Funciona como un "Command Center" que centraliza métricas de Instagram, generación de guiones con IA, reportes, banco de ideas, banco de fuentes y calendario editorial.

El sistema es **multiusuario**: cualquiera entra con su cuenta de Google y ve únicamente las cuentas de Instagram que conectó. Es el esqueleto de un SaaS; falta lo de arriba (roles, planes, facturación).

| Dato | Valor |
|---|---|
| **Líneas de código** | ~6,990 (TypeScript/TSX) |
| **Archivos fuente** | ~40 archivos `.ts` / `.tsx` |
| **Páginas** | 8 vistas principales + login |
| **API Routes** | 15 endpoints REST |
| **Módulos de negocio** | 11 archivos en `lib/` |

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

### Backend

| Tecnología | Rol |
|---|---|
| **Next.js API Routes** | Endpoints REST (server-side) |
| **Zod** | Validación de payloads |
| **WebCrypto (AES-256-GCM)** | Cifrado de API keys en reposo |
| **Anthropic API (Claude Sonnet 5)** | Generación de guiones y reportes con IA |

### Datos

| Componente | Modo | Rol |
|---|---|---|
| **Archivos JSON** (`data/`) | Desarrollo / Demo | Almacén local sin dependencias |
| **Postgres** (Railway) | Producción | BD (misma red privada que la app) |
| **Tabla `app_store`** | Producción | Key-value store (`text` → `jsonb`) |

### Fuente de Datos de Instagram

| Servicio | Rol |
|---|---|
| **[Zernio](https://zernio.com)** | Proxy a Instagram ("Instagram Login for Business"). Evita necesitar app de Meta, cuenta de Facebook o Página. Cada usuario trae su propia API key |

### Hosting / Deploy

| Opción | Estado | Detalles |
|---|---|---|
| **Railway** (recomendado) | Configurado | `railway.json` con Nixpacks, healthcheck, cron como servicio aparte |
| **Cloudflare Workers** | Retirado | Ya no soportado: `pg` no corre en Workers. Quedan archivos sin uso |
| **Local** (desarrollo) | Funcional | `npm run dev` en puerto 3333, modo demo sin keys |

### Cron / Tareas Programadas

| Plataforma | Mecanismo |
|---|---|
| Railway | Servicio separado con `railway.cron.json` ejecutando `scripts/railway-cron.mjs` |
| Cloudflare | Cron Trigger (0 13 * * * UTC = 7 AM CDMX) |
| Genérico | `GET /api/cron/sync` con Bearer token |

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
│  │ Middleware          │ ← Auth (Google, abierto)│
│  │ (Auth.js v5)        │                        │
│  └────────┬───────────┘                         │
│           ▼                                     │
│  ┌────────────────────┐                         │
│  │ API Routes          │ ← 15 endpoints REST    │
│  │ (server-side)       │                        │
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
│ Zernio  │ │Anthropic│ │Postgres / JSON│
│ (IG)    │ │(Claude) │ │(datos)        │
└─────────┘ └─────────┘ └──────────────┘

      ▲
      │ GET /api/cron/sync (Bearer)
┌─────┴──────────┐
│ CRON (7 AM)    │
│ Railway / CF   │
└────────────────┘
```

### Patrón de Almacenamiento: Key-Value Dual

La pieza más original de la arquitectura es `lib/db.ts`:

```
db.ts → ¿DATABASE_URL definida?
  ├─ SÍ → Postgres, tabla app_store (key text PK, value jsonb)
  └─ NO → data/{nombre}.json
```

Las mismas funciones (`readCollection`, `writeCollection`, `readSingleton`, `writeSingleton`) abstraen los dos backends. **Esto permite correr la app completa sin ninguna dependencia externa.**

### Sistema Multicuenta

`lib/accounts.ts` implementa un sistema de **workspaces**:

- Cada cuenta de Instagram es un **Workspace** con datos completamente separados
- Cada Workspace tiene un **dueño** (`owner_user_id`, el id de Google del usuario) — un usuario
  solo ve, cambia y sincroniza los suyos (`listAccountsForUser`, `getAccountForUser`)
- La cuenta activa se persiste en una cookie `httpOnly` (`co_account`), resuelta
  siempre dentro de las cuentas del usuario logueado
- Las colecciones se separan por **namespace**: `ideas__acc_123`, `calendar_items__acc_123`
- La primera cuenta ("legacy") conserva claves sin sufijo para evitar migraciones
- Las API keys de Zernio se guardan **cifradas** con AES-256-GCM (`lib/crypto.ts`)

### Seguridad

- **Login**: Google OAuth vía Auth.js v5 con sesiones JWT, abierto a cualquier
  cuenta (sin allowlist) — es multiusuario real, no de un solo dueño
- **Middleware** (`middleware.ts`): exige sesión para toda la app salvo las
  rutas públicas (`/login`, `/api/auth`, `/api/health`, `/api/cron`)
- **Aislamiento de datos**: cada Workspace tiene dueño (`owner_user_id`); las
  rutas de cuentas verifican propiedad antes de leer/editar/borrar/activar
  (`getAccountForUser`) — cerrando el IDOR que existía antes de abrir el login
- **Cifrado**: AES-256-GCM via WebCrypto
- **Base de datos**: solo el servidor la toca (no hay cliente anónimo), así que
  el aislamiento se aplica en la capa de aplicación, no con RLS
- **Validación** con Zod en endpoints de escritura
- Las API keys nunca viajan al cliente — la UI solo sabe si existen

---

## 4. Módulos y Capacidades — Qué Puede Hacer

### ✅ Lo que SÍ hace (con precisión)

| Módulo | Ruta | Capacidad |
|---|---|---|
| **Vista Ejecutiva** | `/resumen` | KPIs de la semana, vista rápida del estado de la cuenta |
| **Control de Métricas** | `/control` | 12 KPIs con deltas vs periodo anterior, gráficas de seguidores, dona de reacciones, alcance por formato, top 5 posts, heatmap horarios, distribución de watch time de reels |
| **Videos / Generador** | `/videos` | Chat con IA para generar guiones estructurados con los "7 Frameworks de Viralidad" |
| **Reportes** | `/reportes` | Reportes ejecutivos por periodo con comparativa, exportables a Markdown |
| **Banco de Ideas** | `/ideas` | Ideas organizadas por etapa del funnel (TOFU/MOFU/BOFU), CRUD completo |
| **Calendario Editorial** | `/calendario` | Programación de piezas por formato y nivel de funnel, auto-purga 24h |
| **Conexión IG** | `/conexion` | Gestión multicuenta, sync manual, probe de API key, añadir/eliminar cuentas |
| **Cron Diario** | `/api/cron/sync` | Sincronización automática de TODAS las cuentas + purga de calendario |
| **Modo Demo** | automático | Datos realistas generados con PRNG determinista (estables entre recargas) |
| **Auth** | `/login` | Login con Google vía Auth.js v5, abierto a cualquier cuenta (multiusuario) |

### Métricas que obtiene de Instagram (vía Zernio)

| Métrica | Disponible |
|---|---|
| Alcance por post | ✅ |
| Impresiones/Vistas | ✅ |
| Likes | ✅ |
| Comentarios | ✅ |
| Guardados | ✅ |
| Compartidos | ✅ |
| Watch time promedio de reels | ✅ |
| Follows por post | ✅ (parcial) |

### ❌ Lo que NO puede hacer / Limitaciones conocidas

| Limitación | Por qué |
|---|---|
| **Sin curva de retención segundo a segundo** | Zernio no la entrega — la UI degrada con elegancia (muestra distribución por buckets) |
| **Sin métricas de Historias** | Zernio no expone historias en el plan actual |
| **Sin histórico de seguidores nativo** | Se construye acumulativamente snapshot por snapshot al sincronizar cada día |
| **Sin taps al link / CTR de bio** | Zernio no entrega estos datos — los KPIs se muestran con "No disponible en esta fuente" |
| **Sin scheduling real de publicaciones** | El calendario es solo planificación — no publica automáticamente en Instagram |
| **Sin extracción de PDF/Word en Workers** | `pdf-parse` y `mammoth` son de Node; en Cloudflare Workers pueden fallar |
| **Sin roles / permisos dentro de un mismo Workspace** | Login abierto y multiusuario (Google), pero no hay colaboradores compartiendo una misma cuenta de Instagram ni roles de equipo |
| **Sin comentarios / DMs** | No hay gestión de inbox ni respuestas |
| **Sin análisis de competidores** | Solo analiza las propias cuentas |
| **Sin notificaciones / alertas** | No avisa de caídas de métricas, cambios bruscos, etc. |
| **Sin A/B testing** | No hay comparación de variaciones de contenido |
| **Sin histórico de cambios** | No hay versionado de guiones ni auditoría de acciones |

---

## 5. Mapa de Archivos Clave

```
ContentOS/
├── app/
│   ├── layout.tsx                    # Root layout (Inter, dark mode, AppShell)
│   ├── page.tsx                      # Redirect a /resumen
│   ├── resumen/page.tsx              # Vista ejecutiva (354 LOC)
│   ├── control/page.tsx              # Panel de métricas (202 LOC)
│   ├── videos/page.tsx               # Generador de guiones IA (432 LOC)
│   ├── reportes/page.tsx             # Reportes ejecutivos (293 LOC)
│   ├── ideas/page.tsx                # Banco de ideas TOFU/MOFU/BOFU (267 LOC)
│   ├── calendario/page.tsx           # Calendario editorial (552 LOC)
│   ├── conexion/page.tsx             # Gestión multicuenta (704 LOC) ← MAYOR
│   ├── login/page.tsx                # Login con Google (Auth.js)
│   └── api/                          # 15 API routes
│       ├── metrics/route.ts          # GET métricas por periodo
│       ├── connection/route.ts       # GET/POST/DELETE/PATCH conexión
│       ├── accounts/                 # CRUD multicuenta
│       ├── calendar/                 # CRUD calendario
│       ├── ideas/                    # CRUD ideas
│       ├── scripts/route.ts          # Guiones generados
│       ├── reports/route.ts          # Generación de reportes
│       ├── cron/sync/route.ts        # Cron diario
│       ├── health/route.ts           # Healthcheck
│       └── auth/[...nextauth]/       # Endpoints de Auth.js
├── lib/
│   ├── db.ts                         # Abstracción dual JSON/Postgres
│   ├── accounts.ts                   # Sistema multicuenta + workspaces
│   ├── zernio.ts                     # Cliente API Zernio (Instagram)
│   ├── metrics.ts                    # Cómputo de 12 KPIs + derivados
│   ├── reports.ts                    # Generación de reportes (IA o plantilla)
│   ├── claude.ts                     # Cliente Anthropic API
│   ├── crypto.ts                     # AES-256-GCM (WebCrypto)
│   ├── mock.ts                       # Datos demo deterministas (PRNG)
│   ├── maintenance.ts                # Purga de calendario
│   ├── pg.ts                         # Pool de Postgres + esquema auto
│   ├── auth.ts                       # getSessionUser() (corte multiusuario)
│   └── utils.ts                      # Formateo de números
├── components/
│   ├── ui.tsx                        # Design system (Card, Button, Modal, etc.)
│   ├── providers.tsx                 # QueryClientProvider
│   ├── layout/
│   │   ├── AppShell.tsx              # Layout principal (sidebar + main)
│   │   ├── Sidebar.tsx               # Navegación lateral
│   │   └── AccountSwitcher.tsx       # Selector multicuenta
│   └── control/
│       ├── charts.tsx                # Componentes Recharts
│       └── widgets.tsx               # Widgets del panel de control
├── types/index.ts                    # Tipos del dominio (183 LOC)
├── supabase/migrations/
│   ├── 001_schema.sql                # Esquema relacional (referencia, NO usado)
│   └── 002_app_store.sql             # Key-value store (producción real)
└── scripts/
    ├── railway-cron.mjs              # Script cron para Railway
    └── probe-zernio.mjs              # Diagnóstico de API Zernio
```

---

## 6. Fortalezas

### 🟢 Arquitectura

| Fortaleza | Detalle |
|---|---|
| **Modo dual sin migración** | La app cambia automáticamente entre JSON local y Supabase según las variables de entorno. Cero fricción para desarrollo. |
| **Degradación elegante** | Sin IA → plantillas con datos reales. Sin Zernio → demo. Sin Supabase → JSON. Sin auth → abierto. Cada capa es opcional. |
| **Multicuenta con aislamiento** | Los datos de cada cuenta están completamente separados por namespace. Borrar una cuenta borra todo lo suyo sin afectar otras. |
| **Cuenta legacy sin migración** | La primera cuenta conserva las claves originales — no hay riesgo de pérdida de datos al activar multicuenta. |

### 🟢 Seguridad

| Fortaleza | Detalle |
|---|---|
| **Cifrado real en reposo** | AES-256-GCM via WebCrypto para las API keys. No es ofuscación. |
| **Keys nunca en el cliente** | La UI solo sabe si una key existe, nunca su valor. |
| **Cross-runtime** | WebCrypto funciona igual en Node y Cloudflare Workers. |
| **RLS + allowlist** | Supabase con RLS activo; el middleware permite solo 1 email. |
| **Cron protegido** | Bearer token obligatorio para el endpoint de sync. |

### 🟢 Código

| Fortaleza | Detalle |
|---|---|
| **Codebase compacto** | ~7,000 LOC para un sistema completo. Fácil de auditar y mantener. |
| **Tipado estricto** | TypeScript end-to-end con tipos del dominio centralizados en `types/index.ts`. |
| **Sin magia** | No hay ORMs, no hay code generation, no hay dependencias pesadas. La lógica es directa y legible. |
| **Demo determinista** | PRNG con semilla fija para datos estables entre recargas. |
| **Comentarios extensos** | El código está bien documentado, especialmente los edge cases y decisiones de diseño. |
| **Dependencias mínimas** | Solo 12 dependencias de producción para un sistema completo. Árbol muy limpio. |

### 🟢 UX / Producto

| Fortaleza | Detalle |
|---|---|
| **Reportes inteligentes** | Detecta periodos sin datos y dice "no hay datos" en vez de generar un reporte vacío con análisis falso. |
| **Mensajes de error accionables** | Los errores de Zernio explican qué hacer (ej: "pasarse al plan nuevo"). |
| **Deploy multi-plataforma** | Railway y Cloudflare Workers, ambos documentados paso a paso en `DEPLOY.md`. |

---

## 7. Debilidades y Riesgos

### 🔴 Crítico

| Debilidad | Impacto | Detalle |
|---|---|---|
| **Base de datos como key-value (no relacional)** | Escalabilidad y consultas | La tabla `app_store` guarda TODO como jsonb. No hay índices, no hay joins, no hay queries complejas. Cada lectura trae la colección ENTERA a memoria. Con miles de posts esto se vuelve lento. |
| **Sin tests** | Calidad | No hay ni un solo test unitario, de integración ni E2E. Cualquier refactor es arriesgado. |
| **Sin rate limiting** | Seguridad | Los API routes no tienen límite de peticiones. Un actor malicioso podría agotar la API de Anthropic (con costo real en $) haciendo POST repetidos al generador. |
| **Sin backups automáticos** | Resiliencia | No hay estrategia de respaldos. Si la tabla `app_store` se corrompe, se pierden todos los datos. |

### 🟡 Importante

| Debilidad | Impacto | Detalle |
|---|---|---|
| **Esquema relacional abandonado** | Deuda técnica | `001_schema.sql` define un esquema relacional completo (7 tablas normalizadas con FK, constraints, RLS por tabla), pero la app NO lo usa. Usa `002_app_store.sql` (una sola tabla key-value). Es deuda técnica: el esquema "correcto" existe pero no se implementó. |
| **Páginas monolíticas** | Mantenimiento | `conexion/page.tsx` tiene **704 LOC** en un solo archivo. `calendario/page.tsx` tiene **552 LOC**. Deberían descomponerse en componentes más pequeños. |
| **`uid()` no es criptográficamente seguro** | Integridad | `Date.now().toString(36) + Math.random()` puede colisionar en alta concurrencia. Debería usar `crypto.randomUUID()`. |
| **Sin caché de API Zernio** | Performance | Cada sync trae TODOS los posts de 90 días. No hay deduplicación ni sync incremental. |
| **`engaged_accounts` es estimado** | Precisión de datos | Se calcula como `Math.round(interactions * 0.8)` — es una estimación arbitraria, no un dato real de Instagram. |
| **Sin logging estructurado** | Observabilidad | No hay sistema de logs. Los errores del cron se devuelven en JSON pero no se persisten. |
| **Sin monitoreo** | Operaciones | No hay alertas si el cron falla, si Zernio devuelve errores, si la BD se llena. |

### 🟠 Menor

| Debilidad | Impacto | Detalle |
|---|---|---|
| **Zustand declarado pero sin uso visible** | Dependencia innecesaria | Está en `package.json` pero no se encontró un store implementado. |
| **Sin internacionalización** | Alcance | Todo hardcodeado en español. Sería difícil traducir. |
| **Sin PWA** | UX móvil | No hay service worker ni manifest — no se puede "instalar" como app. |
| **Node ≥ 20 requerido** | Compatibilidad | El Mac actual tiene Node 18 (documentado en DEPLOY.md). |
| **Sin CI/CD definido** | Proceso | No hay pipeline de GitHub Actions ni similar. |

---

## 8. Análisis de Dependencias

### Dependencias de Producción (12)

| Paquete | Riesgo | Nota |
|---|---|---|
| `next` 15.5 | 🟢 Bajo | Framework maduro, activamente mantenido |
| `react` 19.0.0 | 🟢 Bajo | Estable |
| `@supabase/ssr` + `supabase-js` | 🟢 Bajo | Oficiales, bien soportados |
| `@tanstack/react-query` | 🟢 Bajo | Estándar de la industria |
| `recharts` | 🟡 Medio | Funcional pero puede tener limitaciones con datasets grandes |
| `zod` | 🟢 Bajo | Validación robusta |
| `zustand` | 🟡 Medio | No se encontró uso activo — posible dependencia huérfana |
| `lucide-react` | 🟢 Bajo | Iconos tree-shakeable |
| `date-fns` | 🟢 Bajo | Funciones de fecha tree-shakeable |
| `clsx` + `tailwind-merge` | 🟢 Bajo | Utilidades mínimas |

### Dependencias de Desarrollo (8)

| Paquete | Nota |
|---|---|
| `@opennextjs/cloudflare` | Adaptador para Cloudflare Workers |
| `wrangler` | CLI de Cloudflare |
| `typescript`, `@types/*` | Tipado |
| `tailwindcss`, `postcss`, `autoprefixer` | Build de CSS |

> **💡 Nota:** El árbol de dependencias es **notablemente limpio**. 12 dependencias de producción para un sistema completo es excelente.

---

## 9. Flujo de Datos

```
═══════════════════════════════════════════════════════════
               SINCRONIZACIÓN DIARIA (CRON 7AM)
═══════════════════════════════════════════════════════════

  Cron ──GET /api/cron/sync──▶ API Routes
                                  │
                        ┌─────────┴─────────┐
                        │  Por cada cuenta   │
                        │                    │
                        ▼                    ▼
                   Zernio API          Calendario
                   (90 días)           (purga 24h)
                        │                    │
                        ▼                    ▼
                  Posts + Métricas    Items expirados
                        │            eliminados
                        ▼
                   Supabase/JSON
                   (guardar)

═══════════════════════════════════════════════════════════
                   USUARIO NAVEGA
═══════════════════════════════════════════════════════════

  Browser ──GET /api/metrics──▶ API Routes
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

═══════════════════════════════════════════════════════════
                GENERACIÓN DE GUIONES (IA)
═══════════════════════════════════════════════════════════

  Browser ──POST /api/scripts──▶ API Routes
                                    │
                         ┌──────────┴──────────┐
                         ▼                     ▼
                    ¿Anthropic key?       Sin key
                         │                     │
                         ▼                     ▼
                    Claude API            Plantillas
                    (system prompt        (datos reales,
                    + métricas +          sin IA)
                    frameworks)
                         │                     │
                         └──────────┬──────────┘
                                    ▼
                              Guardar guión
                              en BD
                                    │
                                    ▼
                              JSON response
                              ──▶ Browser

═══════════════════════════════════════════════════════════
                GENERACIÓN DE REPORTES
═══════════════════════════════════════════════════════════

  Browser ──POST /api/reports──▶ API Routes
                                    │
                                    ▼
                              Leer datos del
                              periodo + anterior
                                    │
                                    ▼
                              Agregar comparativa
                              + top posts
                                    │
                         ┌──────────┴──────────┐
                         ▼                     ▼
                    ¿Anthropic key?       Sin key
                         │                     │
                         ▼                     ▼
                    Claude genera       Plantilla MD
                    reporte con         con datos reales
                    datos reales
                         │                     │
                         └──────────┬──────────┘
                                    ▼
                              Guardar reporte
                              en BD
                                    │
                                    ▼
                              Markdown response
                              ──▶ Browser
```

---

## 10. Recomendaciones Prioritarias

### 🔴 Prioridad Alta

1. **Agregar tests** — al menos tests unitarios para `metrics.ts`, `reports.ts`, `zernio.ts` y `accounts.ts`. Son los módulos con más lógica de negocio.

2. **Implementar rate limiting** — mínimo en `/api/scripts` y `/api/reports` para evitar abuse de la API de Anthropic ($).

3. **Migrar a esquema relacional** — el esquema ya existe en `001_schema.sql`. Migrar de key-value a tablas normalizadas permitiría queries eficientes, índices y escalabilidad.

4. **Backups automáticos** — configurar backups diarios de Supabase (incluido con el plan Pro, o exportar la tabla `app_store` periódicamente).

### 🟡 Prioridad Media

5. **Descomponer páginas grandes** — `conexion/page.tsx` (704 LOC) y `calendario/page.tsx` (552 LOC) deberían dividirse en componentes reutilizables.

6. **Sync incremental** — en lugar de traer 90 días completos cada vez, comparar con los datos existentes y traer solo los nuevos/actualizados.

7. **Logging estructurado** — integrar un sistema de logs (mínimo `console` con niveles, idealmente un servicio como Axiom o LogSnag).

8. **CI/CD** — configurar GitHub Actions para lint + build en cada push.

### 🟠 Prioridad Baja

9. **Limpiar Zustand** si no se usa, o implementar el store global para estado compartido.

10. **Reemplazar `uid()`** por `crypto.randomUUID()` para IDs seguros.

11. **Considerar PWA** para mejor experiencia móvil (service worker + manifest).

---

## 11. Conclusión Ejecutiva

ContentOS es un sistema **bien diseñado para su propósito**: un dashboard personal de Instagram con funcionalidades de IA. Su mayor fortaleza es la **simplicidad pragmática** — un codebase compacto (~7K LOC), dependencias mínimas (12), y una degradación elegante que permite correr sin ninguna configuración.

Las **debilidades principales** no son de diseño sino de **madurez**: falta de tests, logging, monitoreo y un esquema de datos que escale. El patrón key-value funciona hoy, pero se convertirá en un cuello de botella si el sistema crece.

> ⚠️ **Riesgo más alto:** La **ausencia total de tests** combinada con la **complejidad del sistema multicuenta** — un cambio mal calculado en `accounts.ts` o `db.ts` podría corromper o mezclar datos entre cuentas sin que nadie lo detecte.

El sistema está en un **buen punto para estabilizar**: documentación sólida, arquitectura clara, y las decisiones de diseño están bien justificadas en los comentarios del código. Antes de añadir features nuevos, la recomendación es invertir en tests, observabilidad y migrar al esquema relacional que ya existe.
