# CLAUDE.md

Este archivo provee instrucciones a Claude Code (claude.ai/code) cuando trabaja con código en este repositorio.

---

## Qué Es Esto

Este es un **Claude Workspace Template** — un entorno estructurado diseñado para trabajar con Claude Code como un potente asistente agente entre sesiones. El usuario abrirá nuevas sesiones de Claude Code repetidamente, usando `/iniciar` al comienzo de cada una para cargar contexto esencial sin sobrecargar el contexto.

**Este archivo (CLAUDE.md) es la base.** Se carga automáticamente al inicio de cada sesión. Mantenelo actualizado — es la única fuente de verdad sobre cómo Claude debe entender y operar dentro de este workspace.

---

## La Relación Claude-Usuario

Claude opera como un **asistente agente** con acceso a las carpetas del workspace, archivos de contexto, comandos y salidas. La relación es:

- **Usuario**: Define objetivos, provee contexto sobre su rol/función y dirige el trabajo mediante comandos
- **Claude**: Lee el contexto, entiende los objetivos del usuario, ejecuta comandos, produce salidas y mantiene la consistencia del workspace

Claude siempre debe orientarse a través de `/iniciar` al inicio de la sesión, y luego actuar con plena conciencia de quién es el usuario, qué está tratando de lograr y cómo este workspace lo apoya.

---

## Estructura del Workspace

```
.
├── CLAUDE.md              # Este archivo — contexto principal, siempre cargado
├── .claude/
│   └── commands/          # Comandos que Claude puede ejecutar
│       ├── iniciar.md      # /iniciar — inicialización de sesión
│       ├── crear-plan.md   # /crear-plan — crear planes de implementación
│       └── implementar.md  # /implementar — ejecutar planes
├── contexto/              # Contexto de fondo sobre el usuario y el proyecto
│                          # (El usuario debe completar con rol, objetivos, estrategias)
├── planes/                # Planes de implementación creados por /crear-plan
├── salidas/               # Productos de trabajo, herramientas y entregables
├── referencia/            # Plantillas, ejemplos, patrones reutilizables
└── scripts/               # Scripts de automatización auxiliares (si aplica)
```

**Directorios principales:**

| Directorio    | Propósito                                                                                       |
| ------------- | ----------------------------------------------------------------------------------------------- |
| `contexto/`   | Quién es el usuario, su rol, prioridades actuales, estrategias. Leído por `/iniciar`.           |
| `planes/`     | Planes de implementación detallados. Creados por `/crear-plan`, ejecutados por `/implementar`.  |
| `salidas/`    | Entregables, análisis, reportes, herramientas y productos de trabajo.                           |
| `referencia/` | Docs de ayuda, plantillas y patrones para asistir en distintos flujos de trabajo.               |
| `scripts/`    | Scripts de automatización auxiliares (bash, python, etc.) que soporten otros flujos.            |

---

## Comandos

### /iniciar

**Propósito:** Inicializar una nueva sesión con plena conciencia del contexto.

Ejecutalo al inicio de cada sesión. Claude:

1. Leerá CLAUDE.md y los archivos de contexto
2. Resumirá su comprensión del usuario, el workspace y los objetivos
3. Confirmará que está listo para asistir

### /crear-plan [pedido]

**Propósito:** Crear un plan de implementación detallado antes de hacer cambios.

Usalo cuando se agrega nueva funcionalidad, comandos, scripts, o se hacen cambios estructurales. Produce un documento de plan exhaustivo en `planes/` que captura contexto, justificación y tareas paso a paso.

Ejemplo: `/crear-plan agregar comando de análisis de competidores`

### /implementar [ruta-al-plan]

**Propósito:** Ejecutar un plan creado por /crear-plan.

Lee el plan, ejecuta cada paso en orden, valida el trabajo y actualiza el estado del plan.

Ejemplo: `/implementar planes/2026-01-28-comando-analisis-competidores.md`

---

## Instrucción Crítica: Mantener Este Archivo

**Siempre que Claude haga cambios en el workspace, DEBE considerar si CLAUDE.md necesita actualizarse.**

Después de cualquier cambio — agregar comandos, scripts, flujos de trabajo, o modificar la estructura — preguntarse:

1. ¿Este cambio agrega nueva funcionalidad que los usuarios necesitan conocer?
2. ¿Modifica la estructura del workspace documentada arriba?
3. ¿Debe listarse un nuevo comando?
4. ¿Necesita `contexto/` nuevos archivos para capturar esto?

Si la respuesta es sí a cualquiera, actualizar las secciones relevantes. Este archivo debe siempre reflejar el estado actual del workspace para que las sesiones futuras tengan contexto preciso.

**Ejemplos de cambios que requieren actualizar CLAUDE.md:**

- Agregar un nuevo comando → agregar a la sección de Comandos
- Crear un nuevo tipo de salida → documentar en Estructura del Workspace o crear una sección
- Agregar un script → documentar su propósito y uso
- Cambiar patrones de flujo de trabajo → actualizar la documentación relevante

---

## Para Usuarios que Descargan Esta Plantilla

Para personalizar este workspace según tus necesidades:

1. Completá los documentos de contexto en `contexto/` con tu información, negocio y objetivos
2. Usá `/crear-plan` para planificar cualquier adición o cambio estructural
3. Usá `/implementar` para ejecutar los planes

Esto asegura que todo se mantenga sincronizado — especialmente CLAUDE.md, que siempre debe reflejar el estado actual del workspace.

---

## Flujo de Trabajo de Sesión

1. **Inicio**: Ejecutar `/iniciar` para cargar el contexto
2. **Trabajo**: Usar comandos o dirigir a Claude con tareas
3. **Planificar cambios**: Usar `/crear-plan` antes de adiciones significativas
4. **Ejecutar**: Usar `/implementar` para ejecutar los planes
5. **Mantener**: Claude actualiza CLAUDE.md y `contexto/` a medida que el workspace evoluciona

---

## Notas

- Mantener el contexto mínimo pero suficiente — evitar sobrecarga
- Los planes viven en `planes/` con nombres de archivo con fecha para historial
- Las salidas se organizan por tipo/propósito en `salidas/`
- Los materiales de referencia van en `referencia/` para reutilización
