# Project Rules

## Entorno de shell: nvm antes de npm

El host usa `nvm` para gestionar Node. **Antes de ejecutar cualquier comando `npm` (o `npx`/`node`) por primera vez en una sesión de shell**, correr primero:

```bash
nvm use 24
```

Esto carga la versión de Node 24 y deja `npm` disponible en el PATH de esa shell. Si la shell ya tiene Node 24 cargado (ej. `node -v` devuelve `v24.x`), **no hace falta** repetirlo en la misma sesión.

Reglas:

- Ejecutar `nvm use 24` **una sola vez por sesión de shell** (no antes de cada comando npm).
- Si una shell nueva (distinto `shell_id`) va a correr npm, correr `nvm use 24` ahí también.
- Si `nvm use 24` falla porque la versión no está instalada, avisar al usuario en lugar de intentar instalarla.
- Después de `nvm use 24`, los comandos `npm run dev`, `npm run build`, `npm ci`, `npm test`, etc. funcionan normalmente.

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

`src/setup/generadorDemo.js` genera datos de prueba (personas → socios → movimientos → asamblea AGO + autoridades de CD/CRC, todas con Refs resueltas) para probar performance de listados/filtros. Se invoca desde el primer paso del setup wizard con un switch visible solo cuando `import.meta.env.DEV` es true. El módulo se carga via `import()` dinámico dentro de un guard DEV, así que **no viaja en el bundle de producción** (verificado: `grep -l generarDatosPrueba dist/assets/*.js` no encuentra nada tras `npm run build`).

Para cambiar el volumen de datos, editar los defaults en `generarDatosPrueba()` o pasar parámetros al invocarla. Para volúmenes mayores (~10000), considerar aumentar `batchSize` y monitorear memoria del sandbox de Grist.

## Normalización de datos: single source of truth en `personas`

Las tablas `socios` y `autoridades` tienen columnas que duplican datos de `personas` (dni, cuil, apellido, nombre, domicilio, localidad, telefono, email / apellido_nombre). Estas columnas son **fórmulas de Grist** (`isFormula: true`) que pull de `$persona_id`, no datos almacenados. Esto garantiza que:

- `personas` es la única fuente de verdad para datos personales
- Cambiar una persona actualiza automáticamente todos sus socios y autoridades
- Los stores escriben a `personas` (via `findOrCreatePersona` / `updatePersona`) y solo guardan `persona_id` + campos propios en `socios`/`autoridades`

`ensureSchema` detecta columnas existentes que necesitan convertirse a fórmulas y las migra via `ModifyColumn` automáticamente. Si hay datos legacy sin `persona_id`, ejecutar la migración desde Inicio (botón "Vincular personas") antes de actualizar el schema.

## Sincronización de rubros PIA (`syncRubrosPia` / `syncSubrubrosPia`)

`seedIfEmpty` solo carga `rubros_pia.csv` cuando la tabla está vacía (instalaciones nuevas). Para que instalaciones existentes reciban rubros nuevos agregados al seed en versiones posteriores, `syncRubrosPia` (en `src/setup/migracion.js`) compara los `codigo_rubro` del CSV con los existentes en Grist y agrega solo los faltantes (idempotente, nunca duplica ni borra). `syncSubrubrosPia` hace lo mismo para una pequeña semilla de subrubros conocidos por el sistema (`SUBRUBROS_SEED` en el mismo archivo), resolviendo el `rubro_id` real por `codigo_rubro` del padre (no puede ser un CSV plano porque `rubro_id` es una Referencia de Grist cuyo `id` se genera recién al sembrar `rubros_pia`). Ambas se invocan desde `inicioStore.check()` una sola vez por sesión (guard `_rubrosSynced`) cuando el schema está OK.

Para agregar un rubro nuevo al plan de cuentas:
1. Agregarlo a `public/seeds/rubros_pia.csv` con su `codigo_rubro`, `nombre_oficial`, `grupo_rubro`, `tipo_rubro`, `campo_pdf`, `es_traspaso`, `fijo`.
2. Si el rubro tiene `campo_pdf` (mapea a una línea del PIA PDF), agregarlo también al mapa `CAMPO_PDF_CORRECTO` en `src/app/modules/tesoreria/cierre/cierreDataService.js` para que el fixup runtime lo corrija en instalaciones con seeds viejos.
3. `syncRubrosPia` se encarga de propagarlo a instalaciones existentes en el próximo load de Inicio.

