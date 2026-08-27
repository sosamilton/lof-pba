<p align="center">
  <img src="public/favicon.svg" width="120" alt="LOF" />
</p>

<h1 align="center">LOF</h1>

<p align="center">
  <strong>Lazos que Organizan el Futuro</strong><br/>
  Gestión integral para cooperadoras escolares de la Provincia de Buenos Aires.
</p>

<p align="center">
  <a href="https://github.com/sosamilton/spa-cooperadora/blob/main/LICENSE"><img alt="License" src="https://img.shields.io/badge/license-AGPL--3.0-blue.svg" /></a>
  <a href="https://github.com/sosamilton/spa-cooperadora/stargazers"><img alt="Stars" src="https://img.shields.io/github/stars/sosamilton/spa-cooperadora?style=flat" /></a>
  <a href="https://github.com/sosamilton/spa-cooperadora/issues"><img alt="Issues" src="https://img.shields.io/github/issues/sosamilton/spa-cooperadora" /></a>
  <img alt="Svelte 5" src="https://img.shields.io/badge/Svelte-5-ff3e00.svg" />
  <img alt="PouchDB" src="https://img.shields.io/badge/storage-PouchDB%2FCouchDB-e74c3c.svg" />
  <img alt="Tauri" src="https://img.shields.io/badge/desktop-Tauri%202-blueviolet.svg" />
</p>

<p align="center">
  <a href="https://sosamilton.github.io/spa-cooperadora/">Demo</a> ·
  <a href="https://github.com/sosamilton/spa-cooperadora">Repositorio</a> ·
  <a href="docs/">Documentación</a>
</p>

---

LOF es una SPA construida con **Svelte 5** para gestionar cooperadoras escolares de la Provincia de Buenos Aires. Funciona **100% offline** con almacenamiento local (PouchDB/IndexedDB), sincronización opcional con CouchDB, y puede distribuirse como app de escritorio vía **Tauri** (Windows, Linux, macOS).

> Construida con software libre bajo AGPL-3.0. Pensada desde el territorio, para compañeras y compañeros sin conocimientos técnicos.

## Características

<details>
<summary><strong>Configuración inicial</strong></summary>

- **Wizard guiado** paso a paso: módulos, escuela, banco, cargos del estatuto y ejercicio.
- **Validaciones argentinas en tiempo real**: CUE (contra índice oficial de PBA), CUIT/CUIL (checksum oficial), CBU (checksum), DNI, teléfono (formato argentino +54 9), email.
- **Color de marca** como tema primario de la app (conversión a OKLCH para light/dark mode).
- **Bloqueo de datos validados**: una vez validados, los datos institucionales y bancarios no se pueden editar sin re-validar.
- **Módulo Kiosco/Librería** opcional (propio o licitado, con fechas de contrato).

</details>

<details>
<summary><strong>Página de Configuración</strong></summary>

- **General** — modalidad de gestión, periodicidad (mensual, semanal, trimestral, semestral, anual), versión instalada vs. última disponible, revalidar schema, reparar referencias rotas, deduplicar personas por DNI.
- **Categorías y subcategorías** — listado de rubros PIA agrupados por grupo, con CRUD completo de subrubros. Activar/desactivar subrubros sin borrarlos (los desactivados no aparecen al cargar movimientos nuevos, pero siguen asignados a los existentes). Bloqueo de eliminación de subrubros en uso.
- **Reactividad en vivo** — cambios de marca (nombre, color) se reflejan inmediatamente en toda la app sin recargar.

</details>

<details>
<summary><strong>Dashboard de inicio</strong></summary>

- **Situación actual**: foto instantánea del estado operativo — saldos por cuenta (Banco, Efectivo, Caja Chica) en tarjetas individuales con saldo total, última carga de movimientos, período actual, ejercicio en curso y alerta cuando no hay ejercicio activo con CTA a gestionar ejercicios.
- **Resumen ejecutivo**: ejercicio en curso con alerta de vencimiento, cargos obligatorios cubiertos (quórum), socios activos, altas/bajas del último año, vencimientos próximos (60 días), alerta de asamblea AGO (recordatorio en mayo).
- **Tablero de caja**: saldos por cuenta (Banco, Efectivo, Caja Chica) y saldo total.
- **Administración**: cambio de modalidad de gestión, generación automática de períodos, revalidar schema, reparar refs rotas, deduplicar personas por DNI, detección de versión desactualizada.
- **Creación de nuevo ejercicio** automática al cerrar el ejercicio activo (arrastra saldos finales como saldos iniciales del nuevo).

