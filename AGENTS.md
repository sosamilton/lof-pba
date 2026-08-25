# Project Rules

## Arquitectura de datos (importante)

LOF tiene una **capa de datos desacoplada**. Todos los stores y módulos importan de `dataRepository.js` (facade unificado), nunca del backend directo.

### Backends soportados

| Backend | Modo | Detección | Storage |
|---------|------|-----------|---------|
| **PouchDB** | Standalone (default) | No está en iframe | IndexedDB del navegador |
| **Grist** | Custom Widget | `window.self !== window.top` | Documento Grist (SQLite) |

### Sync con CouchDB (opcional)

- PouchDB puede sincronizar bidireccionalmente con CouchDB.
- **Desactivado por defecto**. Se activa desde Configuración → Sincronización o con `VITE_SYNC_ENABLED=true`.
- `pouchSync.js` maneja la replicación (live + retry + conflict resolution nativo).
- `syncStore.svelte.js` gestiona la config (URL, credenciales, auto-sync).

### Backup/restore

- `src/core/data/backup.js` — exportación a `.lof` (gzip) e importación.
- Exportar: Configuración → General → Backup y restauración.
- Importar: Setup wizard → primera página → "¿Tenés un backup?".

### Desktop vía Tauri

- `src-tauri/` — configuración de Tauri 2.
- Build Dockerizado: `scripts/tauri-docker-build.sh` (genera .deb, .rpm, AppImage).

### Reglas para cambios de código

- **Nunca** importar directamente de `grist/grist.js` o `pouchRepository.js` en stores o módulos. Siempre usar `dataRepository.js`.
- `src/core/grist/` se mantiene para compatibilidad con el modo Grist Widget. No eliminar.
- `computedFields.js` contiene los equivalentes JS de las fórmulas de Grist. Si se agrega una columna formula al schema, agregar su equivalente JS acá.
- `TABLE_PREFERRED_IDS` (en `utils.js`) mapea keys lógicas a IDs físicos. Funciona para ambos backends.

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

Grupos con 2 líneas libres confirmadas (verificado por posición de campos del AcroForm, no solo por el texto impreso): Gastos Alumno (`GA-OTROS` → `GASTOS F|Texto33;GASTOS G|Texto34`), Gastos Escuela (`GE-OTROS` → `GASTOS H|Texto42;GASTOS I|Texto43`), Gastos Entidad (`GP-OTROS` → `GASTOS D|Texto54;GASTOS E|Texto55`), Otros Gastos (`OG-OTROS` → `Texto50|Texto56;Texto49|Texto57`), Otros Ingresos (`OI-OTROS` → `INGRESO A|Texto26;INGRESO B|Texto27`). Los 5 rubros "Otros..." tienen 2 slots libres con campo de descripción + monto.

### Fix histórico de mapeo PDF (2026-08-23)

**Bug corregido:** Los rubros GP (Gastos propios de la Entidad) estaban mapeados a `Texto44-47` (campos del RESUMEN ANUAL, columna izquierda) en lugar de `Texto51-53` + `GASTOS D|Texto54;GASTOS E|Texto55` (columna derecha, SALIDAS). `OG-OTROS` estaba mapeado a los campos de `GP-OTROS` en lugar de los suyos (`Texto50|Texto56;Texto49|Texto57`). Esto causaba que el PIA se rellenara con valores completamente incorrectos: los montos de rifas/festivales/kiosco iban al RESUMEN ANUAL, y "Otros gastos" pisaba las líneas d/e de "Gastos propios de la Entidad".

**Corrección:**
- Seed CSV (`public/seeds/rubros_pia.csv`): mapeos correctos.
- `CAMPO_PDF_CORRECTO` en `cierreDataService.js`: mismo mapeo como fixup runtime.
- `fixRubrosPiaCampoPdf` en `migracion.js`: corrige instalaciones existentes via `UpdateRecord` (idempotente, solo actualiza si el valor actual coincide con el viejo incorrecto).
- `piaFieldMap.js`: agrega RESUMEN ANUAL (`Texto44-48`) con totales/saldos calculados desde `saldoEjercicioAnterior`.
- `cierreDataService.js`: agrega `saldoEjercicioAnterior` al retorno.

⚠️ Antes de tocar `campo_pdf` de cualquier rubro, verificar la posición real de los campos del AcroForm (no solo el texto extraído, que puede mezclar el orden de columnas visuales) — es un formulario oficial que la cooperadora presenta a la DGCyE, un error acá corrompe silenciosamente ese formulario. Ver `src/app/modules/tesoreria/cierre/piaFieldMap.test.js` para los casos cubiertos de `distribuirEnSlots`.

### CRUD de subrubros en el SPA

