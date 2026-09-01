# Plan: Agente OS — Fase 4 (estructura de calendario declarada y planificación en bloque)

**Creado:** 2026-09-01
**Estado:** implementado (2026-09-01) — ver "Resultado de la validación" al final
**Pedido:** Que el usuario le declare al agente la estructura de su calendario de contenido (cadencia, formatos, funnel, horarios, tono), que el agente use eso como criterio al conversar, y que pueda ejecutar el plan agendando las piezas en el calendario.

**Depende de:** `2026-08-29-agente-os-fase1-arnes.md`, `2026-08-29-agente-os-fase2-competencia-voz-calendario.md`, `2026-08-29-agente-os-fase3-interfaz-chat.md`

---

## Descripción General

### Qué Logra Este Plan

El agente pasa de "sabe qué te funcionó" a "sabe cómo quieres operar". El usuario declara su estructura de calendario en un formulario (piezas por semana y por formato, mezcla TOFU/MOFU/BOFU, días y horas preferidos, pilares de contenido, reglas de copy), y esa estructura se convierte en un dato que el agente consulta como cualquier otra tool. Con eso más los datos de rendimiento que ya tiene, conversando puede evaluar la frecuencia, proponer qué piezas y en qué formato, y **ejecutar**: arma un plan completo del periodo que el usuario aprueba de un clic y aterriza como piezas reales en `/calendario`.

Para el caso de quien todavía no tiene estructura, se añade un **playbook de arquetipos de calendario** versionado en el repo, que le da al agente criterio para recomendar una estructura de partida sin inventársela.

### Por Qué Importa

Hoy el agente puede agendar una pieza a la vez (`schedule_calendar_item`, Fase 2), pero no tiene ninguna noción de **cuánto** publicar, **de qué** ni **cuándo**: solo ve el pasado medido. Eso lo deja opinando sobre piezas sueltas en vez de operar un calendario. La tesis del producto es "lo que no se puede medir no se puede mejorar"; la estructura declarada es la otra mitad — sin un objetivo explícito, no hay nada contra qué medir la operación, solo contra qué medir el rendimiento.

---

## Estado Actual

### Estructura Existente Relevante

- `lib/agent/success-definition.ts` — patrón `readSingletonFor`/`writeSingletonFor` sobre la clave `agent_settings`, con `configured: boolean` para distinguir "el usuario lo eligió" de "estoy usando un default". Es el molde exacto de la estrategia de contenido.
- `lib/agent/brand-memory.ts` — memoria con procedencia + `brandMemoryPromptBlock()` que se inyecta en el system prompt. Molde del bloque de estrategia en el prompt.
- `lib/agent/write-tools.ts` — `saveScriptDraft`, `listCalendar`, `scheduleCalendarItem`, `moveCalendarItem`. Ya escriben en el calendario interno, con estado `idea`.
- `lib/agent/tools.ts` — `AGENT_TOOLS` + validación zod por tool + `runTool`. Las tools nuevas se enchufan aquí.
- `lib/agent/loop.ts` — system prompt único, Capa 2 (`submit_insights`) y `AgentEvent` para el streaming.
- `lib/maintenance.ts` — `filterExpired`: las piezas se borran solas 24 h después de su fecha. Un plan a futuro no se ve afectado; uno con fechas pasadas se evaporaría.
- `app/api/calendar/route.ts` + `app/calendario/page.tsx` — CRUD y vista del calendario editorial.
- `app/api/success-definition/route.ts` — ruta de configuración por cuenta con `requireWorkspace()`. Molde de la ruta de estrategia.
- `types/index.ts` — `CalendarItem`, `CalendarFormat`, `FunnelLevel`, `ConfidenceTier`.
- `lib/accounts.ts` — `SCOPED_COLLECTIONS`: toda colección nueva se registra ahí o queda huérfana al borrar la cuenta.

### Brechas o Problemas que se Abordan

