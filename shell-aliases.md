# Aliases de Shell para Claude Code

Dos aliases de shell simplifican el lanzamiento de sesiones de Claude Code con este workspace.

## Configuración

Agregá estas líneas a tu `~/.zshrc` (o `~/.bashrc`):

```bash
alias iniciar='claude "/iniciar"'
alias cs='claude "/iniciar"'
alias cr='claude --dangerously-skip-permissions "/iniciar"'
```

Luego recargá tu shell: `source ~/.zshrc`

## Los Aliases

### `iniciar` — Alias principal

```bash
alias iniciar='claude "/iniciar"'
```

Lanza Claude Code y ejecuta inmediatamente `/iniciar` para cargar el contexto del workspace. Claude pedirá permiso antes de ejecutar comandos, leer archivos sensibles o hacer cambios.

**Usalo cuando:** Querés iniciar una sesión normal con supervisión.

### `cs` — Claude Seguro (alias alternativo)

```bash
alias cs='claude "/iniciar"'
```

Equivalente a `iniciar`. Alias corto alternativo.

### `cr` — Claude Libre

```bash
alias cr='claude --dangerously-skip-permissions "/iniciar"'
```

Lanza Claude Code con los prompts de permiso desactivados y ejecuta `/iniciar`. Claude puede ejecutar comandos y hacer cambios sin pedir aprobación.

**Usalo cuando:** Confiás en la tarea, querés iterar más rápido, o estás haciendo trabajo rutinario donde las aprobaciones constantes te ralentizan.

## ¿Por Qué Varios?

- **`iniciar`** es el comando principal — intuitivo y directo
- **`cs`** es un alias corto equivalente a `iniciar`
- **`cr`** te da velocidad — para flujos de trabajo familiares donde confiás en que Claude opere de forma autónoma

Los tres ejecutan `/iniciar` automáticamente para que Claude comience cada sesión completamente orientado a tu workspace, objetivos y contexto.