La página de Configuración tiene un tab "Categorías y subcategorías" con CRUD completo de subrubros. Los usuarios pueden crear/editar/eliminar subrubros bajo cualquier rubro. El store `categoriasStore.svelte.js` valida duplicados (normalizado) y bloquea eliminación de subrubros en uso por movimientos. Además tiene `toggleSubrubroActivo` para activar/desactivar (soft-delete: no se elimina, solo se oculta del selector de movimientos). El selector de subrubros en `Movimientos.svelte` filtra inactivos, salvo el que ya está seleccionado en el form (para no ocultar un subrubro asignado a un movimiento existente).

### configStore reactivo (brand/tema en vivo)

`configStore` (`src/core/grist/stores/configStore.svelte`) cachea la config de la cooperadora. `AppShell.svelte` tiene un `$effect` que reacciona a `configStore.config` para actualizar brand (título/subtítulo) y tema (color primario) en vivo sin recargar. Cualquier cambio de config (color, título, cuenta default) debe llamar `configStore.load()` después de guardar para refrescar el cache. `cooperadoraStore.saveCooperadora` e `inicioStore.onAppTitleChange` también sincronizan la tabla `escuela` (fuente de verdad) al guardar.

## Estatuto de la cooperadora (PDF adjunto + historial de versiones)

El estatuto de la cooperadora usa un modelo de **tabla dedicada** (`estatutos`) que conserva el historial completo de versiones. La tabla `escuela` tiene `estatuto_actual_id` (Ref:estatutos) que apunta a la versión vigente, y `estatuto_validado` (Bool) que bloquea la edición.

### Modelo de datos

- **Tabla `estatutos`**: una fila por versión del estatuto. Columnas: `estatuto` (Attachments, el PDF), `fecha_desde` (Date, fecha de vigencia), `asamblea_id` (Ref:asambleas, asamblea que aprobó esta versión), `notas` (Text).
- **`escuela.estatuto_actual_id`** (Ref:estatutos): apunta al registro vigente. Al reemplazar el estatuto, se crea un nuevo registro en `estatutos` y se actualiza esta ref. El registro anterior queda como histórico.
- **`escuela.estatuto_validado`** (Bool): cuando está en true, bloquea la edición del PDF. Solo se desbloquea al guardar una AGE con motivo "Reforma estatuto" (igual que los cargos del estatuto).

### Flujo

1. **Upload**: `EstatutoField.svelte` valida que el archivo sea PDF y usa `uploadAttachments([file])` para subirlo a Grist.
2. **Guardado**: `cooperadoraStore.saveEstatuto(attId)` crea un registro en `estatutos` (con el attachment, `fecha_desde` = hoy, `asamblea_id` = la AGE de reforma pendiente si la hay) y actualiza `escuela.estatuto_actual_id` para apuntar al nuevo registro. El registro anterior queda como histórico.
3. **Validación**: `cooperadoraStore.validarEstatuto()` setea `estatuto_validado = true`. Una vez validado, el componente bloquea la edición.
4. **Desbloqueo**: al guardar una AGE con motivo "Reforma estatuto", `asambleasManager` invoca `onReformaEstatuto(asambleaId)` → `cooperadoraStore.desbloquearEstatuto(asambleaId)` que setea `estatuto_validado = false` y guarda el `asambleaId` para vincularlo al próximo registro de estatuto que se cree. También desbloquea los cargos (`desbloquearCargos`).
5. **Lectura**: `cooperadoraStore.estatutoVigente` resuelve el registro vigente desde `estatuto_actual_id`. `estatutoVigenteAttachmentId` extrae el ID del attachment. `estatutos` (getter) devuelve todas las versiones ordenadas por `fecha_desde` descendente.
6. **Descarga**: usa `getAttachmentUrl(attId)` con token fresco al click, igual que comprobantes de movimientos.
7. **Historial**: el tab "Estatuto" en Institucional muestra una card "Historial de versiones" con todas las versiones, marcando la vigente con un Badge.

### Migración desde modelo legacy

El modelo original guardaba el PDF directamente en `escuela.estatuto` (tipo Attachments, sin historial). `migrarEstatutoATabla` en `migracion.js` mueve el attachment legacy a un registro en `estatutos` y vincula `estatuto_actual_id`. Es idempotente: si `estatuto_actual_id` ya está seteado, no hace nada. Se invoca desde `inicioStore.check()` una sola vez por sesión. La columna `escuela.estatuto` legacy queda como orphan en Grist (no se elimina, pero el schema ya no la declara).

### Bug histórico de tipo (2026-08-24)

El commit e3ee918 definió `escuela.estatuto` con `type: "Attachment"` (singular, inválido en Grist). El tipo correcto es `Attachments` (plural). Esto causaba `AttributeError: module 'grist' has no attribute 'Attachment'` en el sandbox. `fixEstatutoColumnType` en `migracion.js` repara instalaciones existentes via `ModifyColumn`. Con el nuevo modelo (tabla `estatutos`), este bug ya no aplica para instalaciones nuevas, pero la migración reparadora se mantiene para instalaciones legacy.

