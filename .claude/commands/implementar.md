# Implementar

Ejecutá un plan de implementación creado por `/crear-plan`. Leé el plan exhaustivamente, ejecutá cada paso en orden y reportá el trabajo completado.

## Variables

plan_path: $ARGUMENTS (ruta al archivo del plan, ej. `planes/2026-01-28-agregar-comando-investigacion.md`)

---

## Instrucciones

### Fase 1: Entender el Plan

1. **Leé el archivo del plan completamente.** No lo hojees — entendé cada sección.
2. **Verificá los prerequisitos:**
   - ¿Hay preguntas abiertas que necesitan respuesta antes de continuar?
   - ¿Hay dependencias de recursos externos o decisiones del usuario?
   - Si existen bloqueos, detenete y consultá al usuario antes de continuar.
3. **Confirmá que el plan está listo:**
   - El estado debe ser "Borrador" o "Listo"
   - Todas las secciones deben estar completadas (sin texto de marcador)

---

### Fase 2: Ejecutar el Plan

1. **Seguí las Tareas Paso a Paso en orden exacto.**
   - Completá cada paso completamente antes de pasar al siguiente
   - Si un paso involucra crear un archivo, escribilo completo — no en borrador
   - Si un paso involucra modificar un archivo, leélo primero, luego aplicá los cambios con precisión

2. **Para cada tarea:**
   - Leé los archivos que se verán afectados
   - Hacé los cambios especificados
   - Verificá que el cambio es correcto antes de continuar

3. **Manejá los problemas con gracia:**
   - Si un paso no puede completarse como está escrito, notá el problema y adaptate si la intención es clara
   - Si no estás seguro de cómo continuar, consultá al usuario en lugar de adivinar
   - Documentá cualquier desviación del plan

---

### Fase 3: Validar

1. **Revisá la Lista de Validación** del plan
   - Marcá cada ítem
   - Notá los que fallen

2. **Verificá que los Criterios de Éxito** se cumplan
   - Confirmá que cada criterio está satisfecho
   - Notá cualquier brecha

3. **Verificá referencias cruzadas y consistencia:**
   - Asegurate de que los nuevos archivos estén referenciados donde corresponde
   - Verificá que CLAUDE.md esté actualizado si cambió la estructura del workspace
   - Confirmá que se siguen las convenciones de nombres

---

### Fase 4: Actualizar Estado del Plan

Después de la implementación, actualizá el archivo del plan:

1. Cambiá `**Estado:** Borrador` a `**Estado:** Implementado`
2. Agregá una sección de Notas de Implementación al final:

```markdown
---

## Notas de Implementación

**Implementado:** <YYYY-MM-DD>

### Resumen

<Breve resumen de qué se hizo>

### Desviaciones del Plan

<Listá cambios realizados durante la implementación, o "Ninguna">

### Problemas Encontrados

<Listá problemas encontrados y cómo se resolvieron, o "Ninguno">
```

---

## Estándares de Calidad

- **Exhaustividad:** Cada paso del plan se ejecuta, no se omite
- **Precisión:** Los cambios coinciden con lo que especifica el plan
- **Completitud:** Los archivos se escriben completamente, no en borrador
- **Consistencia:** Todas las referencias cruzadas y documentación actualizadas
- **Trazabilidad:** Las desviaciones están documentadas

---

## Reporte

Después de la implementación, proporcioná:

1. **Resumen:** Lista con viñetas del trabajo completado
2. **Archivos modificados:** Listá todos los archivos creados, modificados o eliminados
3. **Resultados de validación:** Estado de cada ítem de la lista de verificación
4. **Desviaciones:** Cualquier cambio respecto al plan original
5. **Próximos pasos:** Acciones de seguimiento necesarias (si aplica)

Formato:

```
## Implementación Completa

### Resumen
- <Qué se hizo>
- <Qué se hizo>

### Archivos Modificados
**Creados:**
- `ruta/nuevo-archivo.md`

**Modificados:**
- `ruta/archivo-modificado.md`

**Eliminados:**
- (ninguno)

### Validación
- [x] <Verificación aprobada>
- [x] <Verificación aprobada>

### Desviaciones del Plan
<Ninguna, o listá las desviaciones>

### Estado del Plan
Actualizado `planes/YYYY-MM-DD-{nombre}.md` estado a "Implementado"
```