1. **No existe el concepto de estructura declarada.** El agente solo conoce el pasado medido (`get_format_performance`, `get_content_voice_profile`). No puede decir "te faltan 2 reels esta semana" porque no sabe cuántos debería haber.
2. **No hay criterio para recomendar una estructura desde cero.** Si el usuario pregunta "¿cada cuánto debería publicar?", hoy el agente contesta con sentido común genérico de LLM, sin nada auditable detrás.
3. **Agendar es pieza por pieza.** Armar dos semanas serían ~12 tool calls consecutivas, que consumen rondas del loop (`MAX_ROUNDS = 12`) y pueden fallar a la mitad dejando medio calendario escrito.
4. **No hay confirmación real.** Hoy `schedule_calendar_item` escribe en cuanto el modelo decide que el usuario dijo que sí. Para una pieza suelta es tolerable; para 12 de golpe, no.
5. **No hay UI de ajustes del agente.** `success_definition` y `brand_memory` solo existen por API — y el mensaje de error de `brand-memory.ts` ya le dice al usuario "bórralo desde Ajustes del agente", una pantalla que no existe.
6. **Las horas no tienen zona horaria.** `scheduledAtSchema` ancla una fecha suelta a las 12:00 UTC. Para "martes 18:00" hace falta saber en qué huso vive el usuario, o el agente programa a horas equivocadas.

---

## Cambios Propuestos

### Resumen de Cambios

- Nuevo modelo `ContentStrategy` por cuenta: cadencia semanal por formato, mezcla de funnel, franjas horarias preferidas con zona horaria, pilares de contenido y reglas de copy. Persistido en `agent_settings`, con `configured: boolean`.
- Formulario de configuración en una pantalla nueva **Estrategia** (`/estrategia`), que además concentra la métrica de éxito y la memoria de marca — las dos configuraciones del agente que hoy no tienen UI.
- Playbook de arquetipos de calendario versionado en el repo (`lib/agent/calendar-playbooks.ts`), servido por tool y marcado siempre como heurística declarada, nunca como dato medido de la cuenta.
- Cobertura calculada en código: `get_calendar_coverage` compara lo declarado contra lo realmente programado en un rango y devuelve los huecos.
- Planificación en bloque: `draft_calendar_plan` guarda un plan **propuesto** (no toca el calendario), validado en código contra la estrategia; la UI lo muestra como tarjeta con "Aplicar" / "Descartar"; aplicar crea las piezas reales y se puede deshacer.
- Reglas nuevas en el system prompt + bloque compacto de estrategia inyectado como ya se hace con la memoria de marca.

### Nuevos Archivos a Crear

| Ruta del Archivo | Propósito |
| --- | --- |
| `lib/agent/content-strategy.ts` | Lectura/escritura de la estrategia, normalización, defaults declarados y `contentStrategyPromptBlock()`. |
| `lib/agent/calendar-playbooks.ts` | Arquetipos de calendario (cadencia, mezcla de funnel, pilares típicos) versionados en el repo, con su fuente y sus límites. |
| `lib/agent/calendar-plan.ts` | Almacén de planes propuestos, validación de items contra la estrategia, cálculo de cobertura, aplicación y deshacer. |
| `lib/timezone.ts` | Conversión "día + hora local + IANA" → ISO UTC, sin dependencias nuevas (Intl). |
| `app/api/content-strategy/route.ts` | GET/PUT de la estrategia de la cuenta activa. |
| `app/api/calendar/plans/route.ts` | GET de planes (propuestos y aplicados) de la cuenta activa. |
| `app/api/calendar/plans/[id]/route.ts` | POST aplica el plan al calendario; DELETE lo descarta o deshace su aplicación. |
| `app/estrategia/page.tsx` | Pantalla "Estrategia": formulario de calendario + métrica de éxito + memoria de marca. |
| `components/estrategia/StrategyForm.tsx` | Formulario estructurado de la estrategia de calendario. |
| `components/agente/PlanCard.tsx` | Tarjeta de plan propuesto en el chat, con aplicar/descartar y avisos de desvío. |

### Archivos a Modificar

| Ruta del Archivo | Cambios |
| --- | --- |
| `types/index.ts` | `ContentStrategy`, `StrategySlot`, `ContentPillar`, `CopyRules`, `CalendarPlan`, `CalendarPlanItem`, `CalendarCoverage`; `CalendarItem` gana `plan_id?` y `pillar?` (opcionales, sin migración). |
| `lib/accounts.ts` | `SCOPED_COLLECTIONS += 'calendar_plans'`. |
| `lib/agent/tools.ts` | Nuevas tools: `get_content_strategy`, `get_calendar_playbooks`, `get_calendar_coverage`, `draft_calendar_plan`. Esquemas zod + dispatcher. |
| `lib/agent/write-tools.ts` | `scheduleCalendarItem` acepta `pillar` y `plan_id`. |
| `lib/agent/loop.ts` | Reglas de estrategia/planificación en el prompt + inyección del bloque de estrategia. |
| `components/agente/Chat.tsx` | Tras cada respuesta, buscar planes propuestos y renderizar `PlanCard`. |
| `components/layout/Sidebar.tsx` | Entrada "Estrategia". |
| `app/calendario/page.tsx` | Mostrar el pilar de la pieza si lo trae, y una barra de cobertura vs. lo declarado. |
| `CLAUDE.md`, `README.md` | Documentar la pantalla y el flujo de planificación. |

