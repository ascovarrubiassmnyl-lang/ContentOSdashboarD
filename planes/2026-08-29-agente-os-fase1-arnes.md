# Plan: Agente OS — Fase 1 (arnés del agente + reporte automático de 15 días)

**Creado:** 2026-08-29
**Estado:** implementado (2026-08-29) — validado end-to-end salvo el contenido final del reporte, bloqueado por saldo de OpenRouter. Ver "Hallazgos de la validación" al final.
**Pedido:** Construir el arnés del agente de IA (OpenRouter + tool-calling + grounding estadístico) que reemplaza el generador de reportes hardcodeado, y usarlo para producir automáticamente, cada 15 días, el reporte completo de todas las cuentas.

Basado en `CONTENTOS_AGENTE_ARNES.md` (documento del usuario), con dos ajustes de diseño explicados en la sección de Decisiones: se colapsa el router de intención en un solo loop con tool-calling, y se resuelve la pregunta abierta #1 de ese documento (no bloquea nada, ver Estado Actual).

---

## Descripción General

### Qué Logra Este Plan

Reemplaza `lib/reports.ts` (un prompt único que redacta un reporte a partir de un bloque de texto con números) por un **agente con herramientas**: funciones de código que calculan métricas, tamaño de muestra (`n`) y nivel de confianza, que el modelo consulta durante una conversación de verdad con Claude vía OpenRouter. Ese mismo agente se usa para generar, cada 15 días y sin intervención humana, el reporte de las 5 secciones que pidió el usuario (crecimiento, retención, ranking + por qué, copy/formato + por qué, qué mejorar/mantener) para cada cuenta del workspace.

### Por Qué Importa

Es la pieza que decide si "Agente OS" es de verdad un agente o un generador de texto con nombre nuevo. Sin esto, cualquier UI de chat que se conecte quedaría hablando con el mismo prompt estático de hoy — sin memoria, sin poder consultar datos reales turno a turno, y sin ninguna garantía de que no inventa cifras. Esta fase es la dependencia dura de todo lo demás (competencia, guiones, calendario, UI nueva).

---

## Estado Actual

### Estructura Existente Relevante

- `lib/reports.ts` — `generateReport(ws, start, end)`: agrega `metric_snapshots` y `media_posts` por rango de fechas, arma un bloque de texto y llama a `askClaude()` una sola vez (o cae a una plantilla hardcodeada si no hay `ANTHROPIC_API_KEY`). Sin memoria, sin herramientas, sin verificación de `n`.
- `lib/claude.ts` — cliente REST directo a Anthropic. Confirmado por grep: **solo lo usa `lib/reports.ts`**. Seguro de retirar por completo.
- `app/api/reports/route.ts` — `GET`/`POST` sobre la colección `reports`, ya filtrada por workspace vía `requireWorkspace()`. Se mantiene tal cual: solo cambia lo que hace `generateReport` por dentro.
- `app/api/cron/sync/route.ts` — patrón ya probado de cron protegido con `CRON_SECRET`, que hace `for (const ws of await listAccounts())` y tolera que una cuenta falle sin tumbar a las demás. Es el molde para el cron de reportes.
- `lib/accounts.ts` — `SCOPED_COLLECTIONS`, `readFor`/`writeFor` por workspace (namespacing automático vía `collectionKey`). Toda colección nueva del agente debe registrarse aquí para borrarse si se elimina la cuenta.
- `lib/zernio.ts` — `ZernioPost.analytics` trae métricas **por publicación individual** (no solo agregados), y ese detalle ya se persiste en `media_posts`/`metric_snapshots`. Esto es lo que permite calcular `n` de cualquier segmento localmente.
- `types/index.ts` — `MetricSnapshot`, `MediaPost` (incluye `retention_curve`, `avg_watch_time_seconds`), `Report` ya existen y son la base de datos que las tools van a leer.
- `.env.example` — no existe `OPENROUTER_API_KEY` ni variable de modelo.

### Brechas o Problemas que se Abordan

- El "reporte" actual es un solo prompt, no un agente: no puede usarse para chat, no consulta datos bajo demanda, no tiene memoria de conversación.
- Ninguna cifra que redacta el modelo hoy declara su tamaño de muestra — puede sonar seguro con 3 posts igual que con 300.
- No hay generación automática cada 15 días: hoy el reporte es 100% manual, con botón, un rango a la vez, una cuenta a la vez.
- No hay integración con OpenRouter en el repo (confirmado por grep, cero resultados).
- No hay tabla de auditoría de qué herramienta se llamó, con qué `n` y qué conclusión final — pedida explícitamente en el documento del usuario (sección 7).

