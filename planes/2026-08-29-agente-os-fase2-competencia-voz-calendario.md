# Plan: Agente OS — Fase 2 (competencia, voz de marca, guiones por formato y calendario)

**Creado:** 2026-08-29
**Estado:** implementado (2026-08-29) — 12 tools registradas y probadas una a una. Ver "Resultado de la validación" al final.
**Pedido:** Ampliar el arnés de la Fase 1 con las capacidades que quedaron fuera: señal de competencia (vía scraping, decidido por el usuario), perfil de voz de marca, generación de guiones/ideas segmentada por formato, tools de calendario y memoria de marca que se actualiza sola.

Depende de `planes/2026-08-29-agente-os-fase1-arnes.md` (implementado y validado). No rediseña nada de lo que ya existe: solo añade tools al array `AGENT_TOOLS`, que es exactamente el criterio de éxito #3 de la Fase 1.

---

## Descripción General

### Qué Logra Este Plan

La Fase 1 dejó un agente que sabe analizar **la cuenta propia** y nada más. Esta fase le da las tres cosas que le faltan para ser útil como mano derecha de contenido:

1. **Contexto externo** — qué hace la competencia, siempre etiquetado como estimado.
2. **Voz propia** — un perfil de tono/estructura derivado de las piezas que de verdad funcionaron, para que el copy que genere suene a la cuenta y no a IA genérica.
3. **Capacidad de actuar** — guardar guiones y organizar el calendario, no solo opinar.

Y una cuarta transversal: **memoria de marca** que se acumula entre sesiones, que es lo que separa "un chat con contexto" de "un asistente que te conoce".

### Por Qué Importa

Sin esto el agente responde preguntas pero no hace trabajo. El usuario pidió explícitamente "la mano derecha de cualquier creador de contenido": eso implica producir (guiones), organizar (calendario) y comparar (competencia), no solo reportar.

---

## Estado Actual

### Estructura Existente Relevante

- `lib/agent/tools.ts` — `AGENT_TOOLS` + `runTool`, ya con validación zod de argumentos. Las tools nuevas se enchufan aquí sin tocar el loop.
- `lib/agent/loop.ts` — loop con cierre forzado y auditoría por tool call. No necesita cambios estructurales; sí una regla nueva de prompt para las tools de escritura.
- `lib/agent/success-definition.ts` — patrón `readSingletonFor`/`writeSingletonFor` sobre `agent_settings`. El perfil de voz y la memoria de marca reutilizan ese mismo mecanismo.
- `types/index.ts` — `Script` (con `status: 'borrador'`), `CalendarItem` (con `nivel` de funnel), `Idea`, `MediaPost` ya existen. Las tools de escritura producen exactamente esos tipos, sin inventar formatos paralelos.
- `lib/accounts.ts` — `SCOPED_COLLECTIONS`; toda colección nueva se registra ahí o queda huérfana al borrar la cuenta.
- `app/api/cron/reports/route.ts` — patrón de cron por cuenta con tolerancia a fallos, molde para el refresco de competencia.

### Brechas que se Abordan

- El agente no tiene ninguna noción de competencia.
- El copy que genere hoy no está anclado a la voz real de la cuenta: sonaría a IA.
- El agente no distingue rendimiento **por formato**, así que no puede decir "los carruseles te funcionan y los reels no".
- No puede guardar nada: cada guion que produzca se pierde al cerrar el chat.
- No hay memoria entre conversaciones.

---

## Decisiones de Diseño

### 1. El scraping alimenta un almacén; el agente nunca scrapea en vivo

El usuario eligió scraping de perfiles públicos. Se construye, pero **fuera del loop del agente**: un cron refresca snapshots de competidores y los guarda; `get_competitor_signal` lee de esa tabla.

Motivo: si el agente scrapeara dentro del turno, cada conversación heredaría la latencia y la fragilidad del scraper. Un bloqueo de Instagram convertiría "el agente está lento/roto" en el síntoma visible de un problema que no tiene nada que ver con el agente.

### 2. Proveedor de scraping intercambiable, con entrada manual como respaldo

Instagram bloquea agresivamente el scraping sin sesión y cambia sus endpoints sin aviso — **este scraper se va a romper**, es cuestión de cuándo. Así que:

- `CompetitorProvider` es una interfaz. El proveedor por defecto (`instagram-public`) lee el endpoint web público.
- Se puede sustituir por un proveedor de pago (Apify, o el propio Zernio si algún día lo ofrece) cambiando una variable de entorno, sin tocar el resto.
- Si el scraping falla, el competidor **no desaparece**: se puede registrar su métrica a mano, y el snapshot queda marcado con `method: 'manual'`. El agente distingue ambos casos.

Esto es deliberado: la alternativa (scraper único empotrado) convierte cada cambio de Instagram en una reescritura.

### 3. Toda señal de competencia es "estimada", en código

