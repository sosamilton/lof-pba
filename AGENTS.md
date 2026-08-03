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

## Datos de prueba (dev only)

`src/setup/generadorDemo.js` genera datos de prueba (personas → socios → movimientos → asamblea AGO + autoridades de CD/CRC, todas con Refs resueltas) para probar performance de listados/filtros. Se invoca desde el último paso del setup wizard con un checkbox visible solo cuando `import.meta.env.DEV` es true. El módulo se carga via `import()` dinámico dentro de un guard DEV, así que **no viaja en el bundle de producción** (verificado: `grep -l generarDatosPrueba dist/assets/*.js` no encuentra nada tras `npm run build`).

Para cambiar el volumen de datos, editar los defaults en `generarDatosPrueba()` o pasar parámetros al invocarla. Para volúmenes mayores (~10000), considerar aumentar `batchSize` y monitorear memoria del sandbox de Grist.

## Normalización de datos: single source of truth en `personas`

Las tablas `socios` y `autoridades` tienen columnas que duplican datos de `personas` (dni, cuil, apellido, nombre, domicilio, localidad, telefono, email / apellido_nombre). Estas columnas son **fórmulas de Grist** (`isFormula: true`) que pull de `$persona_id`, no datos almacenados. Esto garantiza que:

- `personas` es la única fuente de verdad para datos personales
- Cambiar una persona actualiza automáticamente todos sus socios y autoridades
- Los stores escriben a `personas` (via `findOrCreatePersona` / `updatePersona`) y solo guardan `persona_id` + campos propios en `socios`/`autoridades`

`ensureSchema` detecta columnas existentes que necesitan convertirse a fórmulas y las migra via `ModifyColumn` automáticamente. Si hay datos legacy sin `persona_id`, ejecutar la migración desde Inicio (botón "Vincular personas") antes de actualizar el schema.


