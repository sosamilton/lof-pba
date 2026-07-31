Sí: además de la Comisión Directiva, la PIA pide cargar otras personas que **no forman parte de esos ocho cargos**. La distinción correcta es esta.

# 1. Comisión Directiva: mínimo obligatorio

El Decreto 4767/72 establece que la Comisión Directiva debe tener **como mínimo ocho socios hábiles**:

| Cargo              | Cantidad | Tipo                      |
| ------------------ | -------: | ------------------------- |
| Presidente/a       |        1 | Titular                   |
| Secretario/a       |        1 | Titular                   |
| Tesorero/a         |        1 | Titular                   |
| Vocal titular 1.º  |        1 | Titular                   |
| Vocal titular 2.º  |        1 | Titular                   |
| Vocal titular 3.º  |        1 | Titular                   |
| Vocal suplente 1.º |        1 | Suplente                  |
| Vocal suplente 2.º |        1 | Suplente                  |
| **Total**          |    **8** | 6 titulares + 2 suplentes |

El artículo 14 del decreto dice expresamente que la Comisión Directiva no puede integrarse con menos de ocho socios hábiles, y que deben estar cubiertos “inexorablemente” Presidente, Secretario, Tesorero y al menos tres vocales. El Estatuto Modelo vigente reproduce exactamente esa composición mínima. ([ABC][1])

## Función de cada cargo

### Presidente/a

Es quien:

* representa legalmente a la cooperadora;
* convoca y preside las reuniones de Comisión Directiva;
* preside las asambleas;
* coordina con el asesor los días y horarios;
* firma documentos, pagos y cheques junto con Secretario o Tesorero;
* controla mensualmente los balances;
* tiene voto de desempate.

En caso de renuncia o impedimento, el Estatuto Modelo dispone que sea reemplazado por el miembro titular que corresponda, específicamente el Vocal Titular 1.º. ([ABC][2])

### Secretario/a

Es responsable de:

* redactar las actas;
* llevar comunicaciones y correspondencia;
* conservar copias y documentación;
* citar formalmente a las reuniones;
* refrendar la firma del Presidente;
* firmar documentación y operaciones junto con Presidente o Tesorero.

Ante una vacante también se prevé su reemplazo por un vocal titular. ([ABC][2])

### Tesorero/a

Tiene a su cargo:

* recibir y registrar los ingresos;
* custodiar el efectivo autorizado como caja chica;
* depositar los fondos;
* organizar el sistema financiero;
* llevar los libros de Tesorería y de socios;
* presentar mensualmente balance y comprobantes;
* verificar pagos y facturas;
* firmar operaciones junto con Presidente o Secretario.

También puede ser reemplazado por un vocal titular ante renuncia o impedimento. ([ABC][2])

### Vocales titulares

No son cargos decorativos. Deben:

* asistir a las reuniones;
* integrar las comisiones de trabajo que se les asignen;
* reemplazar al Presidente, Secretario, Tesorero u otro integrante titular cuando se produzca una vacante.

El orden importa, por eso conviene registrar en el sistema:

```text
Vocal titular 1.º
Vocal titular 2.º
Vocal titular 3.º
```

No solamente “Vocal”. 

### Vocales suplentes

Reemplazan a los vocales titulares cuando estos pasan a otro cargo, renuncian o quedan impedidos. También pueden recibir tareas específicas, pero mientras no se produzca el reemplazo no pasan a ser integrantes titulares de la Comisión. 

---

# 2. ¿Qué pide cargar exactamente la PIA?

La PIA 2025 no imprime los nombres de los ocho cargos dentro del cuadro 4. Presenta filas abiertas bajo el título:

> “Nómina de la nueva Comisión Directiva conforme art. 3.º del Estatuto de la entidad”.

Por lo tanto, en ese cuadro se deben cargar **todos los cargos que figuren en el estatuto particular de esa cooperadora**, no una lista inventada por la PIA. 

Con el Estatuto Modelo mínimo deberían cargarse:

```text
Presidente/a
Secretario/a
Tesorero/a
Vocal titular 1.º
Vocal titular 2.º
Vocal titular 3.º
Vocal suplente 1.º
Vocal suplente 2.º
```

Para cada persona, la PIA pide:

* cargo;
* apellido y nombre;
* CUIL;
* vencimiento del mandato;
* firma.

## ¿Por qué hay más de ocho renglones?

Porque la PIA debe admitir cooperadoras cuyo estatuto aprobado tenga una Comisión Directiva más amplia.

El decreto establece un **mínimo**, no un máximo. Una cooperadora podría tener, por ejemplo, cinco vocales titulares y tres suplentes, siempre que esa composición esté prevista en su estatuto aprobado. ([ABC][1])

No debería interpretarse la cantidad de filas de la PIA como obligación de completar todas.

---

# 3. Comisión Revisora de Cuentas

Además de la Comisión Directiva, la PIA exige cargar la **Comisión Revisora de Cuentas**:

