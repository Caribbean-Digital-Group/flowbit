Registra en Linear una implementación hecha con Claude Code, con el mismo formato que la rutina programada, para que cada cambio tenga tarea, rama y PR que concuerden.

Tarea a registrar (si está vacío, dedúcela de la conversación y del diff actual): $ARGUMENTS

Este protocolo se aplica por sí solo según la sección «Trazabilidad en Linear» de `CLAUDE.md`. El comando sirve para lanzarlo a mano o para registrar trabajo que quedó sin tarea.

---

## Datos del workspace

| Dato | Valor |
|---|---|
| Workspace | https://linear.app/tryflowbit |
| Equipo | `TRY` (Tryflowbit) |
| Proyecto | `P-TRY-1` (Flowbit — Roadmap de optimización y crecimiento) |
| Etiquetas | `Feature`, `Improvement`, `Bug` |
| Estados | Backlog → Todo → In Progress → In Review → Done |

Las herramientas son las del conector de Linear (`mcp__claude_ai_Linear__*`). Son diferidas: cárgalas con ToolSearch antes de llamarlas.

Si el conector no está disponible (por ejemplo, un contribuidor externo sin acceso), no bloquees el trabajo: implementa normalmente y avisa en tu mensaje final que no quedó registrado.

---

## Paso 1 — Antes de implementar

1. **Busca si ya existe la tarea** con `list_issues` (equipo `TRY`, palabras clave del cambio). Revisa también el backlog: muchas mejoras ya vienen de la rutina. Si existe, reutilízala y no crees un duplicado.
2. **Si no existe, créala** con `save_issue`:
   - Título en español, orientado al resultado.
   - Equipo `TRY`, proyecto `P-TRY-1`, asignada a `me`.
   - Etiqueta: `Feature` (nueva funcionalidad), `Improvement` (mejora o refactor) o `Bug` (corrección).
   - Prioridad según el impacto: 1 urgente, 2 alta, 3 media, 4 baja.
   - Descripción: qué se hace y para quién, seguido de `**Criterios de aceptación**` en lista.
3. **Pásala a `In Progress`** y déjala asignada a `me`.
4. **Agrega el comentario de decisión** con `save_comment`, empezando con `**Por qué:**`. Explica por qué se implementa y por qué de esta forma, con evidencia del repo o de lo que pidió el usuario. Es el mismo comentario que deja la rutina.
5. **Crea la rama desde `develop` actualizado:** `{tipo}/try-{N}-{slug}`, con `tipo` = `feat`, `fix` o `refactor`. Ejemplo: `feat/try-9-invoice-module`. El identificador `try-N` en el nombre es lo que enlaza rama y PR con la tarea.

Nunca trabajes directamente sobre `develop` ni `main`.

## Paso 2 — Durante la implementación

- Sigue las convenciones de `CLAUDE.md`.
- Si la funcionalidad es visible para el usuario, documéntala: artículo en `app/utils/manual/` y, si aplica, `docs/`.
- Si el alcance cambia de forma importante, actualiza la descripción y explica el motivo en un comentario.
- El trabajo que no entre en esta tarea se registra como tarea nueva en `Backlog`, no se mezcla.

## Paso 3 — Al terminar

Agrega un comentario de cierre con:

- Qué cambió y en qué archivos o módulos.
- Cómo se verificó (`npm test`, typecheck, build, prueba manual). Indica lo que no se pudo verificar.
- Qué queda pendiente, separando lo que debe hacer el dueño, como `npm run db:push && npm run db:types` cuando hay migraciones.

Después, según el estado del PR:

- **Sin PR todavía:** la tarea sigue en `In Progress`. Entrega al usuario el siguiente mensaje de commit y el título del PR.
- **PR abierto:** adjunta el enlace con `create_attachment` y pasa la tarea a `In Review`.

No pases la tarea a `Done`: eso ocurre cuando el dueño fusiona el PR.

## Commits y pull requests

- No hagas commit ni push salvo que el usuario lo pida.
- Commit: Conventional Commits en inglés, con el identificador al final del asunto. Ejemplo: `feat(invoices): add invoice module (TRY-9)`.
- PR siempre hacia `develop`, con el mismo título que el commit principal y `Closes TRY-N` en la descripción.
- Si `gh` no está disponible, entrega este enlace para abrir el PR: `https://github.com/Caribbean-Digital-Group/flowbit/compare/develop...{rama}?expand=1`.

## Mensaje final

Incluye siempre el enlace de la tarea, su estado y la rama.
