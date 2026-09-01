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
| `/agente` | **Agente OS** — chat con el agente de contenido; los reportes ejecutivos viven en su panel lateral, con export a PDF |
| `/fuentes` | Banco de fuentes — texto y archivos (PDF, Word, imágenes) que alimentan al generador |
| `/ideas` | Banco de ideas por etapa del funnel (TOFU/MOFU/BOFU) — Kanban o tabla |
| `/generador` | Chat de guiones con IA — usa métricas reales + banco de fuentes + los 7 frameworks |
| `/calendario` | Calendario editorial — niveles de funnel, duplicar/pegar, auto-limpieza a las 24 h, cobertura vs. lo declarado |
| `/estrategia` | **Estructura de calendario declarada** — cadencia, mezcla de funnel, franjas, pilares y reglas de copy, más métrica de éxito, notificaciones y memoria de marca |
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

## IA — Agente OS

Con `OPENROUTER_API_KEY` configurada, el agente de contenido (OpenRouter, tool-calling
sobre las métricas reales de la cuenta) redacta los reportes quincenales y responde en
el chat. Sin la llave, `app/api/agent/chat` y la generación de reportes fallan
explícitamente en vez de inventar datos.

**Contrato de confianza:** toda cifra que el agente reporta viene de una tool que calcula
en código el tamaño de muestra (`n`) y su nivel de confianza; el modelo no puede
inventarlos ni omitir el aviso cuando la muestra es pequeña. Cada llamada queda en
`agent_audit_log`, así que cualquier afirmación del reporte se puede cruzar con el dato
que la respalda.

Lo que sabe hacer: analizar crecimiento, retención y rendimiento **por formato** (con
confianza independiente por formato), derivar el perfil de voz de la cuenta desde sus
piezas con mejor rendimiento, comparar contra competidores, leer el link de un reel
que le pegues, escribir guiones y organizar el calendario. Los guiones se guardan como
borrador y el calendario es el interno de la app: **el agente nunca publica en
Instagram**.

Se habla con él en `/agente`. Mientras trabaja, la interfaz muestra en vivo **qué tool
está consultando y con qué `n`** — no texto apareciendo letra a letra. Es a propósito:
la respuesta final viaja dentro de `submit_insights` y el disclaimer de confianza se lo
añade el código al parsearla, así que emitir prosa según llega significaría enseñarla
antes de saber si lleva aviso.

## Estructura de calendario y planificación en bloque

En `/estrategia` se declara **cómo quieres operar**: cuántas piezas por semana y de qué
formato, la mezcla TOFU/MOFU/BOFU, los días y horas habituales (con zona horaria), tus
pilares de contenido y tus reglas de copy. El agente lo lee como criterio en cada
conversación.

Es un dato **declarado**, y el código lo mantiene separado de lo medido: el agente puede
usarlo para planificar, pero tiene prohibido citarlo como prueba de que algo funciona —
para eso están las métricas, con su `n` y su nivel de confianza. Si no has declarado
nada, el agente lo dice y propone partir de uno de los **arquetipos de calendario**
incluidos (educativo B2B, marca personal, e-commerce, servicios locales, autoridad de
bajo volumen, semana de lanzamiento), avisando de que son heurísticas y no mediciones de
tu cuenta.

Pidiéndole que organice una quincena, el agente arma el plan completo y lo deja
**pendiente de tu aprobación**: aparece una tarjeta con las piezas día por día y los
desvíos respecto a tu cadencia declarada (salirse no es un error — una semana de
lanzamiento lo hace a propósito). Un clic en «Aplicar al calendario» crea las piezas de
golpe, y «Deshacer» borra exactamente esas, sin tocar el resto. El agente propone; quien
ejecuta es el botón.

`/calendario` muestra la cobertura de la semana: programado frente a declarado, con el
mismo cálculo que consume el agente.

## Notificaciones

Con las claves VAPID configuradas (`npx web-push generate-vapid-keys`), ContentOS envía
notificaciones push reales: recordatorios antes de que toque publicar una pieza, avisos
cuando el agente termina un reporte, y alertas si una cuenta deja de sincronizar. Se
activan desde la campana, en el panel de notificaciones.

Detalles que conviene saber:

- **Suenan con el tono de notificación del dispositivo**, como cualquier otra app. La
  Notification API no permite enviar un tono propio en segundo plano, así que no se
  promete.
- **En iOS hace falta instalar la PWA** en la pantalla de inicio (iOS 16.4+); el panel lo
  explica cuando detecta ese caso.
- **Sin claves VAPID todo sigue funcionando**: el historial de avisos vive igual dentro
  de la app y la UI dice qué falta.
- Cada aviso se deduplica en código, así que el cron de 15 minutos no puede repetir el
  mismo recordatorio; las horas de silencio se aplican en el servidor.

## Competencia

Los competidores se registran desde la app (máx. 10 por cuenta) y un cron diario intenta
refrescar sus datos leyendo el perfil público (`COMPETITOR_PROVIDER=instagram-public`).

⚠️ Ese proveedor gratuito **está confirmado bloqueado**: Instagram responde HTTP 400 a
su endpoint público desde una IP de servidor. Sirve como intento barato, no como plan.

Hay dos salidas, y las dos ya funcionan:

- **`COMPETITOR_PROVIDER=apify`** con un `APIFY_TOKEN` — verificado contra perfiles
  reales. Se factura por lectura (~0.003 USD): 10 competidores con el cron diario
  salen por ~1 USD al mes.
- **Registro manual** desde la app, que queda marcado como `manual`.

En los tres casos el agente trata el dato como **estimado**, nunca al mismo nivel que
las métricas propias, e indica cuántos días tiene la observación. Cuando un refresco
falla no se guarda nada: la última observación buena sobrevive con su fecha.

## Analizar un link de video

Pegar el link de un reel o post de Instagram en el chat hace que el agente lo lea
(vía Apify) y describa cómo está construido: copy, duración, estructura del hook, y
cómo se compara con la voz de la cuenta.

Es **una pieza ajena observada desde fuera**: se ven los likes y comentarios públicos,
no el alcance, ni los guardados, ni si llevaba pauta. Por eso llega siempre con `n: 1`
y confianza `insuficiente`, y el agente no puede decir que funcionó ni recomendarte
copiarla por sus números. Solo Instagram: un link de TikTok o YouTube se rechaza
nombrando el dominio en vez de intentarlo y devolver basura.

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
