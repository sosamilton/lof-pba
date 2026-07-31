# Recursos oficiales de la Dirección de Cooperación Escolar (PBA)

Análisis de los recursos encontrados en el Linktree oficial de la Dirección de Cooperación y Participación Comunitaria de la Provincia de Buenos Aires, con evaluación de utilidad para el sistema de gestión de cooperadoras.

---

## Fuentes oficiales

- **Linktree oficial**: https://linktr.ee/direcciondecooperacionescolar
- **Sitio ABC Cooperación Escolar**: https://abc.gob.ar/secretarias/areas/subsecretaria-de-educacion/cooperacion-y-participacion-comunitaria/cooperacion-y
- **Subdirección de Cooperación Escolar**: https://abc.gob.ar/secretarias/areas/subsecretaria-de-educacion/cooperacion-y-participacion-comunitaria/cooperacion-escolar
- **Mapa Escolar de Cooperadoras**: https://mapaescolar.abc.gob.ar/mapaescolar/cooperadoras
- **Contacto**: dcooperacionescolar@abc.gob.ar | 2215609647 (solo mensajes)
- **Subdirectora**: Silvina Cotignola

---

## 1. GeoJSON del Mapa Escolar de Cooperadoras

Archivos descargados en `docs/`:
- `Cooperadoras activas 31-07-2026.geojson` (7.1 MB)
- `Cooperadoras inactivas 31-07-2026.geojson` (1.6 MB)

### Volumen

| Estado | Cantidad |
|--------|----------|
| Activas | 9.336 |
| Inactivas | 2.077 |
| **Total** | **11.413** |

### Propiedades de cada feature

```
idserv, cueanexo, clave, id_region_educativa, region_educativa,
id_distrito, distrito, calle, nro_calle, localidad, codigo_postal,
nombre, tipo_organizacion, nro_establecimiento, acto_reconocimiento,
fecha_rec, estado, fecha_actualizacion, longitud, latitud
```

### Cobertura geográfica

- **135 distritos** de la PBA
- **25 regiones educativas** (Región I a XXV)

### Tipos de organización (top 10)

| Tipo | Cantidad |
|------|----------|
| Escuela de Educación Primaria | 3.356 |
| Jardín de Infantes | 2.228 |
| Escuela de Educación Secundaria | 1.563 |
| Escuela de Educación Especial | 322 |
| Escuela de Educación Secundaria Técnica | 250 |
| Centro de Formación Profesional | 238 |
| Instituto Superior de Formación Docente y Técnica | 186 |
| Centro de Educación Física | 162 |
| Centro Educativo de Nivel Secundario (C.E.N.S.) | 161 |
| Centro de Educación Complementaria | 157 |

### Utilidad para el sistema

**Alta**. Este dataset puede usarse para:

1. **Autocompletar datos de la escuela** al ingresar el CUE o el nombre. La cooperadora se vincula a una escuela específica, y este dataset tiene todos los datos institucionales (distrito, región, dirección, localidad, CUE).
2. **Validar el CUE** contra el padrón oficial.
3. **Selector de distrito** con los 135 distritos reales de la PBA en lugar de texto libre.
4. **Georreferenciación**: cada feature tiene latitud/longitud, lo que permitiría mostrar un mapa de cooperadoras.
5. **Estadísticas comparativas**: cantidad de cooperadoras por distrito, región, tipo de escuela.
6. **Verificación de estado**: si una cooperadora aparece como "Inactiva" en el padrón oficial, el sistema podría alertar.

### Campos mapeables al schema actual

| Campo GeoJSON | Tabla schema | Columna |
|---------------|-------------|---------|
| `cueanexo` | escuela | cue |
| `distrito` | escuela | distrito |
| `nombre` | escuela | escuela_nombre |
| `nro_establecimiento` | escuela | escuela_numero |
| `calle` + `nro_calle` | escuela | domicilio |
| `localidad` | escuela | localidad |
| `codigo_postal` | *(nuevo campo)* | codigo_postal |
| `region_educativa` | *(nuevo campo)* | region_educativa |
| `tipo_organizacion` | *(nuevo campo)* | tipo_organizacion |
| `longitud` / `latitud` | *(nuevos campos)* | coordenadas |

---

## 2. Manual de Formación y Fortalecimiento para Cooperadoras Escolares (2025)

**Archivo**: `docs/oficiales_abc/Manual_Cooperadoras_2025_actualizado.pdf` (39 páginas)