### Archivos a Eliminar (si aplica)

Ninguno.

---

## Decisiones de Diseño

### Decisiones Clave Tomadas

1. **Lo declarado y lo medido son dos clases de dato distintas, y el código lo marca.** `get_content_strategy` devuelve `kind: 'declarado'` y nunca `confidence_tier`. Es lo que el usuario **quiere** hacer, no evidencia de que funcione. El prompt prohíbe explícitamente usar la estrategia como respaldo de una afirmación de rendimiento. Es la misma disciplina que separa `zernio` (medido) de `competitor_signal` (estimado), aplicada a una tercera categoría.

2. **El playbook vive en el repo, no en un vector store.** El pedido decía "indexar a la base de conocimiento". Un pipeline de embeddings (chunking, vectores, recuperación) es infraestructura nueva entera para un corpus que hoy son ~8 arquetipos que caben en un archivo TypeScript, y que además haría **no auditable** de dónde salió cada recomendación. Un módulo versionado se lee, se corrige en un PR y viaja entero al contexto cuando hace falta. Si algún día el corpus crece a documentos largos del usuario, ese es el momento de reevaluar — está anotado como pregunta abierta.

3. **El plan se propone en una sola tool call y se aplica desde la UI, no desde el modelo.** `draft_calendar_plan` escribe en `calendar_plans`, jamás en `calendar_items`. La aplicación es `POST /api/calendar/plans/[id]` disparado por un botón. Motivo doble: (a) confirmar en bloque tiene que ser un acto del usuario, no la interpretación del modelo de que dijo que sí; (b) 12 piezas en 12 tool calls consumen las rondas del loop y pueden fallar a la mitad dejando medio calendario escrito, que es peor que no escribir nada.

4. **La validación del plan la hace el código y devuelve desvíos, no errores.** Fechas fuera de rango, en el pasado o con dos piezas en la misma franja se rechazan con un mensaje que el modelo puede corregir. Pero publicar 5 reels en una semana cuando la estrategia dice 3 **no es un error**: es una semana de lanzamiento. Se devuelve como `deviations[]`, se muestra en la tarjeta, y decide el usuario. Un validador que impone la cadencia convertiría la estrategia en una jaula.

5. **La estrategia se edita solo desde el formulario; el agente la lee, no la escribe.** El agente puede recomendar cambiarla y decirlo en su respuesta, pero no hay `update_content_strategy`. La estrategia es la configuración que gobierna la escritura en bloque: si el propio agente pudiera reescribirla, el criterio contra el que se validan sus planes sería suyo, no del usuario. `brand_memory` sí se escribe desde el chat porque son preferencias sueltas y auditables una a una; esto es distinto.

6. **La zona horaria es un campo de la estrategia, y la conversión ocurre en código.** El modelo entrega `date` (YYYY-MM-DD) y opcionalmente `slot` (índice de franja) o `time` (HH:MM local); `lib/timezone.ts` produce el ISO en UTC. Pedirle al modelo que calcule offsets es pedirle que se equivoque en octubre, cuando cambie el horario de verano en algún lado.

7. **Aplicar un plan es reversible.** Cada `CalendarItem` creado guarda `plan_id`; `DELETE /api/calendar/plans/[id]` borra exactamente esas piezas. Una escritura de 12 elementos sin deshacer obliga a limpiar a mano, y la primera vez que pase el usuario deja de confiar en el botón.

### Alternativas Consideradas

- **RAG con embeddings sobre documentos de estrategia**: rechazado por Decisión #2 (infraestructura desproporcionada y procedencia no auditable para un corpus que hoy es minúsculo).
- **Notas en texto libre en vez de formulario**: rechazado por el usuario en la conversación de arranque, y coincide con el diseño: la cadencia es cuantificable y `get_calendar_coverage` necesita números, no prosa que el modelo reinterprete cada turno.
- **Que el agente agende directo cada pieza según las decide**: rechazado por Decisión #3 (rondas del loop + escrituras parciales + confirmación inferida por el modelo).
- **Confirmar pieza por pieza**: descartado por el usuario; además convierte un plan de dos semanas en 12 turnos de chat.
- **Guardar la estrategia como más entradas de `brand_memory`**: rechazado — la memoria entra entera en cada system prompt y es texto; la estrategia necesita estructura para poder calcular cobertura y validar planes.