</details>

<details>
<summary><strong>Comunidad</strong></summary>

- **Padrón unificado** — un solo listado de personas y socios con filtros por vínculo (socios/no socios), estado (Activos/Bajas/Todos), tipo de socio (Activo/Honorario/Adherente), tipo de persona (Física/Jurídica) y categoría (Socio/Docente/Directivo/Proveedor/Donante). Badges visuales por persona: Socio Activo/Baja, No socio, Física/Jurídica.
- **Toggle "Es socio"** — desde el mismo formulario de persona, un switch activa los campos de socio (tipo, fecha de alta, baja con motivo). No hace falta ir a otro módulo para dar de alta un socio.
- **Personas físicas y jurídicas** — campos específicos según el tipo: apellido + nombre + DNI + CUIL para físicas; razón social + CUIT para jurídicas.
- **CUIL obligatorio con prefijo pendiente** — cuando solo se carga el DNI, se genera un CUIL con prefijo `00` (pendiente) que no se usa para deduplicación. El usuario puede completar el CUIL real después.
- **Búsqueda instantánea** por apellido, DNI, CUIL, email, teléfono, localidad o domicilio. Vinculación automática al escribir DNI: busca persona existente y la vincula.
- **Bajas y reactivaciones** con motivo (Renuncia, Falta de pago, Fallecimiento, CambioEscuela, Otro). Validación de mayoría de edad y habilitación electoral automática (activo + 30 días de antigüedad).
- **Combobox de localidades** de toda la Provincia de Buenos Aires.
- **Panel de movimientos** de la persona seleccionada (modo gestión integral): muestra los últimos 5 movimientos asociados.
- **Protección multiplayer**: evita duplicados cuando dos usuarios crean la misma persona simultáneamente.
- **Normalización automática**: DNI/CUIL se guardan como dígitos crudos, teléfono con prefijo internacional, email en lowercase.

</details>

<details>
<summary><strong>Tesorería</strong></summary>

- **Movimientos** — entradas, salidas y traspasos con rubro/subrubro según PIA, destino bancario (Cuenta corriente / Plazo fijo), socio o persona asociada, y combobox con búsqueda para listas grandes. Filtrado de rubros por tipo, subrubros dinámicos por rubro. Filtros por rubro, ejercicio, período y persona (ejercicio en curso seleccionado por defecto). Selector de ejercicio con label "en curso". **Comprobantes adjuntos**: subí facturas, recibos o tickets a cada movimiento; los archivos quedan vinculados al movimiento y se pueden descargar o previsualizar cuando quieras.
- **Cuota societaria rápida** — atajo Ctrl+1 o botón para pre-cargar movimiento de cuota social en un click.
- **Gestión por etapas (carga consolidada)** — matriz de carga por rubro con múltiples filas por cuenta (hasta 3), importe en formato pesos argentinos ($ 1.234,56). Layout de dos columnas (lista de períodos + matriz editable) igual que Comunidad. Múltiples cargas por período: cada carga es una carga parcial que se consolida al firmar el período. Selector de carga dentro del período. Firma y cierre a nivel período (bloquea todas las cargas). Reapertura devuelve todas las cargas a borrador. Períodos firmados son read-only.
- **Periodicidad configurable** — elegí con qué frecuencia gestionás la tesorería: mensual, semanal, trimestral, semestral o anual. Se configura en Inicio → Configuración y se aplica a resúmenes, gráficos, tablas y cargas. Las cargas mensuales existentes se agrupan automáticamente en bloques (trimestral/semestral/anual) sin migrar datos. Etiquetas de períodos con rangos de fechas claros (ej: "2027-W17 (07/06 al 14/06)" para semanas, "Ene - Mar 2026" para trimestres).
- **Resumen analítico con tabs** — 5 vistas de análisis con gráficos (LayerChart):
  - **Flujo de caja**: entradas vs salidas por período con saldo acumulado.
  - **Gastos e ingresos**: distribución por rubro, top gastos, comparación entradas/salidas.
  - **Comparativa interanual**: compara el ejercicio actual con cualquier ejercicio anterior (selector flexible para 3+ ejercicios, no limitado a los últimos dos).
  - **Morosidad**: en gestión integral, identifica socios deudores por nombre; en carga consolidada, estima morosidad global. Detecta automáticamente si los movimientos están vinculados a socios o son cargas consolidadas, y si hay una mezcla (cambio de modo a mitad del ejercicio), calcula los deudores solo sobre el tramo con datos identificables.
  - **Salud operativa**: indicadores de carga por período, períodos firmados vs abiertos, tendencia de gastos.
