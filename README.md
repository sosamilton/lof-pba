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
  <img alt="Grist" src="https://img.shields.io/badge/backend-Grist-d4a928.svg" />
</p>

<p align="center">
  <a href="https://sosamilton.github.io/spa-cooperadora/">Demo</a> ·
  <a href="https://github.com/sosamilton/spa-cooperadora">Repositorio</a> ·
  <a href="docs/">Documentación</a> ·
  <a href="https://www.getgrist.com/">Grist</a>
</p>

---

LOF es una SPA construida con **Svelte 5** que funciona como *Custom Widget* dentro de un documento [Grist](https://www.getgrist.com/). No tiene backend propio: lee y escribe directamente en las tablas del documento. Pensada para funcionar **100% offline**, sin CDNs, APIs externas ni telemetría.

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
<summary><strong>Dashboard de inicio</strong></summary>

- **Resumen ejecutivo**: ejercicio en curso con alerta de vencimiento, cargos obligatorios cubiertos (quórum), socios activos, altas/bajas del último año, vencimientos próximos (60 días), alerta de asamblea AGO (recordatorio en mayo).
- **Tablero de caja**: saldos por cuenta (Banco, Efectivo, Caja Chica) y saldo total.
- **Administración**: cambio de modalidad de gestión, generación automática de períodos, revalidar schema, reparar refs rotas, deduplicar personas por DNI, detección de versión desactualizada.
- **Creación de nuevo ejercicio** automática (2 meses antes del vencimiento del actual).

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

- **Movimientos** — entradas, salidas y traspasos con rubro/subrubro según PIA, destino bancario (Cuenta corriente / Plazo fijo), socio o persona asociada, y combobox con búsqueda para listas grandes. Filtrado de rubros por tipo, subrubros dinámicos por rubro. Filtros por rubro, ejercicio, período y persona (ejercicio en curso seleccionado por defecto).
- **Cuota societaria rápida** — atajo Ctrl+1 o botón para pre-cargar movimiento de cuota social en un click.
- **Carga PIA consolidada** — matriz de carga por rubro con múltiples filas por cuenta (hasta 3), importe en formato pesos argentinos ($ 1.234,56), página dedicada con selector de período, todos los períodos del ejercicio visibles (incluso vacíos), confirmación de firma con resumen read-only de movimientos y totales, y firma de períodos (bloqueo de edición).
- **Resumen** — vista mensual y semanal con arrastre de saldo, saldos iniciales por ejercicio, badge de estado por período (Falta cargar / Abierto / Firmado), botón de edición directa a la carga PIA, y cálculo del próximo período adeudado.
- **Regla "detalle gana"**: si hay movimientos en un período, usa totales de movimientos; si no, usa cierres manuales. Permite mix de carga detallada y consolidada.
- **Cierres mensuales** con firma de período y bloqueo de edición.

</details>

<details>
<summary><strong>Cierre y presentación</strong></summary>

- **PIA en PDF** — generación automática de la Planilla de Ingresos y Aportes desde los movimientos cargados por rubro durante el ejercicio. Mapeo a los campos AcroForm del formulario oficial de PBA, con encabezado, síntesis del acta, nómina de autoridades, cuadro de recursos y gastos, datos bancarios y kiosco.
- **Nómina de autoridades en PDF** — Comisión Directiva (14 cargos), Comisión Revisora de Cuentas y representantes ante la Federación.
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
<summary><strong>Arquitectura</strong></summary>

- **Single source of truth en personas**: socios y autoridades tienen columnas que son fórmulas de Grist (pull de `$persona_id`), no datos almacenados. Cambiar una persona actualiza automáticamente todos sus registros vinculados.
- **Migraciones automáticas**: `ensureSchema` detecta columnas que necesitan convertirse a fórmulas y las migra. Reparación de refs rotas, migración de datos legacy y deduplicación de personas por DNI.
- **Router por hash** con persistencia de última ruta en widget options de Grist.
- **Fórmulas de Grist**: período (desde fecha), activo en socios (!fecha_baja), habilitado electoral, saldo inicial total del ejercicio.

</details>

> _Las capturas de pantalla y videos de ejemplo se encuentran en la [landing page](https://sosamilton.github.io/spa-cooperadora/)._

## Inicio rápido

```bash
cp docker/grist/grist.env.example .env   # solo la primera vez
docker compose up -d --build
```

| Servicio | URL | Rol |
| --- | --- | --- |
| **Grist** | `http://localhost:8089` | Backend — documento SQLite con todas las tablas |
| **LOF** | `http://localhost:8088` | Frontend — la SPA servida por nginx |

**Pasos:** abrir Grist → crear documento → `Add New` → `Add Widget to Page` → `Custom` → pegar URL `http://localhost:8088` → `Full document access` → completar wizard.

> Guía completa de instalación, variables de entorno y troubleshooting en [`docs/DOCKER.md`](docs/DOCKER.md).

## Desarrollo

```bash
npm install
npm run dev          # http://localhost:5173
```

```bash
# Con Docker + hot-reload
docker compose -f docker-compose.dev.yml up
```

> Fuera de Grist la app muestra la landing pública. Para probar con datos reales, cargarla como Custom Widget en un documento Grist. Ver [`docs/DOCKER.md`](docs/DOCKER.md) y [`docs/OFFLINE.md`](docs/OFFLINE.md).

### Seeder de datos de prueba (dev)

En entorno de desarrollo, el primer paso del setup wizard incluye dos switches para agilizar pruebas:

- **Precargar datos demo en todos los pasos** — rellena automáticamente los campos de cada paso (módulos, escuela, banco, ejercicio, cargos) con datos de ejemplo. Reemplaza al botón "Precargar datos demo" que aparece en cada paso cuando no está activo.
- **Cargar datos de prueba tras instalar** — ejecuta un seeder que genera personas, socios, movimientos, una asamblea AGO y autoridades de CD/CRC con todas las Refs resueltas, para probar performance de listados y filtros. Al activarlo se despliega un formulario para customizar las cantidades de cada entidad (personas, socios, movimientos y tamaño de lote), con valores por defecto de 500/400/2000/100.

Si no se seleccionan los checkboxes, cada paso muestra un botón **"Precargar datos demo"** que rellena solo ese paso, permitiendo editar los valores o ajustar configuraciones antes de continuar. El seeder solo está disponible cuando `import.meta.env.DEV` es true y no viaja en el bundle de producción.

<p align="center">
  <img src="public/img/install/local-dev/setup-paso1.png" alt="Setup paso 1 con seeder de datos de prueba en dev" width="600" />
</p>

## Documentación

| Documento | Contenido |
| --- | --- |
| [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) | Arquitectura detallada, capas, flujo de datos, integración con Grist |
| [`docs/PATRONES.md`](docs/PATRONES.md) | Patrones de código: runes, stores reactivos, routing, schema |
| [`docs/TECNOLOGIAS.md`](docs/TECNOLOGIAS.md) | Stack tecnológico y justificación de decisiones |
| [`docs/DOCKER.md`](docs/DOCKER.md) | Guía completa de Docker (producción y desarrollo) |
| [`docs/OFFLINE.md`](docs/OFFLINE.md) | Escenarios offline, verificación y migración cloud → local |
| [`docs/modulos/`](docs/modulos/) | Especificación funcional y técnica por módulo |

## Roadmap

| Estado | Item |
| --- | --- |
| Listo | PIA y Nómina en PDF — generación automática desde los datos del ejercicio |
| Listo | Comunidad unificada y carga de autoridades desde asambleas — padrón unificado con toggle de socio, wizard inline con selección por organismo |
| Listo | Módulo Institucional — separación de la información formal como módulo de primera clase, con cargos, autoridades vigentes, ceses, reemplazos e histórico interactivo |
| Próximo | Adjuntos y actas — carga guiada de comprobantes con trazabilidad |
| Después | Balance de tesorería exportable |
| Después | Accesos y roles — permisos por tesorería, comisión, asesoría |
| Futuro | App móvil — consulta de saldos, movimientos, notificaciones |
| Futuro | Conciliación bancaria — carga de resúmenes del Banco Provincia y conciliación automática o guiada |
| Futuro | Integraciones — DIPREGEP y herramientas de gestión escolar |

> El detalle completo de funcionalidades, capturas y lo que viene está en la [landing page](https://sosamilton.github.io/spa-cooperadora/).

## Stack

**Svelte 5** (runes) · **Vite 8** · **Tailwind CSS 4** · **shadcn-svelte** + **bits-ui** · **Grist** (backend) · **Docker** + **nginx** · **Vitest**

## Contribuir

Las contribuciones son bienvenidas. Abrí un [issue](https://github.com/sosamilton/spa-cooperadora/issues) o un PR en el [repositorio](https://github.com/sosamilton/spa-cooperadora).

## Licencia

[AGPL-3.0](LICENSE) — Software libre. La comunidad puede auditar, modificar y distribuir.