`get_competitor_signal` devuelve siempre `reliability: 'estimado'` y nunca `source: 'zernio'`. El disclaimer de competencia lo inserta el renderer, igual que el de confianza — el modelo no decide si lo pone. Es la misma lógica de la Capa 2 aplicada a otra clase de incertidumbre: los datos propios son medidos, los de competencia son observados desde fuera y siempre parciales.

### 4. Las tools de escritura crean borradores, nunca publican

`save_script_draft` crea `Script` con `status: 'borrador'`. `schedule_calendar_item` escribe en el calendario **interno de ContentOS**, que no está conectado a Instagram: nada sale a producción sin que el usuario lo mueva a mano.

Por eso no hace falta el sistema de permisos/sandbox que la Fase 1 descartó: no hay ninguna acción irreversible ni visible hacia fuera. Toda escritura queda auditada en `agent_audit_log`.

### 5. El perfil de voz se deriva de datos, no se le pregunta al modelo

`get_content_voice_profile` no le pide al modelo "describe la voz de esta cuenta". Extrae en código, de las piezas con mejor rendimiento real: longitud media de hook, uso de pregunta/imperativo/número al abrir, formatos dominantes, emojis por pieza, longitud de caption. El modelo recibe esos hechos y los interpreta.

Motivo: un perfil de voz inventado por el modelo se autoconfirma — le pides que escriba "en tu voz" con una definición que él mismo se sacó de encima. Anclarlo a las piezas que funcionaron lo hace falsable.

### 6. La memoria de marca se actualiza explícitamente, nunca en silencio

`update_brand_memory` es una tool que el agente llama cuando el usuario le dice algo estable sobre la marca ("no uso emojis", "mi público son fundadores B2B"). Cada entrada guarda **de qué conversación salió** y la fecha, y se puede borrar desde la UI.

Se descarta que el agente infiera y guarde memoria por su cuenta: memoria escrita sin que el usuario se entere es la vía rápida a un asistente que "recuerda" cosas falsas y nadie sabe por qué las cree.

### Alternativas Consideradas

- **Scraping en vivo dentro del turno del agente**: rechazado por Decisión #1 (latencia y fragilidad contagiadas al chat).
- **Perfil de voz generado por el modelo**: rechazado por Decisión #5 (se autoconfirma).
- **Memoria inferida automáticamente**: rechazado por Decisión #6 (no auditable por el usuario).
- **Que el agente publique o programe en Instagram**: fuera de alcance, y sin acuerdo previo del usuario. Todo queda en borrador dentro de ContentOS.

### Preguntas Abiertas

- **Cadencia del refresco de competencia**: se propone diaria, en el mismo cron que ya existe. Un competidor no cambia lo suficiente en un día como para justificar más.
- **Cuántos competidores por cuenta**: se limita a 10 para acotar el coste del scraping y la superficie de bloqueo. Ajustable.

---

## Cambios Propuestos

### Nuevos Archivos

| Ruta | Propósito |
| --- | --- |
| `lib/competitors/types.ts` | `Competitor`, `CompetitorSnapshot`, interfaz `CompetitorProvider`. |
| `lib/competitors/instagram-public.ts` | Proveedor por defecto: perfil público de Instagram. Aislado para poder sustituirlo. |
| `lib/competitors/store.ts` | Alta/baja/listado de competidores y sus snapshots, sobre `readFor`/`writeFor`. |
| `lib/competitors/refresh.ts` | Refresca los snapshots de una cuenta; tolera fallos por competidor. |
| `lib/agent/voice-profile.ts` | Deriva el perfil de voz en código desde las piezas con mejor rendimiento. |
| `lib/agent/brand-memory.ts` | Lectura/escritura de la memoria de marca, con procedencia. |
| `lib/agent/write-tools.ts` | Implementación de las tools que escriben (guiones, calendario), separadas de las de lectura. |
| `app/api/competitors/route.ts` | GET/POST/DELETE de competidores + POST de snapshot manual. |
| `app/api/cron/competitors/route.ts` | Cron de refresco de snapshots por cuenta. |
| `app/api/brand-memory/route.ts` | GET/POST/DELETE de la memoria de marca (para que el usuario la audite). |

### Archivos a Modificar

| Ruta | Cambios |
| --- | --- |
| `lib/agent/tools.ts` | Añadir al array `AGENT_TOOLS` y al dispatcher: `get_competitor_signal`, `get_content_voice_profile`, `get_format_performance`, `get_brand_memory`, `save_script_draft`, `list_calendar`, `schedule_calendar_item`, `update_brand_memory`. Con sus esquemas zod. |
| `lib/agent/loop.ts` | Añadir al system prompt las reglas de competencia (siempre estimada), de escritura (solo borradores, confirmar qué se guardó) y de memoria. Inyectar la memoria de marca en el prompt. |
| `lib/agent/report.ts` | Sección de formato del reporte quincenal pasa a usar `get_format_performance`. |
| `types/index.ts` | `Competitor`, `CompetitorSnapshot`, `VoiceProfile`, `BrandMemoryEntry`. |
| `lib/accounts.ts` | `SCOPED_COLLECTIONS` += `competitors`, `competitor_snapshots`, `brand_memory`. |
| `scripts/railway-cron.mjs`, `custom-worker.js` | Añadir `/api/cron/competitors` a los disparadores reales. |
| `.env.example` | `COMPETITOR_PROVIDER` (default `instagram-public`). |