| Campo de la PIA           | Cómo se designa                                  |                Mandato |
| ------------------------- | ------------------------------------------------ | ---------------------: |
| Revisor/a titular docente | Lo designa el director entre el personal docente |                  1 año |
| Revisor/a titular socio   | Lo elige la Asamblea                             |                  1 año |
| Revisor/a suplente        | Lo elige la Asamblea                             |                  1 año |
| Asesor/a                  | Es quien ejerce la dirección del establecimiento | No es mandato electivo |

La Comisión Revisora está integrada jurídicamente por:

* dos titulares;
* un suplente.

Uno de los titulares debe ser personal docente de la escuela y es designado por la Dirección. El otro titular debe ser socio y es elegido por la Asamblea. ([ABC][1])

## ¿El asesor integra la Comisión Revisora?

La PIA lo coloca en el mismo cuadro, pero técnicamente el asesor **no es uno de los tres revisores**.

El asesor es una función institucional separada, ejercida por quien ocupa la Dirección del establecimiento. Tiene voz, pero no voto, y puede delegar su participación ante un impedimento. ([ABC][1])

Por eso, en el sistema conviene modelar:

```text
Comisión Revisora:
- Titular docente
- Titular socio
- Suplente

Asesoría:
- Director/a del establecimiento
- Delegado eventual, cuando corresponda
```

No cuatro revisores.

---

# 4. Representantes ante la Federación

La PIA también contiene:

* representante titular;
* representante suplente.

Pero no forman parte de la Comisión Directiva ni de la Comisión Revisora.

Son una **representación institucional condicional**. Solo corresponde completarlos cuando la cooperadora participa efectivamente en una Federación. La PIA no pide el nombre de la Federación. 

Para el sistema deberían quedar separados:

```text
Representación ante Federación
- Titular
- Suplente
- Fecha de inicio
- Fecha de finalización
- Acta de designación
- Federación, como dato interno opcional
```

No deben contarse para alcanzar el mínimo de ocho miembros de Comisión Directiva.

---

# 5. Personas que aparecen en la PIA, pero no son cargos permanentes

La planilla también requiere firmas o intervenciones de otras personas:

## Autoridades salientes

En el cuadro 7 firman:

* Presidente saliente;
* Secretario saliente;
* Asesor.

La propia PIA aclara que son las autoridades del período anterior, no necesariamente las recién elegidas. No constituyen cargos adicionales; son las personas que certifican la información histórica presentada. 

## Tesorero/a

Firma el cuadro económico. Es el mismo Tesorero de Comisión Directiva, no una persona adicional. 

## Revisores de cuentas

En el cuadro 9 firman:

* Revisor de Cuentas Docente;
* Revisor de Cuentas Titular.

Son las mismas personas informadas en el cuadro 5. 

## Autoridad competente

En el cuadro 12 aparece firma y sello de la autoridad que revisa o valida administrativamente la presentación. No integra la cooperadora. 

---

# 6. Resumen total de personas a informar

Usando el Estatuto Modelo mínimo, la PIA puede contener:

| Grupo                          |                                                            Personas |
| ------------------------------ | ------------------------------------------------------------------: |
| Comisión Directiva             |                                                                   8 |
| Comisión Revisora              |                                                                   3 |
| Asesor/a                       |                                                                   1 |
| Representantes ante Federación |                                                               0 o 2 |
| Autoridades salientes          | Ya están comprendidas históricamente, no necesariamente adicionales |
| Autoridad competente           |                                            Externa a la cooperadora |

Por lo tanto, una cooperadora mínima puede necesitar identificar **12 funciones institucionales actuales**:

```text
8 Comisión Directiva
3 Comisión Revisora
1 Asesor
```

Pero eso no significa que necesite doce socios:

* el Revisor docente puede no ser socio;
* el Asesor no necesita ser socio para ejercer esa función;
* los representantes de Federación pueden ser personas que ya ocupan otro rol, dependiendo de las reglas aplicables;
* los ocho miembros de Comisión Directiva sí deben ser socios activos habilitados;
* el Revisor titular elegido por Asamblea debe ser socio.

---

# 7. ¿Existen reglas diferentes para escuelas pequeñas y grandes?

## No encontré un régimen general que reduzca cargos por cantidad de matrícula

En las fuentes oficiales revisadas no aparece una escala como:

```text
Escuela pequeña: 3 o 5 autoridades
Escuela mediana: 8 autoridades
Escuela grande: 12 autoridades
```

El Decreto 4767/72 establece el mismo mínimo de ocho integrantes para cada Comisión Directiva, sin diferenciar por:

* cantidad de alumnos;
* matrícula;
* ruralidad;
* cantidad de familias;
* nivel educativo;
* tamaño del establecimiento;
* cantidad de socios.

([ABC][1])

El Manual 2025 también utiliza la misma estructura de ocho personas para constituir la comisión provisoria, sin introducir una excepción para comunidades reducidas. 

## Tampoco se obliga a las comunidades grandes a sumar cargos

Una escuela con mil alumnos no está obligada, por ese solo motivo, a aumentar la Comisión Directiva.

Puede ampliar la cantidad de vocales u organizar comisiones internas si necesita distribuir mejor el trabajo, pero la ampliación estructural debe estar contemplada en su estatuto.