### Preguntas Abiertas (si las hay)

1. **¿Debe el agente poder proponer cambios a la estrategia con un botón "Aplicar" (como los planes)?** Hoy solo puede recomendarlo en prosa. Se puede añadir después con el mismo mecanismo de propuesta+confirmación, sin rediseñar nada.
2. **¿Se archiva o se borra un plan aplicado?** Se propone conservarlo (`status: 'aplicado'`) como historial de qué se planeó y cuándo, con tope de 20 planes por cuenta.
3. **¿Cobertura por semana natural o por ventana móvil de 7 días?** Se implementa por semana natural (lunes-domingo) porque es como la gente lee un calendario; queda anotado si resulta rígido.

---

## Tareas Paso a Paso

### Paso 1: Tipos del dominio

**Acciones:**

- Añadir a `types/index.ts`: `StrategySlot { weekday: 0-6; time: 'HH:MM' }`, `ContentPillar { name; description; share_pct }`, `CopyRules { tone; cta_style; caption_length; avoid[] }`, `ContentStrategy { configured; timezone; weekly_targets; funnel_mix; slots; pillars; copy_rules; notes; updated_at }`, `CalendarPlanItem`, `CalendarPlan { id; account_id; status: 'propuesto'|'aplicado'|'descartado'; range; items; deviations; created_at; applied_at }`, `CalendarCoverage`.
- Añadir a `CalendarItem` los campos opcionales `plan_id?: string | null` y `pillar?: string | null`, documentando que son opcionales para no migrar datos existentes.

**Archivos afectados:** `types/index.ts`

---

### Paso 2: Zona horaria

**Acciones:**

- Crear `lib/timezone.ts` con `localToIso(date, time, timeZone)` usando `Intl.DateTimeFormat` con `timeZone` para calcular el offset real de esa fecha (respeta horario de verano), y `isoToLocalParts(iso, timeZone)` para la vuelta.
- Validar que la zona sea una IANA soportada; si no, lanzar nombrando el valor recibido.

**Archivos afectados:** `lib/timezone.ts`

---

### Paso 3: Estrategia de contenido

**Acciones:**

- Crear `lib/agent/content-strategy.ts`: `getContentStrategy(ws)` (default declarado con `configured: false`), `setContentStrategy(ws, input)` con normalización (funnel_mix se normaliza a 100, franjas ordenadas y deduplicadas, tope de 14 franjas y 8 pilares), y `contentStrategyPromptBlock(ws)` que devuelve un bloque compacto (cadencia + mezcla + franjas + pilares + reglas de copy) o cadena vacía si no está configurada.
- Persistir dentro de `agent_settings` bajo la clave `content_strategy`, igual que `success_definition`.

**Archivos afectados:** `lib/agent/content-strategy.ts`

---

### Paso 4: Playbook de arquetipos

**Acciones:**

- Crear `lib/agent/calendar-playbooks.ts` con arquetipos (educativo B2B, creador personal, e-commerce/producto, servicios locales, autoridad/thought leadership, lanzamiento), cada uno con cadencia semanal por formato, mezcla de funnel, pilares sugeridos, franjas típicas y "cuándo aplica / cuándo no".
- Cada arquetipo lleva `source: 'playbook'` y el módulo exporta un `caveat` fijo: son heurísticas declaradas, no rendimiento medido de esta cuenta.

**Archivos afectados:** `lib/agent/calendar-playbooks.ts`

---

### Paso 5: Planes de calendario

**Acciones:**

- Crear `lib/agent/calendar-plan.ts`:
  - `draftCalendarPlan(ws, args)` — resuelve fechas/franjas a ISO, valida (rango, pasado, colisión de franja, tope de 60 items), calcula `deviations` contra la estrategia (cadencia por formato y semana, mezcla de funnel, pilares fuera de lista), guarda como `propuesto` y devuelve el resumen.
  - `listPlans(ws, status?)`, `getPlan(ws, id)`.
  - `applyPlan(ws, id)` — crea los `CalendarItem` con `status: 'idea'` y `plan_id`, marca el plan `aplicado`.
  - `discardPlan(ws, id)` / `undoPlan(ws, id)` — descarta un propuesto, o borra las piezas de uno aplicado y lo revierte.
  - `getCalendarCoverage(ws, range)` — por semana natural: piezas programadas por formato y funnel vs. objetivo declarado, con los huecos.