- **Regla "detalle gana"**: si hay movimientos en un período, usa totales de movimientos; si no, usa cierres manuales. Permite mix de carga detallada y consolidada.
- **Cierres mensuales** con firma de período y bloqueo de edición. Agrupación automática de cierres mensuales en bloques según la periodicidad configurada.
- **Validación de no-futuro** — no se pueden crear cargas para períodos futuros. El sistema bloquea cualquier intento de cargar datos adelantados.

</details>

<details>
<summary><strong>Cierre y presentación</strong></summary>

- **PIA en PDF** — generación automática de la Planilla de Ingresos y Aportes desde los movimientos cargados por rubro durante el ejercicio. Mapeo a los campos AcroForm del formulario oficial de PBA, con encabezado, síntesis del acta, nómina de autoridades, cuadro de recursos y gastos, datos bancarios y kiosco.
- **Nómina de autoridades en PDF** — Comisión Directiva (14 cargos), Comisión Revisora de Cuentas y representantes ante la Federación.
- **Cierre automático con próximo ejercicio** — al cerrar el ejercicio activo, el sistema calcula los saldos finales por cuenta, crea el próximo ejercicio automáticamente con esos saldos como saldos iniciales y lo marca como en curso. El botón alterna entre Cerrar y Reabrir sin recargar la página.
- **PIA de ejercicios históricos** — muestra todas las autoridades designadas en el ejercicio seleccionado (no solo las vigentes), permitiendo generar la documentación de ejercicios anteriores correctamente.
- **Alertas accionables** — validación de datos faltantes (asesor, CD, CRC, AGO, movimientos, socios, datos bancarios) con links directos al módulo correspondiente para completarlos antes de generar el documento.
- **Previsualización** antes de descargar, con totales de entradas y salidas del ejercicio.

</details>

<details>
<summary><strong>Institucional</strong></summary>

- **Datos generales** — escuela, cooperadora, banco y kiosco/librería en un solo lugar, con validación de CUIT, CBU y autocompletado de CUE desde el padrón oficial de PBA.
- **Cargos del estatuto** — definición de cargos por organismo (CD, CRC, Federación) con orden, duración, grupo de renovación (A/B para CD, art. 15) y nivel (Titular/Suplente). Sección plegable con nota de que los cambios estructurales requieren asamblea.
- **Autoridades vigentes** — tabla de quién ocupa cada cargo hoy, con fecha de asunción, vencimiento, origen (Asamblea/RCD) y acciones de **Cese** y **Reemplazo** sin salir de la página.
- **Histórico de autoridades** — diálogo con selector de ejercicio y filas expandibles por cargo que muestran la cadena completa de reemplazos a través de todos los ejercicios.
- **Alerta de quórum** — contador de titulares vigentes y alerta si baja del mínimo. Detección de persona en otro cargo del mismo organismo.
- **Asesor institucional** — delegación del director, registro de ceses y histórico.
- **Ejercicios fiscales** — creación, activación y edición de ejercicios con saldos iniciales.

</details>

<details>
<summary><strong>Gobierno</strong></summary>

- **Asambleas** (AGO/AGE/RCD) con resoluciones vinculadas al ejercicio.
- **Carga de autoridades desde el wizard de asambleas** — wizard inline con selección de cargos por organismo (CD, CRC, Federación). Toggle global y por organismo para elegir qué cargos cargar (carga total o parcial). Creación de persona y socio desde el flujo, con validación de CUIL/DNI y PersonaPicker unificado.
- **Histórico de mandatos** — tabla de todos los mandatos por ejercicio (vigentes y cesados), con filtro por organismo. Memoria institucional de quién ocupó cada cargo y desde qué acta.
- **Padrón electoral automático** según estatuto modelo.