## Attachments de Grist (comprobantes de movimientos)

Los movimientos pueden tener comprobantes adjuntos (facturas, recibos, tickets). El flujo es:

1. **Upload**: `uploadAttachments(files)` en `src/core/grist/grist.js` hace POST multipart a `/api/docs/{docId}/attachments?auth=<jwt>` via proxy same-origin `/grist-api/`. Devuelve `[attId]`.
2. **Vinculación**: al guardar el movimiento, `toAttachmentCellValue(ids)` convierte los IDs al formato Attachments de Grist: `["L", id1, id2, ...]` (designador `L` como primer elemento, IDs como números planos — **NO** pares `["L", id]` anidados, eso causa `#KeyError`). Se guarda en la celda `comprobante` del registro.
3. **Lectura**: `extractAttachmentIds(value)` extrae los IDs del formato Grist de vuelta a un array plano.
4. **Descarga**: `getAttachmentUrl(attId)` genera la URL del proxy con token fresco. El token de `getAccessToken()` expira a los 15 min, así que la URL se genera al momento del click (en `handleDownload`), no al cargar el componente.

### Auth de attachments: 3 capas

1. **docId truncado**: Grist self-hosted puede devolver `baseUrl` con el docId truncado en `getAccessToken()`. `getApiContext()` decodifica el JWT y usa `payload.docId` como fuente de verdad.
2. **CSRF**: el access token se envía como `?auth=<jwt>` (formato que Grist espera para access tokens, no `Authorization: Bearer` que es para API keys). Los POST con access token son tratados como anónimos para CSRF — requieren header `X-Requested-With: XMLHttpRequest`.
3. **Cross-origin**: el header `X-Requested-With` dispara preflight CORS del browser. Grist rechaza cross-origin con credenciales. El proxy (Vite dev, nginx prod) strips el header `Origin` antes de forwardear para que Grist no vea el request como cross-origin.

### Proxy de attachments

- **Dev (Vite)**: `vite.config.js` proxy `/grist-api` → `GRIST_PROXY_TARGET || http://localhost:8489`, rewrite strips `/grist-api` prefix, `configure` remueve headers `Origin` y `Referer`.
- **Prod (nginx)**: `docker/nginx.conf` location `/grist-api/` → `http://grist:8484/`, `proxy_set_header Origin ""`.
- **Docker**: `docker-compose.dev.yml` setea `GRIST_PROXY_TARGET=http://grist:8484` (Grist accesible por nombre de servicio dentro de la red Docker).

### Attachments huérfanos

Si se sube un archivo y se cancela el movimiento sin guardar, el archivo queda huérfano en la tabla `_grist_Attachments` (existe pero no está referenciado por ninguna celda). Esto es el mismo comportamiento de la UI nativa de Grist. Grist tiene `/attachments/removeUnused` para limpiar huérfanos periódicamente. No se hace cleanup automático al cancelar porque no hay endpoint para borrar un attachment individual por ID, y `removeUnused` borraría attachments de otros formularios abiertos simultáneamente.

## Fechas: usar todayISO(), no toISOString().slice(0,10)

`new Date().toISOString()` devuelve UTC. En Argentina (UTC-3), después de las 21:00 la fecha UTC es el día siguiente, lo que hacía que los forms defaultearan a mañana y fallaran validación de "fecha futura". `todayISO()` (en `src/core/utils/utils.js`) usa la fecha local del browser. Usar siempre `todayISO()` para defaults de formularios, nunca `new Date().toISOString().slice(0, 10)`.

## Campos legacy removidos (2026-08-24)

Los siguientes campos fueron removidos del schema y del código por no tener uso:
- `movimientos.fuera_de_termino` (Bool) — sin lógica asociada, generaba ruido en saludOperativa
- `movimientos.periodo_cerrado` (Bool) — sin uso
- `rubros_pia.es_traspaso` (Bool) — era siempre false
- `escuela.email_asesor` (Text) — se usa del asesor via persona_id
- `escuela.telefono_asesor` (Text) — ídem

`ensureSchema` no elimina columnas existentes en Grist (solo agrega faltantes). Si una instalación tiene estos campos, quedan como columnas orphan en Grist pero no afectan funcionamiento.

## Feature futuro: conciliación bancaria (no implementado)

Idea pendiente para futuro desarrollo (solicitado por usuario 2026-08-22):
- Subir el resumen económico de cuenta del Banco Provincia para conciliación automática de pagos de cuotas societarias.
- Alternativa: precarga guiada subiendo un archivo → grilla de ingresos/egresos → categorización manual del movimiento (el usuario asigna rubro/subrubro a cada línea del resumen).
- No forma parte del scope actual; registrar acá para que no se pierda el contexto cuando se priorice.