- Registrar `calendar_plans` en `SCOPED_COLLECTIONS`.

**Archivos afectados:** `lib/agent/calendar-plan.ts`, `lib/accounts.ts`

---

### Paso 6: Tools del agente

**Acciones:**

- `lib/agent/tools.ts`: añadir `get_content_strategy`, `get_calendar_playbooks`, `get_calendar_coverage`, `draft_calendar_plan` a `AGENT_TOOLS`, con descripciones que dejen explícito qué es declarado y qué es medido, y que `draft_calendar_plan` **no** escribe en el calendario.
- Esquemas zod para cada una y ramas en `runTool`.
- `lib/agent/write-tools.ts`: `scheduleCalendarItem` acepta `pillar` y `plan_id`.

**Archivos afectados:** `lib/agent/tools.ts`, `lib/agent/write-tools.ts`

---

### Paso 7: Reglas del prompt

**Acciones:**

- En `agentSystemPrompt` (`lib/agent/loop.ts`): inyectar el bloque de estrategia; añadir reglas — consultar la estrategia antes de opinar sobre frecuencia/formato; no usarla como evidencia de rendimiento; usar el playbook solo si no hay estrategia configurada y decir que es heurística; usar `draft_calendar_plan` (no N `schedule_calendar_item`) para planificar un periodo, y avisar de que queda pendiente de aprobación.

**Archivos afectados:** `lib/agent/loop.ts`

---

### Paso 8: Endpoints

**Acciones:**

- `app/api/content-strategy/route.ts` — GET/PUT con `requireWorkspace()` y validación zod.
- `app/api/calendar/plans/route.ts` — GET con filtro opcional por estado.
- `app/api/calendar/plans/[id]/route.ts` — POST aplica, DELETE descarta/deshace.

**Archivos afectados:** las tres rutas nuevas

---

### Paso 9: UI de estrategia

**Acciones:**

- `components/estrategia/StrategyForm.tsx` — formulario con contadores por formato, sliders/inputs de mezcla de funnel que suman 100, editor de franjas (día + hora), selector de zona horaria, pilares y reglas de copy.
- `app/estrategia/page.tsx` — el formulario + métrica de éxito (`/api/success-definition`) + memoria de marca (`/api/brand-memory`, con borrado por entrada).
- `components/layout/Sidebar.tsx` — entrada "Estrategia".

**Archivos afectados:** los tres

---

### Paso 10: Plan en el chat

**Acciones:**

- `components/agente/PlanCard.tsx` — resumen por semana, lista de piezas, desvíos, botones Aplicar/Descartar y, tras aplicar, Deshacer.
- `components/agente/Chat.tsx` — al terminar el turno, consultar planes `propuesto` y renderizar la tarjeta bajo la respuesta.

**Archivos afectados:** ambos

---

### Paso 11: Calendario con cobertura

**Acciones:**

- `app/calendario/page.tsx` — mostrar el pilar en la pieza cuando exista y una franja de cobertura semanal (programado vs. declarado) leída de `/api/calendar/plans` + estrategia.

**Archivos afectados:** `app/calendario/page.tsx`

---

### Paso 12: Validación

**Acciones:**

- `npx tsc --noEmit` y `npm run build` limpios.
- Prueba directa de `runTool` (sin gastar créditos) para: estrategia sin configurar, plan con fecha pasada, plan con dos piezas en la misma franja, plan por encima de la cadencia (debe devolver desvío, no error), cobertura con huecos.
- Aplicar un plan y comprobar que las piezas aparecen en `/calendario`; deshacer y comprobar que desaparecen exactamente esas.

---

## Conexiones y Dependencias

### Archivos que Referencian Esta Área

- `lib/agent/loop.ts` (prompt), `lib/agent/tools.ts` (registro), `lib/agent/report.ts` (podría citar cobertura en el reporte quincenal — fuera de alcance aquí).
- `app/calendario/page.tsx` y `app/api/calendar/*` (las piezas que produce el plan).
- `lib/maintenance.ts` — la purga de 24 h aplica igual a las piezas creadas por un plan.