---

# 8. Facilidades que sí existen, pero no reducen el mínimo

Aunque no existe un “estatuto reducido” verificado para escuelas pequeñas, hay algunos mecanismos que facilitan el funcionamiento.

## Segunda convocatoria con quórum reducido

En el horario fijado se requiere el 50 % de los socios activos habilitados. Una hora después, la Asamblea puede sesionar con los socios presentes, siempre que su cantidad sea al menos igual al número de integrantes de la Comisión Directiva. ([ABC][2])

Con una Comisión Directiva de ocho personas:

```text
Quórum mínimo una hora después: 8 socios activos habilitados
```

Esta regla beneficia tanto a comunidades pequeñas como grandes, porque evita exigir siempre la presencia de la mitad del padrón.

## Convocatoria abierta a toda la comunidad

No es necesario que todos los socios sean madres o padres actuales. Pueden incorporarse adultos vinculados a la comunidad:

* familiares;
* vecinos;
* exalumnos adultos;
* docentes;
* otras personas interesadas en colaborar.

El Manual recomienda realizar una convocatoria amplia y mantener una cuota accesible para favorecer la participación. 

## Vocales como mecanismo de reemplazo

La existencia de tres vocales titulares y dos suplentes facilita cubrir renuncias sin llamar inmediatamente a una nueva elección general. 

## Delegación del asesor

Si el director no puede concurrir, puede delegar la función en Vicedirección, Secretaría o un docente. Su ausencia tampoco impide automáticamente realizar la Asamblea. ([ABC][1])

---

# 9. El problema real de una comunidad muy pequeña

El Estatuto Modelo dispone la disolución cuando la cantidad de socios queda reducida a un número igual al de miembros de la Comisión Directiva. ([ABC][2])

Con una Comisión Directiva mínima de ocho:

```text
8 socios activos totales = causal estatutaria de disolución
```

En consecuencia, para funcionar regularmente bajo ese modelo deberían existir **más socios que integrantes de Comisión Directiva**. En términos estrictamente numéricos, al menos nueve socios activos, aunque operar con solo nueve sería institucionalmente muy frágil porque casi todos estarían involucrados en cargos o control.

Además, para cubrir los órganos con personas diferenciadas se requiere considerar:

* ocho integrantes de Comisión Directiva;
* al menos un Revisor titular socio;
* un Revisor suplente, que razonablemente también debe ser una persona distinta;
* el Revisor docente;
* el asesor.

Por eso una comunidad con ocho o nueve adultos disponibles puede tener serias dificultades prácticas, aunque formalmente alcance algunos mínimos.

---

# 10. ¿Puede una escuela pequeña pedir una excepción?

No encontré publicada una excepción general que permita reducir la Comisión Directiva por debajo de:

* Presidente;
* Secretario;
* Tesorero;
* tres vocales titulares;
* dos vocales suplentes.

La autoridad de Cooperación Escolar tiene competencias de supervisión, regularización e intervención, pero no encontré una norma oficial vigente que autorice simplemente a una escuela pequeña a formar una Comisión Directiva de tres o cinco personas.

Por eso, para el sistema no implementaría una opción como:

```text
“Comunidad reducida: permitir solo Presidente, Secretario y Tesorero”
```

Eso chocaría con el mínimo provincial vigente.

Sí implementaría un estado especial:

```text
No alcanza integración mínima
Requiere regularización / consulta a autoridad distrital
```

y permitiría documentar:

* convocatoria realizada;
* cantidad de socios disponibles;
* cargos sin cubrir;
* intervención del Consejo Escolar;
* indicación de la Dirección de Cooperación.

---

# Recomendación concreta para tu modelo

Separaría los campos de la PIA así:

```text
Órgano: Comisión Directiva
- Presidente
- Secretario
- Tesorero
- Vocal titular 1
- Vocal titular 2
- Vocal titular 3
- Vocal suplente 1
- Vocal suplente 2
- Otros cargos previstos por estatuto

Órgano: Comisión Revisora
- Revisor titular docente
- Revisor titular socio
- Revisor suplente

Función institucional
- Asesor

Representación externa
- Representante titular ante Federación
- Representante suplente ante Federación
```

Y aplicaría esta validación:

> La cantidad de cargos y sus nombres se obtienen del estatuto vigente de la cooperadora, pero nunca se admite una Comisión Directiva inferior al mínimo del Decreto 4767/72.

La PIA no crea cargos nuevos: **recoge la Comisión Directiva prevista en el estatuto y, por separado, solicita Comisión Revisora, Asesor y representantes ante Federación**.

[1]: https://abc.gob.ar/secretarias/sites/default/files/2021-05/1-decreto_provincial_ndeg4767-72_de_las_entidades_escolares.abc_.pdf "MORENO, Diciembre 9, 2002"
[2]: https://abc.gob.ar/secretarias/sites/default/files/2024-03/MODELO%20ESTATUTO%20ASOCIACIONES%20COOPERADORAS_CD%20minima.docx.pdf "MODELO ESTATUTO ASOCIACIONES COOPERADORAS_CD minima.docx"
