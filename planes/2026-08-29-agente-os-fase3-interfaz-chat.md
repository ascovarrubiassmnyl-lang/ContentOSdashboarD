# Fase 3 — Agente OS: interfaz de chat, streaming y video por link

**Estado:** implementado (2026-08-29)
**Depende de:** `2026-08-29-agente-os-fase1-arnes.md`, `2026-08-29-agente-os-fase2-competencia-voz-calendario.md`

---

## Contexto

Fase 1 dejó el arnés (loop, tools, contrato de confianza en 3 capas). Fase 2 le
dio competencia, perfil de voz, memoria de marca y escritura. Lo único que
faltaba era **una forma humana de hablar con él**: hasta ahora el único acceso
era `POST /api/agent/chat` por curl.

Fase 3 cierra eso. Tres piezas:

1. La sección **Reportes** se convierte en **Agente OS**: un chat como
   superficie principal, con los reportes como panel lateral.
2. **Streaming** de lo que el agente está haciendo mientras lo hace.
3. **Ingesta de un video individual** a partir de un link pegado en el chat,
   vía Apify — que además desbloquea el scraping de competencia, hoy roto.

El diseño de la interfaz lo trajo el usuario (referencia externa). Se adopta su
**estructura** y se descarta su **piel**: nada de imagen de fondo externa ni de
paleta neutra: Content OS ya tiene marca (`primary #7C7CF5`, `bg #0A0A12`,
`card #12121C`, radio de 16 px) y la sección nueva tiene que parecer parte de la
misma app, no un widget pegado.

---

## Decisiones

### #1 — El chat vive en `/agente`, y `/reportes` desaparece

El nombre de la ruta es parte del producto: `Agente OS` en una URL `/reportes`
envejece mal en cuanto el agente hace más cosas que reportes (y ya las hace:
guiones, calendario, competencia).

`app/reportes/` se elimina. Los enlaces de `/resumen` apuntan a
`/agente?panel=reportes`.

**Descartado:** dejar `/reportes` vivo y añadir `/agente` aparte. Serían dos
puertas a la misma IA con estados distintos, y la duplicación se paga siempre.

### #2 — Los reportes NO se pierden: pasan a un panel lateral

El historial de reportes con export a PDF es una función terminada y usada. La
tentación al rediseñar era declararla "sustituida por el chat", pero el chat no
exporta PDF ni guarda un histórico navegable por periodo.

Se extrae tal cual a `components/agente/ReportsPanel.tsx` y se abre desde el
encabezado del chat. Cero cambios funcionales: mismo `MarkdownView`, mismo
`mdToPrintHtml`, mismo iframe de impresión.

### #3 — El streaming es de PROGRESO, no de tokens

Tentación obvia: hacer que el texto aparezca letra a letra como en ChatGPT.
**No se puede sin romper la Capa 2 del contrato.** La respuesta final del
agente no es texto libre: viaja dentro de los argumentos de `submit_insights`,
y el disclaimer de confianza lo añade el código *después* de parsear ese JSON.
Emitir tokens según llegan significaría enseñar prosa antes de saber si lleva
disclaimer — exactamente el agujero que la Capa 2 existe para tapar.

Así que se transmite lo que sí es real y sí es útil: **qué tool está
consultando el agente en cada ronda**. El usuario ve `get_metrics →
get_format_performance → get_content_voice_profile` en vivo, y luego la
respuesta completa de golpe. Es más honesto y, de hecho, más informativo: deja
ver el trabajo de grounding que justifica cada cifra.

Implementación: `runAgentTurn` acepta un `onEvent` opcional. La ruta de chat
responde SSE cuando el cuerpo trae `stream: true`, y JSON plano si no — así el
endpoint de prueba por curl de Fase 1 sigue funcionando igual.

### #4 — Apify como proveedor, detrás de las interfaces que ya existen

Fase 2 dejó `CompetitorProvider` como interfaz precisamente para este momento:
`instagram-public` se confirmó bloqueado (HTTP 400 contra un perfil real).

Se añade `lib/competitors/apify.ts` y basta `COMPETITOR_PROVIDER=apify` para
desbloquear el cron de competencia. Ni el almacén, ni el cron, ni la tool del
agente, ni la UI se tocan.

Para el video individual se crea la interfaz hermana `VideoProvider`
(`lib/videos/`) con el mismo contrato duro: **si no se puede leer, lanza**.
Nunca ceros. Fase 1 ya enseñó a dónde lleva un dato vacío con pinta de real.

### #5 — Un video ajeno es una observación, nunca una métrica

`analyze_video_url` devuelve siempre `n: 1`, `confidence_tier: 'insuficiente'`
y `reliability: 'estimado'`, con un `caveat` explícito. Un solo video visto
desde fuera no es evidencia de nada: los likes son públicos, el alcance no, y
no se sabe si llevaba pauta.

El agente puede describirlo y compararlo con la voz de la cuenta. No puede
decir "esto funciona, cópialo".