> Los ceses, reemplazos y la gestión cotidiana de autoridades vigentes se gestionan desde el módulo **Institucional**.

</details>

<details>
<summary><strong>Experiencia de usuario</strong></summary>

- **Paleta de comandos** (Ctrl+K) tipo VS Code con acciones del módulo actual, navegación y acciones rápidas.
- **Atajos de teclado** completos: Ctrl+N (nuevo), Ctrl+F (buscar), Ctrl+1 (cuota social), Ctrl+I/C/M/R/A (navegación), `/` (enfocar búsqueda), `?` (ayuda).
- **Sidebar dinámico colapsable**: el menú se genera según módulos activos, con atajos de teclado por item.
- **Combobox con búsqueda** y modo "large" para listas grandes (> 50 items, requiere 3 caracteres).
- **Tema dinámico**: la app toma el color de marca de cada cooperadora como tema primario (OKLCH para light/dark). Título de pestaña dinámico con el nombre de la institución.
- **100% offline** — sin dependencias externas, sin CDNs, sin telemetría. Todos los recursos bundleados localmente.

</details>

<details>
<summary><strong>Intercambio descentralizado entre colaboradores</strong></summary>

- **Set de trabajo** — la cooperadora exporta un `.lof` con datos operativos reducidos (rubros, cuentas, personas, ejercicios) para que un colaborador cargue movimientos desde su propio dispositivo.
- **Modo colaborador** — el colaborador instala la PWA desde el setup wizard subiendo el `.lof`, sin configurar nada más. Menú reducido, badge visual, defaults heredados.
- **Patch de movimientos** — al terminar, el colaborador exporta solo lo que él creó (los registros del working set se excluyen automáticamente).
- **Merge aditivo con análisis previo** — la cooperadora analiza el patch (dry-run) viendo altas, deduplicaciones, remap de IDs y conflictos antes de aprobar. El merge nunca borra ni pisa datos existentes.
- **Deduplicación inteligente** — personas por CUIL/DNI, socios por persona, cargas consolidadas por ejercicio+período.
- **Colaboradores en paralelo** — varios colaboradores pueden trabajar sobre el mismo working set; sus patches se mergean secuencialmente con re-validación de estado.
- **Limpieza del dispositivo** — al finalizar, el colaborador puede borrar todos los datos de su dispositivo con un click.

> Ver [`docs/INTERCAMBIO.md`](docs/INTERCAMBIO.md) para el detalle del flujo, perfiles y API.

</details>

<details>
<summary><strong>Arquitectura</strong></summary>

- **Offline-first**: los datos se guardan localmente en PouchDB (IndexedDB del navegador). La app funciona sin conexión a internet.
- **Sync opcional con CouchDB**: cuando hay un servidor CouchDB configurado, PouchDB sincroniza bidireccionalmente y automáticamente. Los cambios locales se replican al servidor y viceversa al reconectar.
- **Capa de datos desacoplada**: `dataRepository.js` es un facade unificado que delega a PouchDB (standalone) o Grist (widget). Todos los stores y módulos importan de ahí, nunca del backend directo.
- **Single source of truth en personas**: socios y autoridades derivan sus datos personales de `persona_id` vía `computedFields.js` (equivalente JS de las fórmulas de Grist). Cambiar una persona actualiza automáticamente todos sus registros vinculados.
- **Desktop vía Tauri**: la misma SPA se empaqueta como app de escritorio para Windows, Linux y macOS, con acceso al filesystem nativo.
- **Backup/restore**: exportación e importación de todos los datos a archivo `.lof` comprimido (gzip). Restauración desde el setup wizard.
- **Intercambio descentralizado**: exportación de sets de trabajo y patches `.lof` para que colaboradores externos carguen movimientos desde su dispositivo y los devuelvan para merge aditivo.
- **Router por hash** con persistencia de última ruta.

</details>

