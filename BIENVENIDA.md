# Bienvenido/a a la plantilla del espacio de trabajo 👋

Este es un **Claude Workspace Template**: un entorno pensado para trabajar con Claude Code como asistente agente entre sesiones, manteniendo el contexto organizado y reutilizable.

## Cómo está organizado

```
.
├── CLAUDE.md         # Contexto principal — se carga automáticamente en cada sesión
├── contexto/         # Quién sos, tu rol, tu negocio, tu estrategia y prioridades actuales
├── planes/           # Planes de implementación creados con /crear-plan
├── salidas/          # Entregables, análisis, reportes y productos de trabajo
├── referencia/       # Plantillas, ejemplos y patrones reutilizables
├── scripts/          # Scripts de automatización auxiliares
└── .claude/commands/ # Comandos disponibles (/iniciar, /crear-plan, /implementar)
```

## Cómo se usa

1. **Completá `contexto/`** con tu información: rol, negocio, estrategia, proyectos y datos actuales.
2. **Ejecutá `/iniciar`** al comienzo de cada sesión para que Claude cargue ese contexto sin sobrecargar la ventana de conversación.
3. **Usá `/crear-plan [pedido]`** antes de agregar funcionalidad nueva o hacer cambios estructurales — genera un plan detallado en `planes/`.
4. **Usá `/implementar [ruta-al-plan]`** para ejecutar ese plan paso a paso.
5. Claude mantiene `CLAUDE.md` actualizado a medida que el workspace evoluciona, para que cada sesión futura arranque con contexto preciso.

Para el detalle completo de cada comando y directorio, ver `CLAUDE.md`.

---

*¡Suerte con el espacio de trabajo!*