### Actualizaciones Necesarias para Consistencia

- `CLAUDE.md` y `README.md`: pantalla Estrategia y flujo de planificación en bloque.
- `CONTENTOS_AGENTE_ARNES.md`: §2 dice que el agente no ejecuta escritura; ya quedó superado por la Fase 2 para escrituras internas. Añadir una nota fechada que lo aclare en vez de dejar el documento contradiciendo al código.

### Impacto en Flujos de Trabajo Existentes

- `schedule_calendar_item` sigue existiendo para piezas sueltas; no se toca su comportamiento.
- El agente gana 4 tools (17 en total). El loop no cambia estructuralmente.

---

## Lista de Validación

- [ ] `npx tsc --noEmit` y `npm run build` limpios.
- [ ] La estrategia se guarda desde `/estrategia` y sobrevive a recargar.
- [ ] Sin estrategia configurada, el agente lo dice y ofrece un arquetipo del playbook marcándolo como heurística.
- [ ] `draft_calendar_plan` no crea ninguna pieza en `/calendario` hasta pulsar Aplicar.
- [ ] Un plan que excede la cadencia declarada se acepta y muestra el desvío.
- [ ] Un plan con fecha pasada o franja duplicada se rechaza con un mensaje corregible por el modelo.
- [ ] Aplicar crea las piezas con `plan_id`; Deshacer borra exactamente esas.
- [ ] `get_calendar_coverage` reporta huecos por semana natural y por formato.
- [ ] `CLAUDE.md` actualizado.

---

## Criterios de Éxito

1. El usuario declara su estructura en `/estrategia` y el agente la usa en la conversación siguiente sin que haya que recordársela.
2. Preguntándole en lenguaje natural "¿cómo debería quedar mi calendario de las próximas dos semanas?", el agente responde con una propuesta concreta y deja un plan aplicable de un clic.
3. Aplicar el plan crea las piezas reales en `/calendario`, y deshacerlo las quita.
4. El agente nunca presenta la estrategia declarada como evidencia de rendimiento.
5. Sin estrategia configurada el agente sigue siendo útil: recomienda desde el playbook y dice explícitamente que es una heurística, no una medición de esta cuenta.

---

## Resultado de la validación (2026-09-01)

`npx tsc --noEmit` y `npm run build` limpios, con `/estrategia`,
`/api/content-strategy`, `/api/calendar/plans` y `/api/calendar/plans/[id]`
compilados. 22 comprobaciones directas contra `runTool` y los módulos, sin
gastar créditos de modelo:

- **Zona horaria**: ida y vuelta conserva la hora local; Madrid da +2 en julio y
  +1 en enero (el offset se calcula por fecha, no fijo); `weekStart` cae en lunes.
- **Estrategia**: sin configurar devuelve `configured: false`; la tool marca
  `kind: 'declarado'` y **no** trae `confidence_tier`; una mezcla de funnel que
  suma 110 se normaliza a 100; las franjas duplicadas se deduplican.
- **Playbook**: 6 arquetipos, todos con su `not_for`.
- **Rechazos duros verificados** (con el mensaje que el modelo puede corregir):
  fecha en el pasado —comparada contra hoy **en la zona del usuario**, no en
  UTC—, fecha fuera del rango del plan, y dos piezas en la misma franja.
- **Criterio #4**: 4 reels en una semana con cadencia declarada de 3 se acepta y
  se reporta como desvío (`Semana del …: 4 reels frente a 3 declarados`), igual
  que un pilar que no está en la estrategia.
- **Criterio #3**: `draft_calendar_plan` dejó el calendario en 0 piezas;
  aplicar creó las 5 con `plan_id` y `status: 'idea'`, conservando el pilar.
- **Deshacer**: con una pieza creada a mano conviviendo con las del plan,
  deshacer borró **solo las 5 del plan** y dejó intacta la manual.
- **Cobertura**: `{format: reel, scheduled: 1, target: 3, gap: 2}` y las semanas
  vacías del rango también aparecen.
- **Registro**: 17 tools en total, con las 4 nuevas presentes.

## Notas

La Fase 5 (`2026-09-01-agente-os-fase5-notificaciones-push.md`) se apoya en esto: los recordatorios de calendario notifican piezas que en buena parte nacerán de estos planes. Son independientes — cada una se puede implementar sin la otra — pero el valor conjunto es el bucle completo: planificar, agendar, y que el teléfono avise.