### Estructura del manual

1. **Instructivo de creación y reconocimiento** de asociaciones cooperadoras
2. **Documentación necesaria** para funcionamiento
3. **Modelos de referencia** para actas y registros

### Contenido clave para el sistema

#### Ciclo de vida de la cooperadora

1. **Asamblea Constitutiva** → comisión provisoria → reconocimiento oficial
2. **Asamblea Extraordinaria** (40 días después) → aprobación de estatuto, elección de CD definitiva
3. **Asamblea Anual Ordinaria** (mayo, antes del vencimiento de mandatos al 30/07) → memoria, balance, elección

#### Libros obligatorios

| Libro | Responsable | Contenido |
|-------|-------------|-----------|
| Actas | Secretario/a | Todo lo que ocurre en reuniones y asambleas |
| Socias y Socios | Tesorero/a | Registro de socios con cuotas pagadas |
| Tesorería | Tesorero/a | Ingresos y egresos mensuales + balance anual |
| Inventario | CD | Bienes muebles: altas y bajas |

Todos deben estar **foliados y rubricados** por el Consejo Escolar. Conservarse por **10 años**.

#### Reglas de socios

- Socio activo: mayor de edad que paga la cuota social
- Antigüedad mínima de **30 días** para tener voz y voto en asamblea
- Deja de ser socio automáticamente si adeuda **más de 3 meses** de cuota
- La cuota social no se abona por alumno (una familia con varios hijos paga una sola cuota)
- Nadie puede hacerse representar en la asamblea

#### Reglas de cuota social

- Se fija en la asamblea
- Si es anual, debe pagarse la totalidad (no se puede fraccionar)
- Si es mensual, se paga mes a mes
- Recomendación: fijar monto accesible para maximizar participación

#### Caja chica

- Único dinero en efectivo que puede manejar la CD
- Para gastos menores y urgentes
- Monto máximo fijado en asamblea
- La maneja el/la Tesorero/a
- No es mensual: se renueva cuando se agota

#### Renuncias

- Deben ser de puño y letra
- Se tratan en reunión de CD
- Se ofrece cargo al vice/pro según corresponda, luego a vocales
- Los corrimientos son **provisionales**: en la próxima asamblea los miembros vuelven a sus cargos originales
- Se debe enviar: renuncia original, copia de acta, nueva nómina

#### Incompatibilidades

Presidente, Tesorero, Asesor y Revisor de Cuentas: incompatibles para cónyuges y parientes hasta 2º grado de consanguinidad.

#### Disolución

Causales: cierre definitivo de la escuela, caudal societario reducido al mínimo de CD, imposibilidad de cumplir fines.

Procedimiento: asamblea disolutoria → inventario → balance final → cierre de cuenta bancaria → entrega de bienes al Consejo Escolar.

#### Conciliación bancaria

Cuando el saldo bancario no coincide con el libro de tesorería:
- Saldo según Banco
- Menos cheques no debitados
- Más depósitos no acreditados
- = Saldo según libro

#### Modelo de balance de tesorería

Estructura del DEBE (entradas):
- Cuota social
- Bono contribución
- Rifas
- Festival/Evento/Quermese
- Kiosco

Estructura del HABER (salidas):
- Gastos para el/la alumno/a
- Gastos para la escuela
- Gastos propios de la entidad

Firmas obligatorias en balance mensual: Presidente, Secretario, Asesor, Revisor Docente, Revisor Titular, Tesorero.

---

## 3. Modelo de Estatuto de Asociaciones Cooperadoras

**Archivo**: `docs/oficiales_abc/Modelo_estatuto_cooperadoras.pdf` (10 páginas)

### Artículos clave

