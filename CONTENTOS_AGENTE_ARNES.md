# ContentOS — Arnés del Agente de IA

Documento de contexto técnico para construir el arnés del agente. Este documento no es un pitch de producto: es una especificación de decisiones ya tomadas, contratos técnicos a implementar, y preguntas abiertas que deben resolverse antes o durante la construcción.

---

## 1. Qué es ContentOS

SaaS en v1, uso interno (fundador + socio), eventualmente clientes de marketing. Enfoque: IG y FB. Tesis del producto: **"lo que no se puede medir no se puede mejorar."** El sistema permite al creador de contenido visualizar sus métricas más relevantes, identificar qué le funciona y qué no, y ver señales de su competencia.

Dentro de ContentOS hay un **agente de IA** ("Jarvis de contenido, marca personal y ventas") que analiza datos y genera output. Este documento se enfoca exclusivamente en el arnés de ese agente.

## 2. Alcance del agente en v1 (decisión ya tomada — no expandir sin discutirlo)

> **Nota (2026-09-01):** esta sección se escribió antes de la Fase 2 y quedó parcialmente
> superada, con acuerdo explícito del usuario. El agente **sí escribe dentro de
> ContentOS**: guiones en borrador, memoria de marca y piezas del calendario interno
> (Fase 2), y desde la Fase 4 puede proponer un calendario completo que el usuario
> aprueba con un botón. Lo que sigue intacto es lo que de verdad importaba de esta
> decisión: **nada sale de ContentOS**. No publica en Instagram, no programa
> publicaciones reales, no gasta presupuesto y no toca el MCP de Meta. Por eso sigue sin
> hacer falta la capa de permisos que se descarta abajo: no hay acción irreversible ni
> visible hacia fuera, y toda escritura queda en `agent_audit_log`.

El agente **NO ejecuta acciones de escritura**. No publica, no programa posts, no gasta presupuesto, no toca el MCP oficial de Meta para gestión de campañas. Esto está deliberadamente fuera de alcance para v1.

El agente sí hace:
- Análisis y reportes detallados de métricas propias.
- Recomendaciones basadas en esos datos.
- Scraping/lectura de señales públicas de competencia.
- Generación de copy, guiones y estrategias/ideas de contenido.

**Consecuencia de diseño:** como no hay escritura, el sistema de permisos/sandbox tradicional de un arnés de agente autónomo (tipo Claude Code) es innecesario en v1. No lo construyas. Si en el futuro se agrega el MCP de Meta para gestionar campañas, este documento debe revisarse — ese es el punto donde sí hace falta una capa de permisos real.

## 3. Fuente de datos

Las métricas vienen de **Zernio**. Esta es la fuente de verdad para datos propios de la cuenta. Todo lo demás (competencia) se trata como una fuente de segunda clase — ver sección 6.

