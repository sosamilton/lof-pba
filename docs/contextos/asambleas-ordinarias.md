Sí, y acá hay una cuestión clave para LOF: **hay una Asamblea Ordinaria por año, pero no necesariamente se renueva toda la Comisión Directiva todos los años.**

La normativa vigente parte del **Decreto 4767/72**, cuyo art. 10 establece que las Asambleas Ordinarias se realizan **anualmente** y que uno de sus objetos es la “elección total o parcial, según corresponda” de los miembros de la Comisión Directiva. ([Normas GBA][1])

### Entonces, ¿cuántas Asambleas Ordinarias hay?

**Una por año.**

El régimen las ubica dentro de la segunda quincena de mayo, en la fecha que fije la Dirección de Cooperación Escolar para las distintas zonas. ([Studocu][2])

No significa que haya que hacer una Asamblea Ordinaria cada vez que cambia una autoridad.

---

## ¿Se eligen autoridades todos los años?

**Sí, pero parcialmente.**

La Comisión Directiva tiene un mandato de **2 años** y se **renueva por mitades cada año**. El art. 15 del Decreto lo establece expresamente. ([Scribd][3])

El Estatuto Modelo actual mantiene el mismo esquema: la Comisión Directiva dura dos años y se renueva por mitades cada año en la Asamblea Anual Ordinaria. ([Scribd][4])

Por ejemplo, si tenemos:

| Cargo            | Mandato   |
| ---------------- | --------- |
| Presidente       | 2026–2028 |
| Secretario       | 2026–2028 |
| Tesorero         | 2026–2028 |
| Vocal titular 1  | 2026–2028 |
| Vocal titular 2  | 2026–2028 |
| Vocal titular 3  | 2026–2028 |
| Vocal suplente 1 | 2026–2028 |
| Vocal suplente 2 | 2026–2028 |

En la siguiente Asamblea Ordinaria **no se votan necesariamente los 8**.

Se renueva la mitad correspondiente.

### Ejemplo de esquema

Supongamos que en 2026 se sortearon los mandatos para determinar qué mitad dura un año y cuál dos:

**Grupo A**

* Presidente
* Tesorero
* Vocal titular 2
* Vocal suplente 1

**Grupo B**

* Secretario
* Vocal titular 1
* Vocal titular 3
* Vocal suplente 2

Entonces:

**Asamblea 2026**

→ se elige Grupo A.

**Asamblea 2027**

→ se elige Grupo B.

**Asamblea 2028**

→ vuelve a elegirse Grupo A.

Y así sucesivamente.

Esto permite que **nunca se produzca una renovación completa de la Comisión Directiva en una sola Asamblea ordinaria**.

---

# Pero hay una diferencia importante: "elección de autoridades" ≠ "elección de toda la Comisión"

Esto es exactamente lo que puede generar confusión al diseñar LOF.

La PIA/formulario administrativo históricamente tiene como punto del orden del día:

> “Elección de Autoridades de C.D., Rev. de Ctas. y Rep. de Fed.”

pero el Decreto dice **“elección total o parcial, según corresponda”**. ([Servicios ABC][5])

Por lo tanto, el sistema no debería asumir:

```text
Asamblea Ordinaria
    ↓
crear nueva Comisión Directiva completa
```

sino:

```text
Asamblea Ordinaria
    ↓
determinar qué mandatos vencen
    ↓
elegir reemplazantes de esos cargos
    ↓
mantener los cargos cuyo mandato continúa
```

---

# ¿Y la Comisión Revisora de Cuentas?

Acá la situación es diferente.

La Comisión Revisora tiene:

* 2 titulares;
* 1 suplente.

Uno de los titulares es docente designado por el Director y el otro es socio elegido por la Asamblea. El suplente también es elegido según el régimen estatutario.

En la documentación de la Asamblea Ordinaria aparecen conjuntamente la elección de autoridades de Comisión Directiva, Revisores de Cuentas y representantes de Federación. ([Servicios ABC][5])

Pero **no hay que interpretar que la Comisión Revisora se renueva necesariamente por mitades como la Comisión Directiva**. La regla de renovación por mitades del art. 15 se refiere específicamente a la **Comisión Directiva**.

---

# ¿Y los representantes ante Federación?

También aparecen en la Asamblea Ordinaria.

El formulario histórico de la PIA incluye:

> Elección de Autoridades de C.D., Rev. de Ctas. y Rep. de Fed.

([Servicios ABC][5])

Por eso, si la cooperadora está federada, la representación debe tratarse como una **representación que puede renovarse en la Asamblea**, pero no debe confundirse con los cargos de la Comisión Directiva.