- **Art. 3**: CD mínima = Presidente, Vicepresidente, Secretario, Prosecretario, Tesorero, Protesorero, 3 Vocales Titulares, 2 Vocales Suplentes
- **Art. 7**: Socios Activos (pagan cuota, voz y voto), Adherentes (sólo voz), Honorarios (por distinción)
- **Art. 15**: Duración de mandatos = 2 años, renovación por mitades
- **Art. 16**: Incompatibilidad Presidente/Tesorero para cónyuges y parientes hasta 2º grado
- **Art. 17**: Comisión Revisora = 2 titulares + 1 suplente. Uno titular es docente designado por Director.
- **Art. 18**: Asesor = Director del establecimiento. Tiene voz pero no voto.
- **Art. 26**: Socios activos con 30 días de antigüedad mínima para voz y voto en asambleas
- **Art. 27**: Convocatoria a Asamblea Ordinaria con 30 días corridos de anticipación
- **Art. 30**: Quórum = 50% de socios activos. Una hora después, sesión con mín. igual al número de miembros de CD
- **Art. 31**: Decisiones por simple mayoría. Reforma de estatuto, memoria/balance y cuota social = mayoría absoluta. Disolución = 80%
- **Art. 35**: Nadie puede hacerse representar en asamblea
- **Art. 37**: Elección por votación nominal, directa y pública (a mano alzada)
- **Art. 42**: Causales de disolución
- **Art. 44**: Envío anual de balance, memoria, nómina y acta a la Dirección de Cooperación Escolar dentro de los 15 días de la asamblea

### Diferencia con el schema actual

El estatuto modelo incluye **Vicepresidente, Prosecretario y Protesorero** como cargos del estatuto mínimo. El schema actual no los tiene preconfigurados en la tabla `cargos` (aunque es configurable). Verificar que el seed de cargos incluya estos cargos.

---

## 4. Planilla de Información Anual (PIA) 2025

**Archivo**: `docs/oficiales_abc/PIA_cooperadoras_editable_2025.pdf`

### Estructura de la PIA

| Cuadro | Contenido |
|--------|-----------|
| 1 | Datos institucionales (distrito, escuela, CUE, CUIT, domicilio) |
| 2 | Total de socios (activos, honorarios, adherentes) + datos de contacto |
| 3 | Síntesis del acta de la Asamblea Anual Ordinaria |
| 4 | Nómina de Comisión Directiva (cargo, apellido y nombre, CUIL, vencimiento, firma) |
| 5 | Nómina de Comisión Revisora de Cuentas |
| 6 | Representante ante Federación |
| 7 | Autoridades salientes (firmas) |
| 8 | Cuadro demostrativo de recursos y gastos (balance) |
| 9-12 | Detalle de rubros económicos + firmas de revisores y autoridad competente |

### Documentación de asamblea 2026 (instructivo)

**Archivo**: `docs/oficiales_abc/Instructivo_documentacion_asambleas_2026.pdf`

Documentación obligatoria post-asamblea:
1. PIA completa (ambos lados, con firma del Consejo Escolar)
2. Nómina de Comisión Directiva
3. Saldos bancarios al 30/04
4. Copia de acta de convocatoria
5. Copia de acta de la Asamblea Anual Ordinaria
6. Memoria 2026
7. Copia del Libro de Tesorería (cuadros demostrativos 01/05/25 al 30/04/26)
8. Kiosco/librería: contrato (licitado) o nota (propio)
9. Constancia de CBU

Envío: formulario Google, solo desde cuenta @abc.gob.ar.

---

## 5. Instructivo General AFIP

**Archivo**: `docs/oficiales_abc/Instructivo_general_AFIP.pdf`

### Contenido

- Consulta de estado de CUIT en AFIP
- Obtención y vinculación de clave fiscal con CUIT de cooperadora
- Solución a bloqueos frecuentes (domicilio fiscal electrónico, baja de oficio, actualización de actividad)
- Exención del Impuesto a las Ganancias (trámite y renovación)
- Presentación Única de Balances (PUB)
- Exención del Impuesto al Crédito y Débito
- Modificación de datos en AFIP
- Emisión de facturas o recibos oficiales

### Utilidad para el sistema

**Media**. Podría integrarse como guía/help contextual en el módulo de configuración o tesorería. No afecta el modelo de datos pero es contenido de valor para el usuario.

---

## 6. Normativa legal descargada

| Documento | Archivo | Descripción |
|-----------|---------|-------------|
| Decreto 4767/72 | `Decreto_4767-72_cooperadoras.pdf` | Reglamento general de cooperadoras escolares PBA |
| Resolución 315/89 | `Resolucion_315-89.pdf` | Reglamentación de quioscos en escuelas |
| Resolución 1298/90 | `Resolucion_1298-90.pdf` | Conválida de la Res. 315/89 |
| Resolución 631/94 | `Resolucion_631-94.pdf` | Modificación de pautas de quioscos |
| Disposición Conjunta 01/08 | `Disposicion_conjunta_quiosco_saludable.pdf` | Quiosco saludable |

### Utilidad para el sistema

