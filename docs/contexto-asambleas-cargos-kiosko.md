---
respecto a las asambleas y cargos
 preguntas

donde y cuendo se definen los cargos que tiene una cooepradora? que es necesario para agregar un nuevo cargo o eliminarlo? para la definicion de las personas que ocupan cargos que es necesario? osea si o si debe ser por asamblea? que pasa si hay una renuncia? existen mecanismos adicionales para nombrar facilmente remplazante? respecto a si tiene o no kiosko, que pasa si comienza teniendo y luego en el medio del ejercicio se quiere quitar o dar de baja o siemplemente se deja de usar y se puede informar todo 0?

---
Son muy buenas preguntas. La respuesta está principalmente en el **Reglamento General de las Cooperadoras Escolares de la Provincia de Buenos Aires** (aprobado por la Dirección General de Cultura y Educación), el **Estatuto Modelo** que deben adoptar las cooperadoras y las disposiciones de la Dirección de Cooperación Escolar. Hay cierta flexibilidad, pero también reglas bastante claras.

## 1. ¿Dónde y cuándo se definen los cargos de una cooperadora?

Los cargos no los inventa cada cooperadora en cada elección.

Se definen en el **Estatuto** de la cooperadora, que normalmente sigue el Estatuto Modelo aprobado por la DGCyE.

Generalmente el estatuto establece una Comisión Directiva integrada por cargos como:

* Presidente
* Vicepresidente
* Secretario
* Prosecretario
* Tesorero
* Protesorero
* Vocales titulares
* Vocales suplentes

Además existen:

* Revisores de Cuentas
* Comisión Revisora de Cuentas (según corresponda)

Es decir, la Asamblea no decide todos los años qué cargos existen; lo que hace es elegir personas para ocupar los cargos previstos en el estatuto.

---

## 2. ¿Qué hace falta para agregar o eliminar un cargo?

Hay que distinguir dos casos.

### Caso A: crear un cargo completamente nuevo

Ejemplo:

* Coordinador de Tecnología
* Responsable de Comunicación
* Encargado de Eventos

Si ese cargo forma parte de la Comisión Directiva con voz y voto, implica modificar el Estatuto.

Eso requiere:

* Asamblea Extraordinaria.
* Aprobación de la reforma estatutaria.
* Presentación ante la autoridad correspondiente para su aceptación.

No puede decidirlo solamente la Comisión Directiva.

---

### Caso B: crear funciones internas

La Comisión Directiva sí puede distribuir tareas.

Por ejemplo:

* responsable del kiosco
* responsable de mantenimiento
* responsable de biblioteca
* encargado de compras

Pero esas funciones **no constituyen nuevos cargos estatutarios**.

Simplemente son responsabilidades internas asignadas por la Comisión.

---

## 3. ¿Las personas que ocupan cargos deben ser elegidas sí o sí por Asamblea?

Sí.

La Comisión Directiva nace de la Asamblea Ordinaria.

La Asamblea elige a los integrantes.

Luego, dependiendo de cómo esté redactado el estatuto, puede ocurrir una de estas situaciones:

### Opción 1 (la más común)

La Asamblea elige la lista completa ya con los cargos.

Ejemplo:

* Juan → Presidente
* María → Secretaria
* Pedro → Tesorero

---

### Opción 2

La Asamblea elige únicamente los miembros.

Después, la Comisión se reúne y distribuye internamente los cargos.

Esto depende del Estatuto vigente.

En la práctica de las cooperadoras bonaerenses suele presentarse una lista ya conformada con todos los cargos.

---

# 4. ¿Qué pasa si alguien renuncia?

Este es uno de los puntos más importantes.

No siempre hace falta convocar una nueva Asamblea.

Normalmente el Estatuto prevé mecanismos de reemplazo.

Ejemplo:

Presidente renuncia.

Puede suceder:

* el Vicepresidente pasa a Presidente;
* un Vocal ocupa el lugar vacante;
* un Vocal Suplente pasa a Titular.

Todo esto queda registrado en un acta de Comisión Directiva.

No necesariamente hay que hacer Asamblea.

La idea es garantizar la continuidad del funcionamiento.

---

## ¿Cuándo sí hace falta una Asamblea?

Cuando ya no existe quórum.

Ejemplo:

renuncian:

* Presidente
* Secretario
* Tesorero
* varios Vocales

y ya no quedan suplentes.

En ese caso normalmente corresponde convocar una Asamblea para elegir nuevas autoridades.

---

## 5. ¿Puede una Comisión completar vacantes?

Sí.

Es bastante habitual.

Los estatutos suelen prever que las vacantes se cubran:

* por ascenso del Vicepresidente;
* por incorporación de Vocales;
* por incorporación de Vocales Suplentes.

La Comisión deja constancia mediante un Acta.

---

# 6. Respecto al kiosco

Aquí también hay que distinguir varias cosas.

El kiosco **no forma parte de la estructura jurídica de la cooperadora**.

Es simplemente una actividad económica que puede desarrollar para obtener recursos.

Por lo tanto puede ocurrir cualquiera de estas situaciones durante un mismo ejercicio:

* comenzar sin kiosco;
* abrir un kiosco;
* cerrarlo;
* dejar de explotarlo;
* tercerizarlo;
* volver a abrirlo.

Todo eso es perfectamente posible.

---

## ¿Cómo impacta en la PIA?

La PIA refleja la realidad del ejercicio.

Por ejemplo:

### Inicio del ejercicio

No había kiosco.

En septiembre se abre.

En la PIA aparecerán únicamente los ingresos obtenidos desde septiembre.

---

### Otro ejemplo

Había kiosco.

En noviembre se cerró.

Desde diciembre hasta abril:

* ingresos = 0
* gastos = 0

No hay ningún inconveniente.