---

## Tareas Paso a Paso

1. **Tipos y colecciones** — `types/index.ts` + `SCOPED_COLLECTIONS`.
2. **Almacén de competidores** — `lib/competitors/store.ts`, con tope de 10 por cuenta.
3. **Proveedor de scraping** — interfaz + `instagram-public`, con timeout, un solo reintento y fallo explícito (nunca devolver ceros como si fueran datos: es el mismo error que la validación de la Fase 1 vino a arreglar).
4. **Refresco + cron** — `lib/competitors/refresh.ts` y `app/api/cron/competitors/route.ts`, tolerante a fallos por competidor.
5. **Perfil de voz** — `lib/agent/voice-profile.ts`, derivado en código.
6. **Memoria de marca** — `lib/agent/brand-memory.ts` con procedencia.
7. **Rendimiento por formato** — `get_format_performance` con `n` por formato (no un `n` global: un formato con 2 piezas no puede compararse con uno de 40, y el `confidence_tier` debe reflejarlo por separado).
8. **Tools de escritura** — `lib/agent/write-tools.ts`.
9. **Registro de tools** — esquemas zod + `AGENT_TOOLS` + dispatcher.
10. **Reglas del prompt** — competencia, escritura, memoria.
11. **Endpoints** — competidores, memoria de marca.
12. **Cron wiring** — Railway y Cloudflare.
13. **Validación** — `tsc`, pruebas directas de cada tool sin gastar créditos, y una corrida del agente end-to-end.

---

## Criterios de Éxito

1. El agente puede comparar la cuenta contra un competidor y **siempre** marca esa comparación como estimada, sin que el modelo pueda omitirlo.
2. El `confidence_tier` del rendimiento por formato es independiente por formato.
3. Un guion generado se guarda como borrador y aparece en `/generador`; una pieza programada aparece en `/calendario`.
4. La memoria de marca sobrevive entre conversaciones y el usuario puede ver y borrar cada entrada con su procedencia.
5. Si el scraping se rompe, el agente sigue funcionando y lo dice, en vez de reportar ceros.

---

## Resultado de la validación (2026-08-29)

`tsc` limpio. Las 12 tools se probaron directamente contra los datos, sin gastar créditos de modelo:

- **Criterio 2 cumplido**: `get_format_performance` devolvió REEL `n=17 → debil`, CAROUSEL `n=6 → insuficiente`, IMAGE `n=1` — cada formato con su propia confianza, que era el punto.
- **Perfil de voz**: derivado de las 15 mejores piezas de 24, `confidence_tier: debil`, con métricas reales de hook y caption. Nada inventado por el modelo.
- **Criterio 1 cumplido**: `get_competitor_signal` devuelve siempre `reliability: 'estimado'` + el aviso, y expone `stale_days` (probado: una observación de hace 20 días se reporta como tal).
- **Criterio 3 cumplido**: guion guardado como borrador, pieza añadida al calendario y movida por id real.
- **Criterio 4 cumplido**: la memoria persiste con procedencia (`source_conversation_id`), deduplica lo repetido, y se puede leer y borrar desde `/api/brand-memory`.
- **Criterio 5 cumplido, y confirmado en vivo**: el scraper contra un perfil público real devolvió **HTTP 400 (bloqueo de Instagram)**. Falló con un mensaje accionable en vez de devolver ceros; el cron registró el fallo por competidor sin romperse y **sin sobrescribir la observación manual buena**, que siguió siendo la última válida.
- **Rechazos verificados**: id de calendario inventado, formato de guion inexistente y fecha no-ISO, todos rechazados con mensajes que el modelo puede corregir.

**Consecuencia práctica del bloqueo de Instagram:** el scraping automático hoy **no funciona** contra Instagram sin sesión — era lo previsto en la Decisión #2. La función se sostiene sobre el registro manual, y el camino real si se quiere automatizar es escribir un `CompetitorProvider` contra un servicio de pago. Toda la arquitectura de arriba (almacén, cron, tool, UI) ya está lista para eso: es un archivo nuevo y una variable de entorno.

---

## Notas

**Fase 3 (plan aparte):** wiring del rediseño de UI del usuario (pendiente de que comparta los archivos), renombrar Reportes → Agente OS, chat con streaming e historial, e ingestión de video individual.
