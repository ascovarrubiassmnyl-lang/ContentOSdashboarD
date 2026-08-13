# Content OS · Command Center

Dashboard personal de Instagram para **@scav_86** — métricas reales, generador de guiones
con IA (basado en los 7 Frameworks de Viralidad propios), reportes, banco de fuentes,
banco de ideas y calendario editorial.

## Correr en local

```bash
npm install
npm run dev
```

Abre **http://localhost:3333**. Sin llaves configuradas la app corre en **modo demo**;
con `ZERNIO_API_KEY` en `.env.local` entran las métricas reales de Instagram.

## Secciones

| Ruta | Sección |
|---|---|
| `/resumen` | Vista ejecutiva de la semana (landing) |
| `/control` | Control de métricas — 12 KPIs, gráficas, retención, heatmap, top posts |
| `/reportes` | Reportes ejecutivos por periodo con export a Markdown |
| `/fuentes` | Banco de fuentes — texto y archivos (PDF, Word, imágenes) que alimentan al generador |
| `/ideas` | Banco de ideas por etapa del funnel (TOFU/MOFU/BOFU) — Kanban o tabla |
| `/generador` | Chat de guiones con IA — usa métricas reales + banco de fuentes + los 7 frameworks |
| `/calendario` | Calendario editorial — niveles de funnel, duplicar/pegar, auto-limpieza a las 24 h |
| `/conexion` | Cuentas conectadas (multicuenta), estado de la conexión y sync manual |

## Multicuenta

El selector del menú lateral cambia entre cuentas de Instagram. Cada cuenta guarda su
**propia API key de Zernio** (cifrada con `ENCRYPTION_KEY`, AES-256-GCM) y tiene sus
datos completamente separados: métricas, posts, fuentes, ideas, calendario, guiones y
reportes. Cambiar de cuenta cambia el dashboard entero.

Añadir una cuenta: **Conexión → Añadir cuenta** → pega la API key de Zernio → elige cuál
de sus cuentas de Instagram quieres → se sincroniza sola. Puede ser la misma key (si esa
cuenta de Zernio tiene varias cuentas de IG) o la de otra cuenta de Zernio distinta.

La cuenta activa vive en una cookie `httpOnly`, así que el servidor resuelve solo de qué
cuenta son los datos de cada petición. El cron diario recorre **todas** las cuentas.

> La primera cuenta (la que existía antes del multicuenta) conserva sus claves de
> almacenamiento originales y puede seguir usando `ZERNIO_API_KEY` del entorno.

## Fuente de datos: Zernio

La conexión con Instagram va **vía [Zernio](https://zernio.com)** («Instagram Login for
Business»): no requiere app de Meta, cuenta de Facebook ni Página. El dashboard consume
su API con `ZERNIO_API_KEY` (server-side). Métricas por post: alcance, impresiones,
vistas, likes, comentarios, guardados, compartidos y watch time de reels.

Limitaciones de esta fuente (la UI las degrada con elegancia): sin curva de retención
segundo a segundo, sin métricas de historias, sin histórico de seguidores (se construye
al sincronizar cada día) y sin taps al link / CTR de bio.

## IA (generador y reportes)

Con `ANTHROPIC_API_KEY` configurada, Claude escribe los guiones (estructurados con los
7 Frameworks de Guiones Virales) y los reportes. Sin la llave, un generador demo usa
plantillas alimentadas con los datos reales.

## Paso a producción (pendiente)

1. **Supabase**: crear el proyecto y correr `supabase/migrations/001_schema.sql`.
   Activar Auth con allowlist del email del dueño. Migrar `data/*.json` y archivos
   de `data/uploads/` a Storage.
2. **Hosting**: desplegar el proyecto Next.js (Vercel u otro proveedor equivalente)
   con las variables de entorno, y programar un cron diario a las 7:00 a.m. que haga
   `POST /api/connection` (sync) — la purga de calendario corre sola en cada lectura.

## Seguridad

- Llaves de API solo en `.env.local` / variables de entorno del servidor — jamás en el cliente.
- Las API keys de Zernio por cuenta se guardan **cifradas** (AES-256-GCM) y nunca se
  devuelven al navegador: la UI solo sabe si existen, no su valor.
- Todas las llamadas a Zernio y Anthropic salen desde API routes (server-side).
- Validación con Zod en todos los endpoints de escritura.
- RLS activo en el esquema de Supabase para producción.

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS · Recharts · TanStack Query · Zod ·
lucide-react · date-fns · pdf-parse · mammoth. Datos en local: JSON file-store (`data/`);
en producción: Supabase (PostgreSQL + Auth + Storage).
