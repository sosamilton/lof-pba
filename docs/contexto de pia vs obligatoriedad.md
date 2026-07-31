Revisé la PIA vigente y, además de la normativa y el manual de fortalecimiento de cooperadoras, hay una diferencia importante entre:

* **datos obligatorios para que la cooperadora exista y funcione regularmente**, y
* **datos que la PIA solicita para caracterizar o describir la realidad de la cooperadora durante ese ejercicio**. ([ISFD Nº 21][1])

Para el diseño de un sistema, yo los separaría así.

## 1. Datos institucionales (prácticamente obligatorios)

Estos son necesarios para identificar a la cooperadora:

* Distrito
* Escuela
* CUE
* Domicilio
* Localidad
* CUIT (si ya posee)
* Datos de contacto
* Datos de la Asamblea Ordinaria
* Comisión Directiva
* Comisión Revisora de Cuentas

Estos sí forman parte del funcionamiento normal de cualquier cooperadora.

---

# 2. Campos de la PIA que **no siempre aplican**

Estos deberían ser opcionales en un sistema.

### Representante ante la Federación

Ya lo vimos.

Puede no existir.

---

### Federación a la que pertenece

Muchas cooperadoras no están federadas.

Puede quedar vacío.

---

### Kiosco

No todas poseen kiosco.

Incluso puede existir sólo durante parte del ejercicio.

---

### Huerta

Puede existir o no.

---

### Comedor

La cooperadora puede colaborar con el comedor o no.

No todas las escuelas tienen la misma modalidad.

---

### Transporte

Sólo aplica en determinadas escuelas.

---

### Producción propia

Ejemplos:

* panificados
* vivero
* imprenta
* granja
* talleres

Muchas cooperadoras nunca desarrollan actividades productivas.

---

### Servicios específicos

Dependen de la escuela.

Por ejemplo:

* fotocopiadora
* buffet
* librería
* eventos

Son actividades económicas, no obligaciones.

---

### Actividades de recaudación

Ejemplos:

* rifas
* ferias
* peñas
* festivales

Puede haber ejercicios donde no se realizó ninguna.

---

### Subsidios específicos

Una cooperadora puede:

* recibirlos;
* no recibir ninguno;
* recibir uno solo.

---

### Bienes determinados

Algunos bienes sólo existirán si fueron adquiridos.

Ejemplo:

* vehículo
* tractor
* maquinaria
* herramientas

---

### Convenios

Puede no existir ninguno.

---

# 3. Campos que son consecuencia de la actividad

No son obligatorios.

Si no hubo actividad, pueden valer cero.

Por ejemplo:

* ingresos por kiosco
* gastos del kiosco
* ingresos por buffet
* ingresos por eventos
* ingresos por rifas
* ingresos por donaciones
* ingresos por alquileres

Todos pueden ser perfectamente:

```
0
```

durante un ejercicio.

---

# 4. Cantidad de socios

La PIA pide:

* activos
* adherentes
* honorarios

Pero el estatuto no obliga a tener las tres categorías.

Por ejemplo:

```
Activos: 48

Adherentes: 0

Honorarios: 0
```

es completamente válido.

---

# 5. Cargos especiales

Además del representante ante la Federación, cualquier otro cargo que no integre la Comisión Directiva o la Comisión Revisora debería considerarse opcional.

Por ejemplo:

* Responsable del kiosco.
* Encargado de biblioteca.
* Coordinador de eventos.

Son funciones internas, no cargos estatutarios.

---

## Cómo lo modelaría

Si estás construyendo un sistema para cooperadoras, dividiría la información en tres grupos:

| Grupo                                                                              | ¿Obligatorio?                                               |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Datos legales e institucionales (escuela, estatuto, asamblea, autoridades, socios) | ✅ Sí                                                        |
| Actividades de la cooperadora (kiosco, buffet, ferias, huerta, eventos, etc.)      | ❌ No, dependen de cada cooperadora                          |
| Información económica (ingresos, egresos, subsidios, patrimonio)                   | ✅ Sí, pero los importes pueden ser 0 si no hubo movimientos |

## Hay una oportunidad de mejorar el modelo

Conociendo las PIA de los últimos años, creo que una buena práctica sería **no modelar el formulario como una estructura fija**. En cambio, conviene distinguir:

* **estructura permanente** (socios, autoridades, estatuto, escuela);
* **actividades** (kiosco, buffet, huerta, transporte, etc.), donde cada actividad puede tener fecha de alta y baja;
* **movimientos económicos**, vinculados a esas actividades.

De esa forma, si una cooperadora abre un kiosco en septiembre y lo cierra en diciembre, no necesitás agregar o quitar campos del formulario: simplemente registrás la actividad con su período de vigencia y los movimientos asociados. Cuando generás la PIA, el sistema completa automáticamente los campos correspondientes para ese ejercicio. Esa arquitectura es mucho más flexible y soporta cambios futuros en la PIA sin tener que modificar el modelo de datos.

[1]: https://isfd21-bue.infd.edu.ar/sitio/wp-content/uploads/2021/10/PIA-PLANILLA-DE-INFORMACION-ANUAL-EDITABLE1-1.pdf?utm_source=chatgpt.com "DIRECCIÓN GENERAL DE CULTURA Y EDUCACIÓN"