El **Decreto 4767/72** es la norma fundamental. Ya está referenciado en los contextos existentes. Las resoluciones sobre quioscos son relevantes para el módulo de kiosco: definen modalidades (directo vs. concesión/licitado), requisitos y condiciones.

---

## 7. Modelos de libros y planillas

**Archivos en `docs/oficiales_abc/`**:

| Archivo | Descripción |
|---------|-------------|
| `Libro_de_actas_modelo.pdf` | Modelo de libro de actas |
| `Libro_de_inventario_modelo.pdf` | Modelo de libro de inventario |
| `Libro_de_socixs_modelo.pdf` | Modelo de libro de socios |
| `Libro_de_tesoreria_modelo.pdf` | Modelo de libro de tesorería |
| `Especificaciones_impresion_libros.pdf` | Especificaciones de impresión |
| `Modelo_balance_tesoreria.pdf` | Modelo de balance mensual |
| `Nomina_comision_directiva_editable.pdf` | Nómina editable |
| `Afiche_convocatoria_asamblea_2026.pdf` | Afiche para convocatoria |
| `Modelo_licitacion_kioscos_escolares.pdf` | Modelo de licitación de kioscos |
| `Calendario_cooperacion_2026.pdf` | Calendario 2026 |
| `Plancha_sticker.pdf` / `Plancha_sticker_10x15.pdf` | Stickers |

### Utilidad para el sistema

**Alta**. Los modelos de libros definen exactamente la estructura de columnas que usa la DGCyE. El sistema podría:

1. **Generar PDFs** que respeten los formatos oficiales de libros (actas, tesorería, socios, inventario)
2. **El modelo de balance de tesorería** define los rubros oficiales que ya están en `rubros_pia` del schema
3. **El modelo de licitación de kioscos** es relevante para el módulo de kiosco cuando la modalidad es "Licitado"
4. **El afiche de convocatoria** podría generarse automáticamente desde el sistema al registrar una asamblea

---

## 8. Otros recursos del Linktree

| Recurso | URL | Utilidad |
|---------|-----|----------|
| Curso de Cooperativismo Escolar | formacionpermanente.abc.gob.ar | Informativo |
| Videos YouTube (talleres, charlas) | youtube.com/playlist... | Informativo |
| Preguntas Frecuentes | abc.gob.ar/.../cooperacion-escolar-1 | **Alta**: guía operativa para usuarios |
| Continuemos Estudiando | continuemosestudiando.abc.gob.ar | Informativo |

### Preguntas Frecuentes: temas relevantes

- Trámites de AFIP, ARBA y Banco Provincia
- Documentación de asambleas
- Regularización de cooperadoras inactivas
- Renuncias de miembros de CD
- Cambio de denominación de cooperadora
- Libros de la cooperadora (dónde guardar, tipo de libro, rubricación)
- Certificación de estatuto (proceso digital definitivo)

---

## Resumen de oportunidades para el sistema

### Datos del GeoJSON

1. **Seed de distritos**: cargar los 135 distritos reales como choices o tabla de referencia
2. **Autocompletado de escuela por CUE**: buscar en el GeoJSON y prellenar distrito, nombre, dirección, localidad
3. **Campo de región educativa**: agregar al schema (no existe actualmente)
4. **Campo de tipo de organización**: agregar al schema (no existe actualmente)
5. **Geolocalización**: lat/long para futuro mapa

### Contenido normativo

6. **Validación de cargos**: verificar que el seed incluya Vicepresidente, Prosecretario y Protesorero del estatuto modelo
7. **Validación de quórum**: 50% socios activos → 1 hora después mín. = número de CD
8. **Validación de antigüedad de socio**: 30 días para voz y voto (ya implementado en `habilitado_electoral`)
9. **Validación de incompatibilidades**: cónyuges y parientes hasta 2º grado para Presidente/Tesorero/Asesor/Revisor
10. **Generación de documentos**: PIA, Nómina, Memoria, Afiche de convocatoria con formatos oficiales

### Mejoras funcionales

11. **Alerta de vencimiento de mandatos**: al 30/07 de cada año
12. **Alerta de asamblea ordinaria**: segunda quincena de mayo
13. **Alerta de envío de documentación**: dentro de los 15 días de la asamblea
14. **Estado de cooperadora**: Activa/Inactiva (cruzando con el GeoJSON del padrón oficial)
15. **Guía contextual de AFIP**: help integrado para trámites frecuentes de CUIT
