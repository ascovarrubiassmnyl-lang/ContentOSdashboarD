# Crear Plan

Creá un plan de implementación detallado para cambios en este workspace. Los planes son documentos exhaustivos que capturan el contexto completo, la justificación y las tareas paso a paso necesarias para ejecutar un cambio con total alineación entre el proyecto.

## Variables

request: $ARGUMENTS (describí qué querés planificar — nuevo comando, nuevo flujo de trabajo, cambio estructural, actualización de plantilla, etc.)

---

## Instrucciones

- **IMPORTANTE:** Estás creando un PLAN, no implementando cambios. Investigá a fondo, pensá profundamente y luego producí un documento de plan completo.
- Usá tus capacidades de razonamiento para pensar bien en el pedido, la estructura del workspace y el mejor enfoque.
- Investigá el workspace para entender los patrones existentes, convenciones y cómo encaja este cambio.
- Creá el plan en el directorio `planes/` con el nombre de archivo: `YYYY-MM-DD-{nombre-descriptivo}.md`
  - Usá la fecha de hoy
  - Reemplazá `{nombre-descriptivo}` con un nombre corto en kebab-case (ej. "agregar-comando-investigacion", "restructurar-salidas", "crear-flujo-outreach")
- Completá todas las secciones del Formato de Plan a continuación. Reemplazá todos los `<marcadores>` con contenido específico y accionable.
- Sé exhaustivo — este plan será ejecutado por `/implementar` y necesita suficiente detalle para ejecutarse sin ambigüedad.
- Seguí los patrones existentes. Estudiá archivos similares en el workspace antes de proponer nuevas estructuras.

---

## Fase de Investigación

Antes de escribir el plan, investigá:

1. **Leé los archivos de referencia principales:**
   - `CLAUDE.md` — descripción general del workspace
   - `contexto/` — contexto de fondo sobre el usuario y el proyecto

2. **Explorá las áreas relevantes:**
   - Si creás un comando: leé los comandos existentes en `.claude/commands/`
   - Si modificás salidas: explorá la estructura y ejemplos en `salidas/`
   - Si actualizás plantillas: revisá `referencia/` para patrones existentes
   - Si agregás scripts: revisá `scripts/` para convenciones

3. **Entendé las conexiones:**
   - ¿Cómo se relaciona este cambio con los flujos de trabajo existentes?
   - ¿Qué archivos referencian o dependen de las áreas que se modifican?
   - ¿Hay convenciones de nombres a seguir?

---

## Formato del Plan

Escribí el plan usando esta estructura exacta:

```markdown
# Plan: <título descriptivo>

**Creado:** <YYYY-MM-DD>
**Estado:** Borrador
**Pedido:** <resumen de una línea de lo que se solicitó>

---

## Descripción General

### Qué Logra Este Plan

<2-3 oraciones describiendo el resultado final y por qué importa>

### Por Qué Importa

<Conectá este cambio con los objetivos o misión del proyecto. ¿Cómo agrega valor?>

---

## Estado Actual

### Estructura Existente Relevante

<Listá archivos, carpetas o patrones que existen y se relacionan con este cambio>

### Brechas o Problemas que se Abordan

<¿Qué falta, está roto o es subóptimo que este plan soluciona?>

---

## Cambios Propuestos

### Resumen de Cambios

<Lista con viñetas de todos los cambios a alto nivel>

### Nuevos Archivos a Crear

<Listá cada nuevo archivo con su ruta completa y una descripción de su propósito>

| Ruta del Archivo  | Propósito                          |
| ----------------- | ---------------------------------- |
| `ruta/archivo.md` | Descripción de qué hace este archivo |

### Archivos a Modificar

<Listá cada archivo que se modifica y resumí los cambios>

| Ruta del Archivo  | Cambios                      |
| ----------------- | ---------------------------- |
| `ruta/archivo.md` | Descripción de las modificaciones |

### Archivos a Eliminar (si aplica)

<Listá los archivos que se eliminan y por qué>

---

## Decisiones de Diseño

### Decisiones Clave Tomadas

<Listá las decisiones de diseño importantes y el razonamiento detrás de ellas>

1. **<Decisión>**: <Justificación>
2. **<Decisión>**: <Justificación>

### Alternativas Consideradas

<¿Qué otros enfoques se consideraron y por qué se rechazaron?>

### Preguntas Abiertas (si las hay)

<Listá decisiones que necesitan input del usuario antes de implementar>

---

## Tareas Paso a Paso

Ejecutá estas tareas en orden durante la implementación.

### Paso 1: <Título de la Tarea>

<Descripción detallada de qué hacer>

**Acciones:**

- <Acción específica>
- <Acción específica>

**Archivos afectados:**

- `ruta/archivo.md`

---

### Paso 2: <Título de la Tarea>

<Descripción detallada de qué hacer>

**Acciones:**

- <Acción específica>
- <Acción específica>

**Archivos afectados:**

- `ruta/archivo.md`

---

<Continuá con todos los pasos necesarios. Sé exhaustivo. Incluí:>
<- Creación de nuevos archivos (con especificaciones de contenido completo)>
<- Modificación de archivos existentes (con antes/después o ediciones específicas)>
<- Actualización de referencias cruzadas>
<- Pasos de prueba/validación>

---

## Conexiones y Dependencias

### Archivos que Referencian Esta Área

<Listá archivos que enlazan o dependen de las áreas que se modifican>

### Actualizaciones Necesarias para Consistencia

<Listá documentación, referencias o archivos relacionados que necesitan actualización>

### Impacto en Flujos de Trabajo Existentes

<Describí cómo esto afecta comandos, salidas o procesos existentes>

---

## Lista de Validación

Cómo verificar que la implementación está completa y correcta:

- [ ] <Paso de verificación — ej. "El nuevo comando se ejecuta sin errores">
- [ ] <Paso de verificación — ej. "Los archivos de salida se crearon en la ubicación correcta">
- [ ] <Paso de verificación — ej. "CLAUDE.md actualizado para reflejar la nueva estructura">
- [ ] <Paso de verificación — ej. "Referencias cruzadas actualizadas y válidas">

---

## Criterios de Éxito

La implementación está completa cuando:

1. <Criterio específico y medible>
2. <Criterio específico y medible>
3. <Criterio específico y medible>

---

## Notas

<Cualquier contexto adicional, consideraciones futuras o ideas relacionadas que puedan ser útiles>
```

---

## Estándares de Calidad

- **Completitud:** Cada sección completada con contenido específico, sin marcadores genéricos
- **Accionabilidad:** Los pasos son suficientemente detallados para que `/implementar` los ejecute sin hacer preguntas
- **Consistencia:** Sigue los patrones y convenciones de nombres existentes en el workspace
- **Claridad:** Alguien sin familiaridad con el proyecto podría entender y ejecutar el plan
- **Trazabilidad:** Los cambios están conectados con objetivos y justificación

---

## Reporte

Después de crear el plan:

1. Proporcioná un breve resumen de qué cubre el plan
2. Listá las preguntas abiertas que necesitan input del usuario antes de implementar
3. Proporcioná la ruta completa al archivo del plan: `planes/YYYY-MM-DD-{nombre}.md`
4. Recordale al usuario ejecutar `/implementar planes/YYYY-MM-DD-{nombre}.md` para ejecutarlo