---

## Cambios Propuestos

### Resumen de Cambios

- Cliente OpenRouter (`lib/openrouter.ts`) con soporte de tool-calling, reemplaza `lib/claude.ts` por completo.
- Capa de confianza estadística en código (`lib/agent/confidence.ts`): clasifica `n` en `insuficiente | débil | razonable`, nunca lo decide el modelo.
- Tools del agente (`lib/agent/tools.ts`): `get_metrics`, `get_post_breakdown`, `get_success_definition` — cada una devuelve `n` y `confidence_tier` calculados en código.
- Loop del agente con tool-calling (`lib/agent/loop.ts`): un solo system prompt (sin router de intención separado — ver Decisiones #1), salida estructurada obligatoria (JSON de insights) antes de redactar texto, con el disclaimer de confianza inyectado por código, no por el modelo.
- `success_definition` configurable por cuenta, persistida, con default declarado explícitamente si no se configura (resuelve la pregunta abierta #3 del documento).
- Log de auditoría mínimo por cuenta (`lib/agent/audit.ts`): `conversation_id, tool_called, params, n_returned, confidence_tier, claim_final`.
- `lib/reports.ts` se reescribe para orquestar el agente (`lib/agent/report.ts`) en vez de un prompt único, produciendo las 5 secciones pedidas por el usuario.
- Nuevo cron (`app/api/cron/reports/route.ts`) que, cada vez que corre, genera el reporte de cada cuenta cuya última generación tiene 15+ días (o nunca tuvo una).
- Endpoint de chat mínimo (`app/api/agent/chat/route.ts`) para poder probar el loop por curl/Postman antes de que exista cualquier UI nueva.
- Endpoint de configuración de `success_definition` (`app/api/success-definition/route.ts`).

### Nuevos Archivos a Crear

| Ruta del Archivo | Propósito |
| --- | --- |
| `lib/openrouter.ts` | Cliente REST a OpenRouter (chat completions, streaming, tool-calling). Reemplaza `lib/claude.ts`. |
| `lib/agent/confidence.ts` | `confidenceTier(n: number): ConfidenceTier` con umbrales configurables (constantes, no mágicos inline). |
| `lib/agent/tools.ts` | Definición de las tools (schema OpenAI-style para tool-calling) + sus implementaciones, leyendo `media_posts`/`metric_snapshots` vía `readFor`. |
| `lib/agent/success-definition.ts` | Lectura/escritura de la métrica de éxito configurada por cuenta, con default declarado. |
| `lib/agent/loop.ts` | El loop del agente: system prompt, ronda de tool-calling con OpenRouter, parseo de la salida estructurada (Capa 2), render del disclaimer de confianza. |
| `lib/agent/audit.ts` | Escritura del log de auditoría por conversación/turno. |
| `lib/agent/report.ts` | Orquesta el loop del agente con un prompt de tarea fijo ("genera el reporte quincenal") para producir las 5 secciones pedidas; usado tanto por `lib/reports.ts` como por el cron de 15 días. |
| `app/api/agent/chat/route.ts` | POST de chat de prueba (streaming) — habla con el loop del agente con memoria de hilo. No es la UI final, es la superficie para validar el arnés antes de la Fase 3. |
| `app/api/success-definition/route.ts` | GET/PUT de la métrica de éxito configurada por cuenta. |
| `app/api/cron/reports/route.ts` | Cron protegido con `CRON_SECRET`: recorre `listAccounts()`, genera reporte quincenal por cuenta si corresponde. |

### Archivos a Modificar

| Ruta del Archivo | Cambios |
| --- | --- |
| `lib/reports.ts` | `generateReport(ws, start, end)` deja de construir el prompt/plantilla a mano; llama a `lib/agent/report.ts` y persiste el resultado igual que hoy (mismo tipo `Report`, mismo contrato con `app/api/reports/route.ts`, sin romper la UI actual). |
| `lib/accounts.ts` | Agregar a `SCOPED_COLLECTIONS`: `agent_threads`, `agent_messages`, `agent_audit_log`, `agent_settings` (esta última guarda `success_definition` y, a futuro, el perfil de voz). |
| `types/index.ts` | Nuevos tipos: `ConfidenceTier`, `ToolResult<T>` (`value`, `n`, `period`, `confidence_tier`, `source`), `Insight`, `AgentThread`, `AgentMessage`, `AuditLogEntry`, `SuccessDefinition`. |
| `.env.example` | Agregar `OPENROUTER_API_KEY=` y `OPENROUTER_MODEL=anthropic/claude-sonnet-5` (valor sugerido, configurable). |
| `app/api/health/route.ts` | Cambiar el check de `ANTHROPIC_API_KEY` (si existe) por `OPENROUTER_API_KEY`. |

### Archivos a Eliminar

| Ruta del Archivo | Motivo |
| --- | --- |
| `lib/claude.ts` | Confirmado por grep: único consumidor era `lib/reports.ts`, que se reescribe en este mismo plan. `askClaudeMessages` y `askClaudeVision` ya estaban sin uso en el resto del repo. |

---

## Decisiones de Diseño

### Decisiones Clave Tomadas

1. **OpenRouter como motor único** (ya confirmado por el usuario): `lib/claude.ts` se retira por completo, no convive con OpenRouter. Un solo proveedor, un solo lugar donde cambiar de modelo.
2. **Sin router de intención separado — un solo loop con tool-calling.** El documento del usuario propone clasificar el mensaje (`analisis_metricas | analisis_competencia | generacion_copy | estrategia_mixta`) antes de despachar a una sub-skill. Se simplifica: el riesgo real que ese router busca evitar (que el modelo redacte una cifra sin respaldo) ya lo bloquea la Capa 1 — las tools devuelven `n`/`confidence_tier` calculados en código, así que el modelo no tiene margen para "inventar con confianza" sin importar el tono del prompt. Un router agrega una llamada extra de latencia/costo por turno para un problema ya resuelto en otra capa. Si en producción se observa contagio real entre modo-dato y modo-creativo, se agrega el router — es barato de sumar después y caro de construir por adelantado con 2 usuarios.
3. **La pregunta abierta #1 del documento (¿Zernio segmenta con `n` real?) no bloquea nada.** ContentOS ya guarda cada publicación individual en `media_posts` (con sus métricas propias) vía la sincronización de Zernio. Cualquier segmento ("reels <30s", "carruseles del último mes") se arma filtrando esas filas localmente — el `n` de un segmento es simplemente cuántas filas locales cumplen la condición. No hace falta que la API de Zernio soporte segmentación nativa.
4. **`success_definition` con default declarado, no bloqueante.** Resuelve la pregunta abierta #3: si la cuenta no configuró una métrica de éxito, el agente usa `reach` por default pero **lo declara explícitamente** en cada insight de rendimiento ("asumiendo alcance como métrica de éxito porque no configuraste una — puedes cambiarla en Ajustes del agente"). No se fuerza a configurar antes de dar cualquier insight: eso frenaría el primer uso sin necesidad.
5. **Umbrales de `confidence_tier` como constantes explícitas y documentadas como provisionales** (`n<10` insuficiente, `10–30` débil, `30+` razonable) — se mantienen como en el documento del usuario, con un comentario en código que dice que hay que recalibrarlos contra volumen real de posts de las cuentas piloto (pregunta abierta #4, sigue abierta, no se resuelve en este plan).
6. **`get_competitor_signal` y `get_content_voice_profile` quedan fuera de esta fase.** El documento del usuario ya las ordena después de validar el flujo de métricas propias (su sección 9, pasos 5). Se listan como Fase 2 en Notas.
7. **El reporte de 15 días es el entregable que prueba el arnés end-to-end.** En vez de construir el loop y dejarlo sin uso hasta que exista una UI de chat, se conecta de inmediato al cron: es el requisito #1 original del usuario, reutiliza exactamente las mismas tools que el chat va a usar después, y da una forma concreta de verificar que el agente funciona antes de tocar ninguna UI.
8. **No se toca el contrato de `app/api/reports/route.ts` ni de `app/reportes/page.tsx` en esta fase.** La UI actual sigue funcionando con el botón manual de "Generar reporte" — ahora respaldado por el agente en vez de la plantilla — hasta que la Fase 3 la reemplace por el rediseño.
9. **Sin sandbox ni sistema de permisos de escritura** (ya decidido en el documento del usuario, sección 2): el agente no publica ni programa nada en esta fase, así que ese arnés de agente autónomo no aplica.

### Alternativas Consideradas

- **Router de intención + 4 sub-skills** (documento original): rechazado para v1 por la razón del punto 2 — el grounding ya vive en las tools, no en el prompt, así que el router no compra seguridad adicional proporcional a su costo. Queda documentado para reconsiderar si hay contagio real observado.
- **Segundo modelo auditor de alucinaciones** (mencionado y ya descartado en el documento del usuario): se mantiene descartado por el mismo motivo — con 2 usuarios que van a notar output raro, ese costo no se justifica.
- **Mantener Anthropic directo además de OpenRouter**: rechazado — el usuario ya decidió OpenRouter como motor único.

### Preguntas Abiertas

- **Modelo exacto detrás de `OPENROUTER_MODEL`**: se deja `anthropic/claude-sonnet-5` como default sugerido en `.env.example`, pero es una variable de entorno — el usuario puede cambiarla sin tocar código. Si prefiere otro modelo por default, es un cambio de una línea.
- **Calibración real de los umbrales de `confidence_tier`** (pregunta abierta #4 del documento): sigue abierta, requiere ver volumen real de posts/mes de las cuentas piloto una vez el reporte quincenal lleve un par de ciclos corriendo.
- **Frecuencia real del scheduler de cron**: el cron de reportes puede correr diario (revisando "¿ya pasaron 15 días desde el último reporte de esta cuenta?") igual que el cron de sync existente, o correr cada 15 días exactos. Se recomienda diario (mismo scheduler que ya existe para sync, un solo cron trigger de infraestructura) — confirmar que esto es aceptable o si se prefiere un scheduler separado.

---

## Tareas Paso a Paso

### Paso 1: Cliente OpenRouter

Crear `lib/openrouter.ts` siguiendo la forma de `lib/claude.ts` (mismo estilo: `hasOpenRouterKey()`, funciones `async` con `fetch`, sin SDK nuevo — OpenRouter expone una API compatible con OpenAI chat completions).

**Acciones:**

- `hasOpenRouterKey(): boolean` — chequea `process.env.OPENROUTER_API_KEY`.
- `chatCompletion({ system, messages, tools, maxTokens }): Promise<{ content: string | null; toolCalls: ToolCall[] | null }>` — POST a `https://openrouter.ai/api/v1/chat/completions`, header `Authorization: Bearer ${OPENROUTER_API_KEY}`, body con `model: process.env.OPENROUTER_MODEL`, `messages`, `tools` (formato OpenAI: `{type: 'function', function: {name, description, parameters}}`), `tool_choice: 'auto'`.
- `chatCompletionStream(...)` — variante con `stream: true` para el endpoint de chat de prueba (Paso 7); parsea los chunks `data: {...}` de Server-Sent Events.
- Manejo de error igual que `callClaude`: si `!res.ok`, lanzar `Error` con status + primeros 300 caracteres del body.

**Archivos afectados:**

- `lib/openrouter.ts`

---

### Paso 2: Capa de confianza estadística

Crear `lib/agent/confidence.ts`.

**Acciones:**

- Constantes exportadas: `CONFIDENCE_THRESHOLDS = { insuficiente: 10, debil: 30 }` (comentario: "provisional, recalibrar con volumen real — ver planes/2026-08-29-agente-os-fase1-arnes.md").
- `confidenceTier(n: number): ConfidenceTier` → `'insuficiente' | 'debil' | 'razonable'`.
- `confidenceDisclaimer(tier: ConfidenceTier, n: number): string | null` → devuelve el texto de advertencia (ej. `"⚠️ Basado en solo ${n} posts — señal débil, trátalo como hipótesis, no como regla."`) para `insuficiente`/`debil`, `null` para `razonable`. Esto es lo que el renderer de Capa 2 va a insertar sin pasar por el modelo.

**Archivos afectados:**

- `lib/agent/confidence.ts`

---

### Paso 3: Tools del agente

Crear `lib/agent/tools.ts`. Cada tool implementa el contrato de la sección 6 del documento del usuario.

**Acciones:**

- `get_metrics(ws, { metric, range: {start, end}, segment? })`: agrega `metric_snapshots` (reusar la lógica de `inRange`/`sum` que hoy vive en `lib/reports.ts`) filtrado por `segment` si viene (ej. `{ media_type: 'REEL', max_duration_seconds: 30 }` aplicado sobre `media_posts` para contar `n`). Devuelve `{ value, n, period, confidence_tier: confidenceTier(n), source: 'zernio' }`.
- `get_post_breakdown(ws, { range, sort_by })`: lee `media_posts` en rango, ordena por el criterio pedido (interacciones, guardados, alcance...), devuelve lista + `n` total del periodo.
- `get_success_definition(ws)`: llama a `lib/agent/success-definition.ts` (Paso 4).
- Exportar `AGENT_TOOLS`: array con el schema JSON de cada tool (nombre, descripción, parámetros) en formato compatible con `chatCompletion({ tools })` del Paso 1, y un dispatcher `runTool(ws, name, args)` que invoca la función correcta.
- Cada descripción de tool en el schema debe dejar explícito en texto qué puede y qué NO puede afirmar el modelo con ese resultado (ej. en `get_metrics`: "el confidence_tier ya viene calculado, nunca lo inventes ni lo recalcules").

**Archivos afectados:**

- `lib/agent/tools.ts`

---

### Paso 4: `success_definition` persistida

Crear `lib/agent/success-definition.ts`.

**Acciones:**

- `DEFAULT_SUCCESS_METRIC = 'reach'`.
- `getSuccessDefinition(ws): Promise<SuccessDefinition>` — lee de `agent_settings` (vía `readSingletonFor`); si no existe, devuelve `{ metric: DEFAULT_SUCCESS_METRIC, configured: false }`.
- `setSuccessDefinition(ws, metric): Promise<void>` — escribe `{ metric, configured: true }` en `agent_settings` vía `writeSingletonFor`.
- El campo `configured: false` es lo que el renderer usa para decidir si mostrar el texto de "no configuraste una métrica, asumo alcance" (ver Decisión #4).

**Archivos afectados:**

- `lib/agent/success-definition.ts`

---

### Paso 5: Loop del agente (Capa 2 — salida estructurada + disclaimers)

Crear `lib/agent/loop.ts`. Es el corazón del arnés.

**Acciones:**

- System prompt único (sin router — Decisión #2), que dejar explícito en el propio texto: "cuando reportes métricas, cada afirmación de rendimiento debe venir de una tool call, nunca de memoria o estimación propia; cuando generes copy/ideas, tienes libertad creativa pero no puedes afirmar que algo 'va a funcionar mejor' — eso es trabajo del análisis de métricas, no tuyo en ese momento."
- Loop de tool-calling: llamar `chatCompletion` con `AGENT_TOOLS`; mientras la respuesta traiga `toolCalls`, ejecutar `runTool` por cada una, loguear en `lib/agent/audit.ts` (Paso 6), agregar el resultado como mensaje `tool` a la conversación, y volver a llamar al modelo. Cortar cuando responda con `content` en vez de `toolCalls`, o tras un máximo de rondas (ej. 6) para evitar loops infinitos.
- Forzar salida estructurada final: pedir al modelo, en el último turno, que devuelva un bloque JSON con `insights: Insight[]` (`claim, metric, n, confidence_tier, source`) antes del texto libre — o, más simple y robusto, pedirlo como tool call final (`submit_insights`) en vez de confiar en que el modelo respete un formato de texto. Preferir la tool call: es lo que ya se usa para todo lo demás y no depende de parseo de texto.
- Renderer: por cada `insight` con `confidence_tier !== 'razonable'`, insertar el disclaimer de `confidenceDisclaimer()` en el Markdown final, en código — nunca dejar que el propio modelo decida si lo escribe.
- Exportar `runAgentTurn({ ws, thread, userMessage }): Promise<{ replyMd: string; insights: Insight[] }>` para uso conversacional, y una variante sin turno de usuario (`runAgentTask({ ws, taskPrompt }): Promise<{ replyMd: string; insights: Insight[] }>`) para tareas programadas como el reporte quincenal.

**Archivos afectados:**

- `lib/agent/loop.ts`

---

### Paso 6: Log de auditoría

Crear `lib/agent/audit.ts`.

**Acciones:**

- `logToolCall(ws, entry: { conversation_id, tool_called, params, n_returned, confidence_tier, claim_final }): Promise<void>` — hace `push` a la colección `agent_audit_log` vía `readFor`/`writeFor`.
- Llamado desde dentro del loop del Paso 5 cada vez que se ejecuta una tool.

**Archivos afectados:**

- `lib/agent/audit.ts`

---

### Paso 7: Orquestador del reporte quincenal

Crear `lib/agent/report.ts`. Reemplaza la lógica que hoy vive inline en `lib/reports.ts`.

**Acciones:**

- `generateAgentReport(ws, periodStart, periodEnd): Promise<{ summary_md: string; insights: Insight[] }>`.
- Task prompt fijo que exige las 5 secciones pedidas por el usuario, una por una, cada una respaldada por tool calls antes de redactarse:
  1. Métricas de crecimiento (`get_metrics` sobre followers/reach/views del periodo vs. el anterior).
  2. Métricas de retención en video (`get_metrics`/`get_post_breakdown` filtrado a REEL, usando `retention_curve`/`avg_watch_time_seconds` de `media_posts`).
  3. Ranking del mejor contenido del periodo y por qué (`get_post_breakdown` ordenado por interacciones + justificación anclada a los datos devueltos, no inventada).
  4. Análisis de copy y formato de las piezas top (mismo `get_post_breakdown`, analizando `hook`/`media_type` de esas piezas).
  5. Qué no funciona y qué mantener, en forma accionable (comparación periodo actual vs. anterior vía `get_metrics`).
- Mantener el caso "sin datos en el periodo" (hoy manejado a mano en `lib/reports.ts:101-116`) como salida temprana **antes** de invocar al agente — evita gastar una llamada de modelo cuando no hay nada que analizar, y evita el riesgo de que el modelo "rellene" con generalidades.

**Archivos afectados:**

- `lib/agent/report.ts`

---

### Paso 8: Reescribir `lib/reports.ts`

**Acciones:**

- Quitar el import de `askClaude`/`hasClaudeKey` y toda la plantilla hardcodeada (líneas ~86–185 actuales).
- `generateReport(ws, periodStart, periodEnd)` pasa a: calcular `comparison`/`topPosts` igual que hoy (se sigue necesitando para el campo `data` del `Report`, que la UI actual ya consume), llamar a `generateAgentReport(ws, periodStart, periodEnd)` del Paso 7 para obtener `summary_md`, y persistir el `Report` exactamente igual que hoy.
- El tipo `Report` y el contrato de `app/api/reports/route.ts` no cambian — cero impacto en `app/reportes/page.tsx`.

**Archivos afectados:**

- `lib/reports.ts`

---

### Paso 9: Cron de reportes quincenales

Crear `app/api/cron/reports/route.ts`, calcado de `app/api/cron/sync/route.ts`.

**Acciones:**

- Mismo patrón de auth (`CRON_SECRET` en header `authorization: Bearer` o `?secret=`).
- `for (const ws of await listAccounts())`: leer el último `Report` de esa cuenta (`readFor<Report>(ws, 'reports')`, ordenado por `created_at`); si no hay ninguno o el último tiene 15+ días, generar uno nuevo con `generateReport(ws, periodStart, periodEnd)` (`periodEnd = hoy`, `periodStart = hoy - 14 días`).
- Igual que el cron de sync: una cuenta que falla no debe tumbar a las demás — capturar el error por cuenta y seguir el loop.
- Responder con el mismo shape que `cron/sync`: `{ ok, accounts, results, tookMs, at }`.
- `export const POST = GET;` al final, mismo motivo que el cron existente (algunos schedulers solo hacen POST).

**Archivos afectados:**

- `app/api/cron/reports/route.ts`

---

### Paso 10: Endpoint de chat de prueba

Crear `app/api/agent/chat/route.ts`. No es la UI final — es la superficie mínima para probar el loop de agente por curl/Postman antes de la Fase 3.

**Acciones:**

- `POST` recibe `{ thread_id?, message }`, resuelve `ws` con `requireWorkspace()`.
- Si no hay `thread_id`, crear uno nuevo en `agent_threads`.
- Cargar el historial de `agent_messages` de ese hilo, invocar `runAgentTurn` del Paso 5, persistir el turno de usuario y la respuesta en `agent_messages`.
- Responder con streaming (SSE) usando `chatCompletionStream` del Paso 1, o, si el tool-calling complica el streaming en la primera versión, responder no-streaming en esta fase y dejar el streaming real para cuando exista la UI de chat en Fase 3 — priorizar que el arnés funcione correctamente sobre que la primera versión ya sea streaming.

**Archivos afectados:**

- `app/api/agent/chat/route.ts`

---

### Paso 11: Endpoint de `success_definition`

Crear `app/api/success-definition/route.ts`.

**Acciones:**

- `GET`: `requireWorkspace()` + `getSuccessDefinition(ws)`.
- `PUT`: valida `{ metric: string }` con zod contra un enum de métricas válidas (`reach`, `saves`, `link_taps`, `followers_net`, etc. — las mismas claves que ya expone `comparison` en `lib/reports.ts`), llama `setSuccessDefinition`.

**Archivos afectados:**

- `app/api/success-definition/route.ts`

---

### Paso 12: Registrar colecciones nuevas y tipos

**Acciones:**

- En `lib/accounts.ts`, agregar a `SCOPED_COLLECTIONS`: `'agent_threads'`, `'agent_messages'`, `'agent_audit_log'`, `'agent_settings'` — así se borran junto con la cuenta si el usuario la elimina.
- En `types/index.ts`, agregar: `ConfidenceTier`, `ToolResult<T>`, `Insight`, `AgentThread { id, account_id, created_at, title? }`, `AgentMessage { id, thread_id, role, content, created_at }`, `AuditLogEntry { conversation_id, tool_called, params, n_returned, confidence_tier, claim_final, created_at }`, `SuccessDefinition { metric, configured }`.

**Archivos afectados:**

- `lib/accounts.ts`
- `types/index.ts`

---

### Paso 13: Variables de entorno y retiro de Anthropic

**Acciones:**

- En `.env.example`, agregar `OPENROUTER_API_KEY=` y `OPENROUTER_MODEL=anthropic/claude-sonnet-5`. Quitar o comentar `ANTHROPIC_API_KEY` (ya no lo usa nada).
- Borrar `lib/claude.ts`.
- En `app/api/health/route.ts`, cambiar el chequeo existente de la key de Claude (si lo hay) por `Boolean(process.env.OPENROUTER_API_KEY)`.

**Archivos afectados:**

- `.env.example`
- `lib/claude.ts` (eliminar)
- `app/api/health/route.ts`

---

### Paso 14: Validación

**Acciones:**

- `npm run build` (o el comando de type-check del proyecto) sin errores tras retirar `lib/claude.ts` y agregar los tipos nuevos.
- Con `OPENROUTER_API_KEY` configurada: generar un reporte manual desde la UI actual (`app/reportes/page.tsx` → botón "Generar reporte") y confirmar que el Markdown resultante trae las 5 secciones pedidas y, si alguna cifra tiene `n` bajo, el disclaimer de confianza aparece.
- Probar `app/api/agent/chat/route.ts` con curl: hacer una pregunta sobre métricas reales de la cuenta activa y confirmar que la respuesta cita números que sí existen en `media_posts`/`metric_snapshots` (no inventados).
- Probar `app/api/cron/reports/route.ts` con el `CRON_SECRET` local: confirmar que genera un `Report` por cada cuenta sin reporte reciente, y que una cuenta con reporte de hace <15 días queda sin tocar.
- Revisar `agent_audit_log` de la cuenta usada en la prueba: confirmar que cada tool call quedó registrada con su `n` y `confidence_tier`.

---

## Conexiones y Dependencias

### Archivos que Referencian Esta Área

- `app/api/reports/route.ts` — consume `generateReport`, sin cambios de contrato.
- `app/reportes/page.tsx` — consume `/api/reports`, sin cambios; seguirá funcionando hasta que la Fase 3 la reemplace por el rediseño ("Agente OS").
- `app/api/cron/sync/route.ts` — no se modifica, pero es el molde exacto del nuevo `app/api/cron/reports/route.ts`.
- `lib/accounts.ts` (`deleteAccount`) — ya recorre `SCOPED_COLLECTIONS` para borrar todo de una cuenta; las 4 colecciones nuevas quedan cubiertas automáticamente en cuanto se agregan a esa lista (Paso 12).

### Actualizaciones Necesarias para Consistencia

- `CLAUDE.md` — no requiere cambios estructurales todavía: esta fase no agrega comandos ni reorganiza `contexto/`/`planes/`/`salidas/`. Se revisará en la Fase 3, cuando la sección cambie de nombre en la navegación.
- `contexto/` — si existe algún doc de contexto que mencione "Reportes" como sección fija, no se toca en esta fase (el nombre visible no cambia hasta Fase 3).

### Impacto en Flujos de Trabajo Existentes

- El botón manual "Generar reporte" de la UI actual sigue funcionando exactamente igual desde la perspectiva del usuario — internamente ahora corre el agente en vez de la plantilla. Es el punto de prueba más simple para validar esta fase sin esperar a la UI nueva.
- El cron diario existente (`cron/sync`) no cambia; el nuevo cron de reportes es independiente y puede registrarse en el mismo scheduler de infraestructura (Cloudflare Cron Trigger o el que se use) apuntando a `/api/cron/reports`.

---

## Lista de Validación

- [ ] `lib/claude.ts` eliminado y `npm run build` pasa sin errores de import faltante.
- [ ] Generar un reporte manual desde `app/reportes/page.tsx` produce las 5 secciones pedidas por el usuario, con números reales (no inventados) y disclaimers de confianza donde `n` es bajo.
- [ ] `app/api/agent/chat/route.ts` responde citando datos reales de `media_posts`/`metric_snapshots` de la cuenta activa.
- [ ] `app/api/cron/reports/route.ts`, corrido dos veces seguidas, genera un reporte nuevo solo en la primera pasada (la segunda ve que el último reporte tiene <15 días y no duplica).
- [ ] `agent_audit_log` de la cuenta de prueba tiene una fila por cada tool call, con `n` y `confidence_tier`.
- [ ] Eliminar una cuenta de prueba borra también sus `agent_threads`, `agent_messages`, `agent_audit_log`, `agent_settings` (vía `SCOPED_COLLECTIONS`).
- [ ] `.env.example` documenta `OPENROUTER_API_KEY` y `OPENROUTER_MODEL`; no queda ninguna referencia activa a `ANTHROPIC_API_KEY`.

---

## Criterios de Éxito

1. El reporte quincenal de cualquier cuenta con datos se genera solo, sin acción manual, cuando el cron corre y han pasado 15+ días desde el último.
2. Ninguna cifra del reporte (ni del chat de prueba) aparece sin que una tool la haya devuelto con su `n` — verificable cruzando el Markdown final contra `agent_audit_log`.
3. El arnés (tools + loop + persistencia + auditoría) es reutilizable tal cual para Fase 2 (competencia, guiones, calendario) sin rediseño — solo se agregan tools nuevas al array `AGENT_TOOLS`.

---

## Notas

**Fase 2 (plan aparte, no cubierto aquí):** `get_competitor_signal` (señales públicas de competencia, siempre "estimado/parcial"), `get_content_voice_profile` (perfil de voz/tono para anclar generación de copy), generación de guiones/ideas ganadoras segmentados por formato (reel/carrusel/historia), tools de calendario (organizar/mover piezas), y el mecanismo de actualización de la memoria de marca a lo largo del tiempo.

**Fase 3 (plan aparte, no cubierto aquí):** wiring del rediseño de UI que ya tiene el usuario, renombrar "Reportes" → "Agente OS" en `components/layout/Sidebar.tsx`, reemplazo de `app/reportes/page.tsx` por la interfaz de chat, e ingestión de video individual (pendiente decidir el enfoque — algo como yt-dlp + ffmpeg + transcripción, a definir cuando llegue esa fase).

---

## Hallazgos de la validación (2026-08-29)

Cuatro fallos reales encontrados al correr el arnés contra datos y contra el modelo, todos corregidos:

1. **`MAX_ROUNDS = 6` era insuficiente.** El reporte necesita ~14 tool calls legítimas (4 métricas × 2 periodos + retención + breakdowns + success_definition). Se agotaban las rondas antes de redactar. Ahora son 12, y **la última ronda fuerza `submit_insights`** vía `tool_choice`, así que el agente siempre cierra con lo que ya consultó en vez de quedarse explorando.
2. **Un fallo del agente persistía un reporte de relleno.** `runLoop` devolvía un texto tipo "no llegué a una respuesta" que `generateReport` guardaba como `Report` válido. El cron lo veía como reporte reciente y **no reintentaba en 15 días**: un fallo transitorio envenenaba dos semanas. Ahora lanza `AgentIncompleteError` y no se persiste nada — el cron reporta el error y reintenta en la siguiente corrida.
3. **Las tools no validaban sus argumentos.** Un `range` malformado por el modelo no coincidía con ninguna fecha y devolvía `value: 0, n: 0` — una cifra inventada con apariencia de dato real, exactamente lo que la Capa 1 debe impedir. Se observó en vivo: el modelo redactó "el alcance se mantuvo estable en 0". Ahora `runTool` valida con zod y devuelve un error accionable que el modelo corrige en la siguiente ronda.
4. **`maxTokens: 3000` truncaba el `submit_insights` final.** El Markdown de 5 secciones viaja dentro de los argumentos de la tool; el JSON llegaba cortado y no parseaba. Subido a 8000, con reintento explícito ("recorta la prosa") si aun así falla y quedan rondas.

Mejora adicional: `get_post_breakdown` devolvía cada `MediaPost` entero (incluida la `retention_curve` completa) — mucho contexto y coste por nada. Ahora devuelve una proyección compacta de las 10 mejores por defecto, distinguiendo `n` (total que respalda el `confidence_tier`) de `returned` (cuántas se muestran).

**Verificado:** `tsc` limpio; `get_metrics` devuelve `118650` con `n=4 → insuficiente`, que coincide con la suma cruda de `metric_snapshots`; los 4 casos de argumentos malformados se rechazan; el cron exige `CRON_SECRET` (401 sin él), salta cuentas con reporte de <15 días y reintenta las que tienen uno viejo; `success_definition` declara `configured: false` con default `reach`, persiste y rechaza métricas inválidas; el agente encadenó 14 tool calls correctas cubriendo las 5 secciones.

**Pendiente de verificar:** el Markdown final del reporte con sus 5 secciones y los disclaimers de confianza. Bloqueado por saldo de OpenRouter ($10 de crédito agotados), no por código.

---

**Sobre el router de intención descartado (Decisión #2):** si en el uso real se nota que el agente mezcla registro (respuestas de métricas con tono especulativo, o copy que suena a reporte), es la señal concreta de que hay que reintroducir el router del documento original. No es una decisión cerrada para siempre, es la apuesta más simple para empezar.