La PIA debe reflejar exactamente eso.

---

### ¿Y si simplemente deja de usarse?

También es válido.

No existe obligación de mantener un kiosco abierto durante todo el ejercicio.

Simplemente:

* ya no habrá ingresos;
* ya no habrá compras;
* ya no habrá stock;
* el balance reflejará valores cero desde ese momento.

---

# Recomendación para un sistema de gestión

Desde el punto de vista de modelar una aplicación para cooperadoras, yo no trataría estos elementos como datos fijos.

Diseñaría algo así:

| Elemento            | Conviene modelarlo como                             | ¿Puede cambiar durante el ejercicio?        |
| ------------------- | --------------------------------------------------- | ------------------------------------------- |
| Cargos estatutarios | Catálogo configurable según el estatuto             | Muy rara vez (requiere reforma estatutaria) |
| Personas            | Historial con fecha de inicio y fin                 | Sí                                          |
| Ocupación de cargos | Relación Persona ↔ Cargo con vigencias              | Sí                                          |
| Renuncias           | Evento administrativo                               | Sí                                          |
| Reemplazos          | Evento administrativo con referencia al acta        | Sí                                          |
| Kiosco              | Actividad de la cooperadora con fechas de alta/baja | Sí                                          |
| Estado del kiosco   | Activo / Inactivo                                   | Sí                                          |
| Ingresos del kiosco | Movimientos contables                               | Sí                                          |

Este enfoque permite reconstruir en cualquier fecha quién ocupaba cada cargo y qué actividades desarrollaba la cooperadora, sin perder trazabilidad. También evita modificar información histórica cuando hay renuncias, reemplazos o cambios en actividades como el kiosco.




----
respecto de los cargos obligatorios
pregunta:
cuales son los cargos obligatorios que se deben tener? todos si o si deben ser socios de la cooperadora?
---



Sí. En las cooperadoras escolares de la Provincia de Buenos Aires, la regla general es que **los integrantes de los órganos de gobierno deben ser asociados (socios) de la cooperadora con derecho a participar**. La Comisión Directiva y la Comisión Revisora de Cuentas no pueden estar integradas por personas ajenas a la cooperadora.

## 1. ¿Cuáles son los cargos obligatorios?

Según el Estatuto Modelo utilizado por las cooperadoras bonaerenses, la estructura mínima comprende dos órganos:

### Comisión Directiva

Los cargos habituales son:

| Cargo             | Obligatorio                            |
| ----------------- | -------------------------------------- |
| Presidente        | ✅ Sí                                   |
| Vicepresidente    | ✅ Sí                                   |
| Secretario        | ✅ Sí                                   |
| Prosecretario     | ✅ Sí                                   |
| Tesorero          | ✅ Sí                                   |
| Protesorero       | ✅ Sí                                   |
| Vocales Titulares | ✅ Sí (la cantidad la fija el estatuto) |
| Vocales Suplentes | ✅ Sí (para cubrir vacantes)            |

### Comisión Revisora de Cuentas

Generalmente está integrada por:

* Revisores de Cuentas Titulares.
* Revisores de Cuentas Suplentes.

Su composición exacta depende del estatuto vigente, pero la existencia de este órgano de control sí es obligatoria.

---

## 2. ¿Todos deben ser socios?

En términos generales, **sí**.

Para integrar:

* Comisión Directiva.
* Comisión Revisora de Cuentas.

la persona debe reunir los requisitos para ser asociada y haber sido admitida como tal conforme al estatuto.

No sería válido designar, por ejemplo:

* un docente que nunca se asoció;
* un contador externo;
* un proveedor;
* un vecino que no sea socio.

Ellos pueden colaborar con la cooperadora, pero no ocupar cargos estatutarios.

---

## 3. ¿Quiénes pueden ser socios?

Depende del estatuto, pero normalmente pueden asociarse:

* madres, padres o tutores de alumnos;
* exalumnos;
* docentes;
* directivos;
* personal de la institución;
* personas de la comunidad que el estatuto admita.

No todos los socios necesariamente tienen que ser familiares de estudiantes.

---

## 4. ¿Puede una persona ocupar más de un cargo?

No.

Una misma persona no puede ser simultáneamente:

* Presidente y Tesorero.
* Secretario y Vocal.
* Presidente y Revisor de Cuentas.

Cada integrante ocupa un único cargo, ya que existen incompatibilidades por razones de control y funcionamiento.

---

## 5. ¿Qué ocurre si faltan personas?

Es una situación bastante frecuente en cooperadoras pequeñas.

Por ejemplo:

* solo hay 8 socios activos;
* el estatuto prevé 12 cargos.

En esos casos, la cooperadora suele tener dificultades para conformar todos los órganos. La solución no es que una persona acumule cargos, sino:

* incorporar nuevos asociados antes de la Asamblea;
* cubrir vacantes con suplentes cuando corresponda;
* si ya no puede funcionar válidamente por falta de integrantes, convocar una Asamblea para regularizar la situación.

---

## Desde el punto de vista de un sistema

Si estás modelando una aplicación para cooperadoras, yo distinguiría claramente estos conceptos:

* **Socio**: persona asociada a la cooperadora.
* **Cargo**: rol definido por el estatuto (Presidente, Tesorero, Vocal, etc.).
* **Mandato**: período durante el cual un socio ocupa un cargo (con fecha de inicio, fin y acta que lo respalda).
* **Órgano**: Comisión Directiva o Comisión Revisora de Cuentas.

De esa forma, una misma persona puede tener varios mandatos a lo largo de los años, pero **nunca dos cargos simultáneos dentro del mismo mandato**, y siempre podrás reconstruir históricamente quién ocupó cada función. Esto también facilita gestionar renuncias, reemplazos y renovaciones parciales sin perder trazabilidad.