---

# ¿Qué pasa si renuncia un Presidente a mitad de año?

Esto es distinto de la renovación anual.

Supongamos:

```text
Asamblea mayo 2026
Presidente → mandato hasta mayo 2028

Renuncia octubre 2026
```

**No hay que esperar a mayo de 2027 para resolver necesariamente la vacante.**

El estatuto contempla mecanismos de reemplazo dentro de la propia Comisión Directiva. Por ejemplo, el Presidente es reemplazado por el Vocal Titular 1.º, y existen mecanismos sucesivos para cubrir las vacantes.

Esto es justamente lo que permite que la cooperadora siga funcionando entre Asambleas.

---

# ¿Puede haber una Asamblea Extraordinaria para elegir?

Sí, pero no debería confundirse con la Asamblea Ordinaria anual.

Las Asambleas son:

```text
ASAMBLEAS
│
├── Ordinaria
│     └── 1 por año
│
└── Extraordinaria
      └── cuando corresponde
```

La Extraordinaria puede convocarse por las causas previstas en el régimen estatutario, entre ellas determinadas situaciones relacionadas con la Comisión Directiva, solicitudes de socios, etc. ([Studocu][2])

Por ejemplo, una situación extraordinaria podría requerir una Asamblea para resolver una cuestión que **no puede o no corresponde resolver mediante la simple sustitución interna**.

---

# Esto tiene una consecuencia muy importante para el modelo de LOF

Yo no modelaría:

```text
Asamblea
└── autoridades elegidas
```

como si cada Asamblea generara una nueva nómina completa.

Lo modelaría así:

```text
MANDATO
│
├── Cargo: Presidente
├── Persona: Juan
├── Inicio: 2026-05
├── Fin previsto: 2028-05
├── Asamblea que lo eligió: Ordinaria 2026
└── Estado: Vigente
```

Y después:

```text
ASAMBLEA ORDINARIA 2027
│
├── Mandatos vencidos
│     ├── Secretario
│     ├── Vocal 1
│     └── ...
│
└── Mandatos que continúan
      ├── Presidente
      ├── Tesorero
      └── ...
```

Eso te permite representar correctamente una cooperadora que lleva muchos años funcionando.

---

## Y hay un detalle todavía más interesante

**La primera Asamblea de una cooperadora nueva es diferente.**

Cuando se constituye la Comisión Directiva inicial, se debe hacer el sorteo de los mandatos para determinar qué mitad durará un año y cuál dos. Después de ese primer sorteo, el esquema queda estabilizado. El Estatuto Modelo lo dice expresamente. ([Scribd][4])

Por lo tanto:

```text
Año 0
Constitución
    ↓
Elección de toda la CD
    ↓
Sorteo de duración
    ├── mitad → 1 año
    └── mitad → 2 años

Año 1
    ↓
renueva mitad A

Año 2
    ↓
renueva mitad B

Año 3
    ↓
renueva mitad A
...
```

**Esta lógica es bastante importante para LOF**, porque significa que el sistema debería poder registrar que una misma persona ocupa un cargo durante un mandato de dos años, mientras que la Asamblea anual solo modifica una parte de la composición.

Y además hay que separar **elección**, **mandato**, **cargo** y **persona que actualmente ocupa el cargo**. Son cuatro cosas distintas.

[1]: https://normas.gba.gob.ar/ar-b/decreto/1972/4767/160869?utm_source=chatgpt.com "Sistema de Información Normativa y Documental Malvinas Argentinas - Decreto 4767/1972"
[2]: https://www.studocu.com/es-ar/document/instituto-superior-de-profesorado-n0-3/informatica/decreto-476772-sobre-entidades-cooperadoras-escolares/162608937?utm_source=chatgpt.com "Decreto 4767/72 sobre Entidades Cooperadoras Escolares - Studocu"
[3]: https://es.scribd.com/doc/290575201/Decreto-4767-72-Manual-de-Cooperadoras-Escolares?utm_source=chatgpt.com "Reglamento de Cooperadoras Escolares | PDF | Negocios | Finanzas y dinero"
[4]: https://es.scribd.com/document/843158397/MODELO-ESTATUTO-ASOCIACIONES-COOPERADORAS-CD-minima-docx?utm_source=chatgpt.com "Estatuto de Cooperadoras Escolares | PDF | Votación | Dinero"
[5]: https://servicios2.abc.gob.ar/lainstitucion/organismos/consejogeneral/manual_de_procedimiento/mpi_inicial.pdf?utm_source=chatgpt.com "de 
Manual 
procedimientos
 institucionales
Educac"
