# Notas de revisión — despues del commit "Integrar tabla personas"

## Fixes pendientes

### Socios.svelte
- **`save()` manda `null` en personaData**: linea 193-200 construye `personaData` con `|| null`, pero `findOrCreatePersona` y `createPersona` ya filtran nulls. No causa error pero es inconsistente con el fix aplicado. Idealmente usar el mismo patron: `if (valor) obj.key = valor`.
- **`onDniInput` no normaliza el input**: linea 173 usa `normalizeDni(form.dni)` para validar pero no actualiza `form.dni` con el valor normalizado. El usuario ve el DNI con puntos/espacios pero se guarda normalizado. Considerar normalizar visualmente on-blur.
- **`selectPersona` pisa campos legacy**: si la persona tiene datos, sobreescribe `form.dni`, `form.cuil`, etc. Esto es correcto para el flujo de vincular, pero si el socio tenia datos distintos en legacy, se pierden sin warning. Considerar mostrar un diff o confirmar.
- **No hay debounce en `doPersonaSearch`**: cada keystroke dispara `searchPersonas` que hace `fetchRecords` completo. Para tablas grandes puede ser lento. Considerar debounce de 300ms.

### personas.js
- **`searchPersonas` hace fetch completo**: linea 24 trae todos los registros y filtra en cliente. Para tablas grandes (>1000) considerar paginado o usar `grist.docApi.fetchTable` con filtros.
- **`findPersonaByDni` tambien hace fetch completo**: mismo problema. Se podria cachear entre llamadas en una sesion.
- **`findOrCreatePersona` no actualiza datos**: si la persona existe por DNI pero tiene datos distintos (ej. domicilio vacio), no la actualiza. Considerar un `findOrUpdateOrCreate`.

### migracion.js
- **Match por nombre es exacto**: linea 47 compara `apellido + nombre` normalizado exacto. Un cambio de orden ("Juan Perez" vs "Perez Juan") no matchea. Considerar comparar tambien apellido solo.
- **No hay log de que se actualizo vs creo**: `getOrCreatePersona` podria devolver `{ persona, created: boolean }` para un reporte mas detallado.
- **`personaCache` es redundante con `dniToPersona`**: ambos maps usan DNI como key y guardan lo mismo. Se podria unificar.

### Gobierno.svelte (sin cambios en este commit)
- **No integra personas**: sigue usando solo campos legacy (`apellido_nombre`, `dni`, `cuil`). Pendiente para proxima iteracion.
- **`initComision` crea registros vacios**: crea autoridades sin datos para "inicializar". Considerar si tiene sentido o si deberia ser parte del wizard de carga.
- **`saveComision` no valida cargos obligatorios**: permite guardar sin completar cargos marcados como obligatorios. Necesita validacion.
- **Asambleas: formulario plano sin validacion**: todos los campos en una sola pantalla, sin separar datos de resoluciones, sin validar antes de guardar.
- **Rediseño pendiente**: aplicar wizard de 3 pasos (Contexto > Cargos > Confirmar) como en `formularios-compilados/comision`.

### Inicio.svelte
- **`doMigration` llama `ensureSchema` sin esperar**: linea 75 pasa un Set de tablas pero no espera el resultado real. Si el schema no esta sincronizado, la migracion puede fallar.
- **No hay confirmacion antes de migrar**: el boton ejecuta directamente. Considerar un modal de confirmacion mostrando cuantos registros se procesaran.

### grist.js
- **`resolveTableId` llama `listTables` cada vez**: cada llamada a `searchPersonas`, `findPersonaByDni`, etc. hace un `listTables`. Considerar cachear el resultado por sesion.
- **`fetchRecords` hace `fetchTable` completo**: no hay soporte para seleccionar columnas o filtrar. Para tablas grandes puede ser ineficiente.

### Schema (appcoop_schema.v1.json)
- **`personas` no tiene campo `creado_el` en demoSchema.js**: el schema JSON define `creado_el` (DateTime) pero `demoSchema.js` no lo incluye. Si se usa `demoSchema` para crear la tabla, faltara esa columna.

### General
- **No hay tests**: ningun archivo tiene tests automatizados. Considerar agregar al menos tests para `personas.js` (normalizacion, validacion, extractRowId).
- **Estilos duplicados**: `.btn`, `.btn.secondary`, `.muted`, `.mono` se repiten en cada `.svelte`. Considerar extraer a un CSS compartido.
- **Sin manejo de errores global**: los errores se muestran en variables locales `error`. Considerar un toast/notification system.