**Pregunta abierta crítica (ver sección 8, #1):** no está confirmado si Zernio permite consultar `n` (tamaño de muestra) segmentado por condición (ej. "reels menores a 30s") o solo series agregadas. Esto bloquea gran parte del diseño de la sección 5 y debe resolverse antes de implementar el grounding de confianza.

## 4. Principio de diseño rector: separar "dato duro" de "output creativo"

El agente tiene que hacer dos cosas con perfiles de riesgo opuestos:

- **Reportar métricas** → inventar aquí es un fallo grave. Cero tolerancia.
- **Generar copy/guiones/estrategia** → aquí la creatividad es el producto.

**No usar un solo system prompt monolítico para ambas.** Un mismo prompt que dice "nunca inventes datos" y "sé creativo" genera contagio de modo: o el copy sale acartonado, o el reporte de métricas se vuelve laxo. Arquitectura correcta: un router de intención liviano + sub-skills separadas, cada una con sus propias reglas de grounding.

### 4.1 Router de intención

```
clasificar_intencion(mensaje, contexto) →
  "analisis_metricas" | "analisis_competencia" | "generacion_copy" | "estrategia_mixta"
```

Puede ser una llamada barata al modelo con salida estructurada forzada (solo devuelve el campo `intent`). No necesita ser un clasificador tradicional entrenado.

### 4.2 Sub-skills

| Skill | Puede afirmar | No puede hacer |
|---|---|---|
| Analista de métricas | Solo lo que viene de `get_metrics` / `get_post_breakdown` | Dar consejos genéricos de marketing no atados a datos de la cuenta |
| Analista de competencia | Señales públicas visibles (likes, comentarios, frecuencia de posteo) | Comparar alcance/impresiones de terceros — ese dato no existe vía Meta para cuentas ajenas, sin importar cuántos posts se analicen |
| Generador de copy/guiones | Libertad creativa, anclada en `get_content_voice_profile` | Hacer afirmaciones de rendimiento ("esto te va a funcionar mejor") — eso es trabajo del analista de métricas |
| Estrategia mixta | Orquesta las anteriores | No tiene lógica propia de grounding; hereda las reglas de las skills que invoca |

Si un mensaje del usuario pide dos cosas a la vez (ej. "dime qué funcionó y escríbeme un guion basado en eso"), el orquestador llama a ambas skills y compone la respuesta. Nunca una sola skill improvisando ambas funciones.

## 5. Contrato de confianza estadística (obligatorio, no delegable al modelo)

**Regla de diseño:** no confíes en que una instrucción de prompt ("siempre declara el tamaño de muestra") se cumpla de forma confiable. Un modelo cumple una regla así el ~90% del tiempo y falla el resto — y ese margen de falla es justo el que genera decisiones de negocio basadas en ruido estadístico. Esto se resuelve en código, en tres capas.

### Capa 1 — La capa de datos calcula la confianza, el modelo no

Toda función que devuelva una métrica debe devolver también `n` y una clasificación calculada por código, nunca inferida por el LLM:

```json
{
  "value": 4.2,
  "n": 8,
  "period": "2026-06-01/2026-08-29",
  "confidence_tier": "insuficiente | débil | razonable",
  "source": "zernio"
}
```

Umbrales heurísticos de partida (no son estadísticamente rigurosos, son sentido común — ajustar con datos reales de volumen de posts por cuenta):
- `n < 10` → insuficiente
- `10–30` → débil
- `30+` → razonable

**Punto crítico:** cuando el agente segmenta (ej. reels <30s vs. >30s), `n` debe ser el tamaño de *ese segmento*, no el total de posts de la cuenta. Si la capa de consulta no calcula esto bien, todo lo demás en esta sección es cosmético.

### Capa 2 — Salida estructurada obligatoria antes de convertirse en texto

El modelo no redacta directo al usuario. Primero produce JSON:

```json
{
  "insights": [
    {
      "claim": "Los reels con hook en los primeros 2 segundos retienen más",
      "metric": "retention_3s",
      "n": 8,
      "confidence_tier": "débil",
      "source": "zernio"
    }
  ]
}
```

Un paso de código (no el modelo) renderiza el disclaimer de confianza como parte del template, automáticamente, cuando `confidence_tier` no sea "razonable" — ej.: *"⚠️ Basado en solo 8 posts — señal débil, trátalo como hipótesis, no como regla."* El modelo no controla si esto aparece.

### Capa 3 — Refuerzo visual en el dashboard (si aplica)

Si los insights también se muestran como tarjetas en la UI (no solo en chat), el badge de confianza debe renderizarse desde el dato crudo (`confidence_tier`), no desde el texto generado por el LLM. Es la capa más robusta porque no depende de que el modelo diga nada.

### Explícitamente fuera de alcance para v1

Un segundo modelo o script que audite la respuesta final buscando afirmaciones sin `n` adjunto (el "filtro de alucinaciones" de arquitecturas de atención al cliente a escala). Se justifica cuando hay volumen alto sin supervisión humana. Con 2 usuarios que van a notar output raro, ese costo de latencia/complejidad no se justifica todavía. Reevaluar si se incorporan clientes externos que no auditan al agente.

## 6. Tools — contrato explícito

| Tool | Devuelve | Confianza por defecto |
|---|---|---|
| `get_metrics(account, metric, range, segment?)` | value, n, confidence_tier | Alta (Zernio, dato propio) |
| `get_post_breakdown(account, range, sort_by)` | lista de posts + n total | Alta |
| `get_content_voice_profile(account)` | resumen de tono/estilo histórico | N/A — insumo de grounding para copy, no para métricas |
| `get_success_definition(account)` | métrica de éxito configurada por el usuario (guardados, DMs, ventas, alcance, etc.) | Config persistida, nunca inferida por el modelo en cada turno |
| `get_competitor_signal(handle, range)` | métricas públicas visibles (likes, comentarios, frecuencia de posteo) | **Siempre "estimado/parcial"**, independientemente de `n` — el alcance/impresiones de terceros no es un dato disponible vía Meta, así que ninguna cantidad de posts arregla esa limitación estructural |

## 7. Memoria y observabilidad (mínimo viable, no el arnés completo de un agente autónomo)

- **`success_definition` por cuenta**: persistido, no re-decidido por el modelo en cada sesión. Si se deja a interpretación del modelo turno a turno, se generan conclusiones inconsistentes sobre el mismo contenido.
- **Historial de conversación**: estándar, sin arquitectura especial requerida en v1.
- **Log de auditoría mínimo**: una tabla simple — `conversation_id, tool_called, params, n_returned, confidence_tier, claim_final`. Suficiente para auditar sin construir event-sourcing completo (innecesario con 2 usuarios).
- **No construir**: sandbox de ejecución, sistema de permisos allow/deny, hooks de seguridad — todo esto pertenece a un arnés de agente que ejecuta acciones, y este agente no ejecuta acciones en v1.

## 8. Preguntas abiertas — resolver antes o durante la construcción

Estas preguntas no son opcionales de "nice to have". Cada una bloquea una parte específica del diseño de arriba. Documentar la respuesta de cada una en este mismo archivo conforme se resuelvan.

1. **¿Zernio permite segmentar con `n` real, o solo entrega agregados?**
   Bloquea: toda la sección 5 (contrato de confianza). Si Zernio solo da series de tiempo agregadas, se necesita una capa ETL propia que calcule `n` por segmento antes de que el agente pueda consultar nada de forma confiable. Sin esto, cualquier "confidence_tier" que se muestre estaría mal calculado desde el origen.

2. **¿Qué tan estable/legal es el scraping de competencia a mediano plazo?**
   Riesgo no técnico sino de producto: si algún día se vende como feature a clientes externos, alguien tiene que decidir conscientemente si sostener scraping de Meta/IG es una apuesta viable, no heredarlo por default de cómo se construyó en v1.

3. **¿Qué pasa cuando `get_success_definition` no ha sido configurado por el usuario todavía?**
   El agente no debe inventar una métrica de éxito por defecto sin dejarlo explícito. Definir: ¿fuerza a configurarlo antes de dar cualquier insight de rendimiento, o usa un default declarado abiertamente (ej. "asumiendo alcance como métrica de éxito porque no configuraste una — ¿es correcto?")?

4. **¿Cuál es el volumen real de posts por cuenta en las cuentas piloto?**
   Los umbrales de `confidence_tier` (10/30) son un punto de partida arbitrario. Hay que calibrarlos contra datos reales — si las cuentas piloto tienen 15 posts/mes, un umbral de 30 para "razonable" puede ser inalcanzable en la práctica y hay que ajustarlo.

5. **¿El output del agente vive solo en chat, o también como tarjetas en el dashboard?**
   Determina si vale la pena invertir en la Capa 3 (badges visuales de confianza) desde v1 o si se puede posponer mientras todo pasa por chat.

6. **¿Qué pasa si `get_competitor_signal` falla o el handle no es público/accesible?**
   No debe fallar en silencio ni el agente debe rellenar con una estimación no marcada como tal.

## 9. Resumen para empezar a construir

Orden sugerido de implementación:
1. Resolver pregunta #1 (Zernio) — es la dependencia dura de todo lo demás.
2. Implementar `get_metrics` y `get_post_breakdown` con `n` y `confidence_tier` calculados en código.
3. Construir el router de intención y las 4 sub-skills con sus reglas de grounding separadas.
4. Implementar la Capa 2 (salida estructurada + renderer de disclaimers) antes de exponer nada al usuario.
5. `get_competitor_signal` y `get_content_voice_profile` después, una vez el flujo de métricas propias esté validado.
6. Log de auditoría mínimo en paralelo a todo lo anterior, no al final.