Para agregar una **subcategoría** conocida por el sistema (no una que cargue una cooperadora en particular) dentro de un rubro "Otros...", sumarla a `SUBRUBROS_SEED` en `src/setup/migracion.js` (`{ rubroCodigo, nombreSubrubro }`); `syncSubrubrosPia` la propaga sola.

## Página de Configuración (`/configuracion`)

La configuración de la cooperadora vive en una página dedicada (`src/app/pages/configuracion/`) con dos tabs:

1. **General** (`ConfigGeneral.svelte`): modalidad de gestión, periodicidad, versión instalada vs actual, revalidar schema, reparar refs, deduplicar personas. Antes estaba como acordeón en Inicio; Inicio ahora muestra un enlace a esta página.
2. **Categorías y subcategorías** (`CategoriasTab.svelte`): listado de rubros PIA (solo lectura, agrupados por `grupo_rubro`) con gestión CRUD completa de subrubros. Los usuarios pueden crear/editar/eliminar subrubros bajo cualquier rubro. El store `categoriasStore.svelte.js` valida duplicados (normalizado) y bloquea eliminación de subrubros en uso por movimientos.

Los rubros PIA oficiales no se editan desde el SPA (tienen códigos y mapeos PDF que no se deben romper). Para agregar rubros nuevos, editar el seed CSV como se describe arriba.


### Formato `campo_pdf` y pools dinámicos ("Otros...")

El PIA (`public/templates/PIA_cooperadoras_editable_2025.pdf`) es un AcroForm con campos fijos. `campo_pdf` soporta 3 formatos:

- **Campo único** (`"Texto47"`): rubro fijo, recibe el monto total del rubro.
- **Un par `"descField|montoField"`**: rubro "Otros" con **1 línea libre** en el PIA. `descField` recibe el nombre del subrubro (o "Varios"), `montoField` el monto.
- **N pares separados por `;`** (`"GASTOS F|Texto33;GASTOS G|Texto34"`): rubro "Otros" con **múltiples líneas libres**. El reparto lo hace `distribuirEnSlots` en `piaFieldMap.js`:
  - 0 subrubros con monto → "Varios" + total en el primer slot.
  - ≤N subrubros → uno por slot, en orden de mayor a menor monto, sin agrupar.
  - \>N subrubros → los primeros (N-1) van individuales; el resto se agrupa como "Varios" en el **último** slot.

Grupos con 2 líneas libres confirmadas (verificado por posición de campos del AcroForm, no solo por el texto impreso): Gastos Alumno (`GA-OTROS`), Gastos Escuela (`GE-OTROS`), Otros Gastos (`OG-OTROS`), Otros Ingresos (`OI-OTROS`). **Gastos Entidad (`GP-OTROS`) es la excepción**: sus 2 líneas libres del papel (`Texto47`, `Texto48`) son campos de **monto únicamente, sin campo de descripción** en el AcroForm — no hay forma de imprimir un nombre de subcategoría ahí, por eso se mantiene como campo único (`Texto47`) y cualquier subrubro que tenga simplemente suma al total sin desglose visible en el PDF.

⚠️ Antes de tocar `campo_pdf` de cualquier rubro, verificar la posición real de los campos del AcroForm (no solo el texto extraído, que puede mezclar el orden de columnas visuales) — es un formulario oficial que la cooperadora presenta a la DGCyE, un error acá corrompe silenciosamente ese formulario. Ver `src/app/modules/tesoreria/cierre/piaFieldMap.test.js` para los casos cubiertos de `distribuirEnSlots`.

### Falta CRUD de subrubros en el SPA

Hoy no hay UI en el SPA para que una cooperadora cree subrubros custom (ej. una subcategoría propia dentro de "Otros gastos (Entidad)"); solo se pueden crear editando la grilla nativa `subrubros` en Grist directamente. Es una mejora pendiente identificada (2026-08-22) para destrabar el caso de uso completo de "el usuario define su propia subcategoría".

## Feature futuro: conciliación bancaria (no implementado)

Idea pendiente para futuro desarrollo (solicitado por usuario 2026-08-22):
- Subir el resumen económico de cuenta del Banco Provincia para conciliación automática de pagos de cuotas societarias.
- Alternativa: precarga guiada subiendo un archivo → grilla de ingresos/egresos → categorización manual del movimiento (el usuario asigna rubro/subrubro a cada línea del resumen).
- No forma parte del scope actual; registrar acá para que no se pierda el contexto cuando se priorice.

