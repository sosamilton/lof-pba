# Project Rules

## Skills obligatorios para cambios de código

Cuando se solicite una modificación, un fix, una mejora o una nueva funcionalidad en este proyecto, **invocar siempre** (en paralelo, al iniciar la tarea) los siguientes skills, salvo que el usuario indique explícitamente lo contrario (ej. "no uses skills definidos"):

- **svelte-core-bestpractices** — buenas prácticas de Svelte 5 (runes, snippets, eventos, estilos, reactividad). Respetar la arquitectura actual del proyecto.
- **shadcn-svelte** — gestión de componentes shadcn-svelte (añadir, actualizar, fix, estilos, composición de UI).
- **grist-master** — conocimiento técnico de Grist (REST API, SQL, webhooks, fórmulas, tipos de columna, access rules) para cualquier integración o consulta a Grist.

## Notas

- Respetar la arquitectura y convenciones existentes del proyecto (estructura de módulos en `src/app/modules/`, stores en `src/core/stores/`, componentes en `src/lib/components/`).
- Si una tarea no toca UI ni Grist, igualmente cargar `svelte-core-bestpractices` para mantener la calidad del código Svelte.
- Si el usuario pide explícitamente no usar skills, omitir esta regla para esa tarea.