> _Las capturas de pantalla y videos de ejemplo se encuentran en la [landing page](https://sosamilton.github.io/spa-cooperadora/)._

## Inicio rápido

### Opción 1: Docker Compose (recomendado)

```bash
cp .env.example .env   # solo la primera vez
docker compose up      # standalone con CouchDB
```

| Servicio | URL | Rol |
| --- | --- | --- |
| **LOF (Vite)** | `http://localhost:5173` | SPA con hot-reload |
| **CouchDB** | `http://localhost:5984` | Sync server (opcional) |
| **CouchDB Fauxton** | `http://localhost:5984/_utils/` | Admin UI de CouchDB |

Abrir `http://localhost:5173` → aparece la landing → click "Empezar a usar LOF" → completar wizard.

### Opción 2: Local sin Docker

```bash
nvm use 24
npm install
npm run dev          # http://localhost:5173
```

### Opción 3: App de escritorio (Tauri)

```bash
# Build Linux (.deb, .rpm, AppImage) via Docker
bash scripts/tauri-docker-build.sh
```

Los paquetes se generan en `src-tauri/target/release/bundle/`.

> Guía completa de instalación y variables de entorno en [`.env.example`](.env.example) y [`docs/DOCKER.md`](docs/DOCKER.md).

## Desarrollo

```bash
nvm use 24
npm install
npm run dev          # http://localhost:5173
```

```bash
# Con Docker + hot-reload + CouchDB
docker compose up

# Con Docker + Grist (alternativa)
docker compose -f docker-compose.grist.yml up
```

La app guarda los datos localmente en PouchDB (IndexedDB). Para sincronizar con CouchDB, ir a **Configuración → Sincronización** después de instalar.

### Seeder de datos de prueba (dev)

En entorno de desarrollo, el primer paso del setup wizard incluye dos switches para agilizar pruebas:

- **Precargar datos demo en todos los pasos** — rellena automáticamente los campos de cada paso (módulos, escuela, banco, ejercicio, cargos) con datos de ejemplo. Reemplaza al botón "Precargar datos demo" que aparece en cada paso cuando no está activo.
- **Cargar datos de prueba tras instalar** — ejecuta un seeder que genera datos realistas para probar performance de listados, filtros y reportes. El formulario pide primero la **cantidad de ejercicios** (campo principal, siempre editable) y un switch **"Customizar cantidades"**:
  - **Customización apagada** (default): los demás campos (personas, socios, movimientos extra, batch, asambleas) se auto-sugieren según la cantidad de ejercicios y el modo de gestión seleccionado. Los valores se actualizan automáticamente al cambiar el número de ejercicios.
  - **Customización encendida**: todos los campos son editables manualmente.
- **Modo-aware**: el seeder ajusta los datos según el modo de gestión:
  - **Gestión integral**: genera cuota social mensual por socio activo (90% pago, 10% morosidad natural) con importes realistas ($1500-5000 actual, $1000-3000 histórico), vinculada a `socio_id` y `persona_id` para probar morosidad individual. Más movimientos extra para variedad de gastos.
  - **Carga consolidada**: genera movimientos PIA por rubro/cuenta/período con períodos firmados y abiertos. Menos socios porque no hay cuota social individual.
- **Continuidad de autoridades**: cada ejercicio tiene sus autoridades de CD/CRC designadas, con ~60% de continuidad entre ejercicios (misma persona en el mismo cargo) y ~40% de renovación. Los ejercicios anteriores se crean como cerrados con `fecha_cierre`.
- **Mínimo 1 asamblea por ejercicio**: la primera es siempre AGO; si se configuran más, se generan AGE adicionales para probar cambio de autoridades dentro del ejercicio.
- **Estimación en tiempo real**: el formulario muestra cuántos movimientos y asambleas totales se generarán según la configuración.

El seeder solo está disponible cuando `import.meta.env.DEV` es true y no viaja en el bundle de producción.

<p align="center">
  <img src="public/img/install/local-dev/setup-paso1.png" alt="Setup paso 1 con seeder de datos de prueba en dev" width="600" />
</p>

## Documentación

| Documento | Contenido |
| --- | --- |
| [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) | Arquitectura detallada, capas, flujo de datos, capa de datos desacoplada |
| [`docs/ARQUITECTURA_DESCONEXION_GRIST.md`](docs/ARQUITECTURA_DESCONEXION_GRIST.md) | Historial: desacople de Grist → PouchDB/CouchDB + Tauri (completado) |
| [`docs/PATRONES.md`](docs/PATRONES.md) | Patrones de código: runes, stores reactivos, routing, schema |
| [`docs/TECNOLOGIAS.md`](docs/TECNOLOGIAS.md) | Stack tecnológico y justificación de decisiones |
| [`docs/DOCKER.md`](docs/DOCKER.md) | Guía completa de Docker (producción y desarrollo) |
| [`docs/OFFLINE.md`](docs/OFFLINE.md) | Escenarios offline, verificación y migración cloud → local |
| [`docs/INTERCAMBIO.md`](docs/INTERCAMBIO.md) | Intercambio descentralizado `.lof` entre colaboradores |
| [`docs/FEDERACION.md`](docs/FEDERACION.md) | Plan y arquitectura de federación de cooperadoras (futuro) |
| [`docs/modulos/`](docs/modulos/) | Especificación funcional y técnica por módulo |

## Roadmap

| Estado | Item |
| --- | --- |
| Listo | PIA y Nómina en PDF — generación automática desde los datos del ejercicio |
| Listo | Comunidad unificada y carga de autoridades desde asambleas — padrón unificado con toggle de socio, wizard inline con selección por organismo |
| Listo | Módulo Institucional — separación de la información formal como módulo de primera clase, con cargos, autoridades vigentes, ceses, reemplazos e histórico interactivo |
| Listo | Cargas consolidadas con firma a nivel período — múltiples cargas por período, firma/cierre a nivel período, resumen semanal secuencial, layout de dos columnas en gestión por etapas |
| Listo | Dashboard de inicio con situación actual — saldos por cuenta, última carga, período actual, alerta de ejercicio sin activar |
| Listo | Resumen analítico con tabs y gráficos — flujo de caja, gastos/ingresos, comparativa interanual, morosidad y salud operativa |
| Listo | Cierre automático con próximo ejercicio — al cerrar el activo, crea el siguiente con saldos arrastrados |
| Listo | Periodicidad configurable — mensual, semanal, trimestral, semestral o anual, con agrupación automática de cargas existentes |
| Listo | Morosidad inteligente — detecta datos mixtos (vinculados + no vinculados) y calcula deudores solo sobre el tramo identificable |
| Listo | Comprobantes adjuntos a movimientos — subí facturas, recibos o tickets a cada movimiento y descargalos cuando quieras |
| Listo | Página de Configuración — modalidad, periodicidad, categorías y subcategorías con activar/desactivar, mantenimiento de datos |
| Listo | Desacople de Grist — capa de datos abstracta con PouchDB (local) + sync opcional con CouchDB |
| Listo | App de escritorio vía Tauri — empaquetado para Windows, Linux y macOS |
| Listo | Backup/restore — exportación e importación de datos a archivo .lof comprimido |
| Listo | Sync con CouchDB — replicación bidireccional opcional desde Configuración |
| Listo | Intercambio descentralizado `.lof` — sets de trabajo para colaboradores, patches con merge aditivo y deduplicación |
| Próximo | Actas de Comisión Directiva — carga guiada de actas de CD con resoluciones vinculadas al ejercicio |
| Próximo | Accesos y roles — auth con backend ligero, permisos por tesorería, comisión, asesoría |
| Después | Balance de tesorería exportable |
| Futuro | App móvil — consulta de saldos, movimientos, notificaciones |
| Futuro | Conciliación bancaria — carga de resúmenes del Banco Provincia y conciliación automática o guiada |
| Futuro | Integraciones — DIPREGEP y herramientas de gestión escolar |

> El detalle completo de funcionalidades, capturas y lo que viene está en la [landing page](https://sosamilton.github.io/spa-cooperadora/).

## Stack

**Svelte 5** (runes) · **Vite 8** · **Tailwind CSS 4** · **shadcn-svelte** + **bits-ui** · **PouchDB** (local) · **CouchDB** (sync opcional) · **Tauri 2** (desktop) · **Docker** + **nginx** · **Vitest**

## Contribuir

Las contribuciones son bienvenidas. Abrí un [issue](https://github.com/sosamilton/spa-cooperadora/issues) o un PR en el [repositorio](https://github.com/sosamilton/spa-cooperadora).

## Licencia

[AGPL-3.0](LICENSE) — Software libre. La comunidad puede auditar, modificar y distribuir.