### #6 — Solo Instagram, y se dice

El actor de Apify que se usa lee Instagram. Un link de TikTok o YouTube se
rechaza con un error que nombra el dominio recibido, en vez de intentarlo y
devolver basura.

---

## Pasos

1. `lib/videos/types.ts` — `VideoObservation` + `VideoProvider`.
2. `lib/videos/apify.ts` — actor de Instagram vía `run-sync-get-dataset-items`.
3. `lib/videos/index.ts` — registro de proveedores + `activeVideoProvider()`.
4. `lib/competitors/apify.ts` — `CompetitorProvider` sobre el mismo token.
5. `lib/competitors/refresh.ts` — registrar `apify` en `PROVIDERS`.
6. `lib/agent/tools.ts` — tool `analyze_video_url` + schema + dispatcher.
7. `lib/agent/loop.ts` — `onEvent` opcional; emitir `tool` / `answer`.
8. `app/api/agent/chat/route.ts` — modo SSE con `stream: true`.
9. `components/agente/ReportsPanel.tsx` — extraer el visor de reportes.
10. `components/agente/Chat.tsx` — la interfaz nueva.
11. `app/agente/page.tsx` — montaje; borrar `app/reportes/`.
12. `components/layout/Sidebar.tsx` — "Reportes" → "Agente OS".
13. `app/resumen/page.tsx` — reapuntar enlaces.
14. `.env.example`, `DEPLOY.md`, `README.md`, `CLAUDE.md`.

---

## Criterios de éxito

1. El chat responde en `/agente` y muestra en vivo las tools que consulta.
2. Los reportes siguen siendo navegables y exportables a PDF desde el panel.
3. Sin `APIFY_TOKEN`, `analyze_video_url` falla con un mensaje que dice qué
   falta — no devuelve ceros.
4. Un link que no sea de Instagram se rechaza nombrando el dominio.
5. `COMPETITOR_PROVIDER=apify` refresca competencia sin tocar nada más.
6. El endpoint de chat sin `stream: true` sigue devolviendo el JSON de Fase 1.

---

## Resultado de la validación (2026-08-29)

`npx tsc --noEmit` limpio y `npm run build` limpio, con `/agente`,
`/api/agent/chat` y `/api/agent/threads` compilados.

**Criterios 3, 4 y 5** — verificados con un script directo contra `runTool` y
los registros de proveedores, sin gastar créditos de modelo:

- Normalización de links: `/reel/`, `/p/`, `/tv/` y `/reels/` se canonizan
  bien; los parámetros de tracking (`?igsh=…`) se descartan.
- Rechazados con el motivo correcto: TikTok, YouTube, un link de perfil (no de
  publicación) y texto suelto.
- Sin `APIFY_TOKEN`, `analyze_video_url` lanza nombrando la variable que falta
  y dónde crearla. No devuelve ceros.
- `COMPETITOR_PROVIDER` acepta `instagram-public` y `apify`, y con un valor
  inexistente lanza listando los disponibles.
- `analyze_video_url` aparece en `AGENT_TOOLS` (13 tools en total).

**Criterios 1, 2 y 6** — verificados contra el servidor real:

- SSE bien formado: `thread` → `thinking` → `tool_start` → `tool_end` →
  `answer`, cada uno en su frame.
- Con un link pegado, el agente eligió `analyze_video_url` solo, el `tool_end`
  transmitió el error real, y **la respuesta dijo que no pudo ver el video y
  por qué** en vez de describir un reel inventado. `insights: []`.
- Sin `stream`, el endpoint sigue devolviendo el JSON de Fase 1 intacto.
- Historial: abre, lista por actividad y borra hilo + mensajes juntos.

**Hallazgo, ya corregido:** en la primera versión el turno se persistía aunque
el agente fallara, dejando hilos con la pregunta del usuario y ninguna
respuesta. Ahora se persiste el turno completo solo cuando cierra bien, y el
listado omite los hilos huérfanos. Comprobado con un fallo real (402 de
OpenRouter): el hilo se creó, no se guardó ningún mensaje, y el historial salió
vacío.

**Lectura real con Apify — verificada (2026-08-29, token ya configurado):**

- Competencia sobre un perfil público real: 8 s, `followers`, `posts_count`,
  `avg_likes`, `avg_comments` y `sample_size: 12` con valores coherentes.
- Video individual sobre un post real de ese mismo perfil, con parámetros de
  tracking pegados al link: 5,5 s, devuelve autor, caption, fecha, tipo,
  duración, likes, comentarios y reproducciones. Los nombres de campo del actor
  (`likesCount`, `followersCount`, `latestPosts`, `videoPlayCount`…) coinciden
  con los candidatos que lee el código.
- Coste medido: **~0.003 USD por lectura**. El plan gratuito trae 5 USD/mes, así
  que el cron diario con 10 competidores (~300 lecturas) cabe de sobra.
