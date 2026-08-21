# Dudas e interpretaciones a validar: Origen vs. Motivo de convocatoria en AGE

## Contexto del problema

Al crear una Asamblea General Extraordinaria (AGE), el sistema pide dos campos independientes:

- **Origen de convocatoria** (art. 11 del Decreto 4767/72): quién provoca la convocatoria.
  - Más del 10% de socios
  - Dos miembros de CD
  - Dirección de Cooperación Escolar
  - Comisión Directiva

- **Motivo de convocatoria** (art. 12 + práctica): qué se va a tratar.
  - Reforma estatuto
  - Relevo autoridades
  - Integración CD
  - Decisión excepcional
  - Modificación temporal atribuciones
  - Constitución cooperadora
  - Otro

La duda del usuario es: **¿son combinaciones válidas todas las posibles, o hay restricciones entre origen y motivo?**

Ejemplo concreto que generó la duda: si el origen es "Dos miembros de CD", ¿puede el motivo ser "Reforma estatuto"?

---

## Lo que dice la normativa (según los docs de contexto)

### Art. 11 — Quién puede provocar la convocatoria

El art. 11 del Decreto 4767/72 establece tres situaciones que dan origen a una AGE:

1. **Más del 10% de los asociados** la solicitan por escrito.
2. **Dos miembros de la Comisión Directiva** la solicitan.
3. **La Dirección de Cooperación Escolar** la dispone.

Fuente: `docs/contextos/asambleas-extraordinarias.md`, sección 1.

### Art. 12 — Qué puede resolver una AGE

El art. 12 establece las facultades de la AGE:

A. Modificar temporalmente las atribuciones de la CD (hasta 90 días, prorrogable a 180).
B. Hacer permanentes esas modificaciones (requiere luego Asamblea reformatoria del Estatuto).
C. Relevar de sus funciones a miembros de las Comisiones Directivas.

Fuente: `docs/contextos/asambleas-extraordinarias.md`, sección 3-4.

### Reforma del Estatuto

La reforma del Estatuto requiere una AGE convocada específicamente para ese fin, con aprobación de **dos tercios de los socios activos**.

Fuente: `docs/contextos/asambleas-extraordinarias.md`, sección 6; `docs/contextos/tipos-asambleas.md`, tabla.

### Constitución de cooperadora

La constitución utiliza una AGE para: aprobar el Estatuto, elegir CD, elegir CRC, fijar cuota, etc.

Fuente: `docs/contextos/asambleas-extraordinarias.md`, sección 7.

---

## Dudas e interpretaciones a validar

### Duda 1: ¿El origen "Dos miembros de CD" es válido para "Reforma estatuto"?

**Interpretación del usuario:** No cree que 2 miembros de CD puedan solicitar una AGE para reformar el estatuto.

**Análisis normativo:**

El art. 11 establece que **cualquier dos miembros de la CD** pueden solicitar la convocatoria de una AGE. El art. 11 no restringe **para qué motivo** la pueden solicitar — simplemente dice que pueden pedirla.

El art. 12 establece **qué puede resolver** la AGE una vez constituida. La reforma del estatuto es una de las facultades (sección 6 del doc).

Por lo tanto, una lectura literal sería: **2 miembros de CD pueden solicitar la convocatoria**, y una vez convocada, la AGE **puede tratar reforma de estatuto** si así está en el orden del día.

**PERO** hay una objeción práctica importante: la reforma del estatuto requiere **2/3 de los socios activos**, lo que implica una asamblea con amplia participación. Que 2 miembros la soliciten no garantiza que se logre el quórum ni la mayoría, pero **no invalida la convocatoria en sí**.

**Duda a validar:** ¿La normativa o la DGCyE establecen alguna restricción sobre qué orígenes pueden solicitar qué motivos? ¿O cualquier origen puede solicitar cualquier motivo, y la validez se juega en la asamblea (quórum + votación)?

---

### Duda 2: ¿El origen "Comisión Directiva" está en el art. 11?

El sistema incluye "Comisión Directiva" como origen de convocatoria, pero el art. 11 del Decreto 4767/72 enumera solo tres orígenes:

1. Más del 10% de socios
2. Dos miembros de CD
3. Dirección de Cooperación Escolar

**"Comisión Directiva" como órgano colegiado no aparece expresamente en el art. 11.**

**Interpretación posible:** La CD puede convocar una AGE por decisión propia (no por solicitud de 2 miembros, sino por decisión del cuerpo). Esto sería una práctica habitual pero no estaría expresamente en el art. 11.

**Duda a validar:** ¿"Comisión Directiva" como origen es una categoría válida según la normativa, o debería eliminarse y usar solo los 3 orígenes del art. 11? ¿O corresponde a una facultad implícita de la CD como órgano de gobierno entre asambleas?

---

### Duda 3: ¿El origen "Dirección de Cooperación Escolar" puede solicitar cualquier motivo?

El art. 11 dice que la DGCyE puede disponer una AGE. Los docs mencionan que es relevante en situaciones de "regularización, problemas institucionales, incumplimientos, necesidad de adoptar determinadas decisiones".

**Duda a validar:** ¿La DGCyE puede disponer una AGE para cualquier motivo (incluida reforma de estatuto), o su intervención está limitada a situaciones de regularización/normalización?

---

### Duda 4: ¿El motivo "Constitución cooperadora" tiene origen?

La constitución de una cooperadora se hace mediante una AGE. Pero en ese momento **no existe todavía una CD** que pueda solicitar la convocatoria, ni socios en sentido pleno (la asamblea constitutiva los crea).

**Duda a validar:** ¿Qué origen de convocatoria corresponde para la constitución? ¿Debería haber un origen específico "Asamblea constitutiva" o "Iniciativa fundacional"? ¿O se usa "Dirección de Cooperación Escolar" como origen que habilita la constitución?

---

### Duda 5: ¿Debería haber validación cruzada origen ↔ motivo?

Actualmente el sistema permite cualquier combinación de origen y motivo. Si la normativa establece restricciones, el sistema debería:

- **Opción A (validación estricta):** bloquear combinaciones inválidas. Ej: si motivo = "Reforma estatuto" y origen = "Dos miembros de CD", mostrar error.
- **Opción B (advertencia no bloqueante):** permitir la combinación pero mostrar una advertencia. Ej: "Verificá que el origen de convocatoria sea válido para este motivo."
- **Opción C (sin validación):** mantener la libertad total y dejar que el usuario decida.

**Duda a validar:** ¿Hay restricciones normativas reales que justifiquen una validación, o es una cuestión de práctica/estatuto interno de cada cooperadora?

---

### Duda 6: ¿El motivo "Modificación temporal atribuciones" debería registrar el plazo?

El art. 12 establece que la AGE puede modificar las atribuciones de la CD **hasta 90 días**, prorrogable por otro período igual (máximo 180 días).

Actualmente el sistema no registra el plazo de la modificación temporal ni la eventual prórroga.

**Duda a validar:** ¿Debería el sistema agregar campos para:
- `plazo_modificacion_dias` (hasta 90)
- `prorroga_dias` (hasta 90 adicionales)
- `fecha_vencimiento_modificacion` (calculada)

¿O esto se registra solo en el acta/orden del día y no necesita campos dedicados?

---

### Duda 7: ¿El plazo de convocatoria (5-15 días) debería validarse?

El art. 11 establece que la CD debe convocar la AGE entre 5 y 15 días desde que se produce la causa.

Actualmente el sistema no tiene un campo `fecha_solicitud` ni valida el plazo.

**Duda a validar:** ¿Debería el sistema:
- Agregar un campo `fecha_solicitud_convocatoria`?
- Validar que `fecha_asamblea - fecha_solicitud` esté entre 5 y 15 días?
- Mostrar advertencia si está fuera de plazo?

¿O esto es excesivo para el nivel de gestión que maneja el sistema?

---

### Duda 8: ¿El motivo "Relevo autoridades" requiere quórum especial?

El art. 12 dice que la AGE puede "relevar de sus funciones a miembros de las Comisiones Directivas". Pero los docs no especifican si esto requiere mayoría simple o especial.

La reforma de estatuto sí requiere 2/3 de socios activos.

**Duda a validar:** ¿El relevo de autoridades requiere mayoría simple o algún quórum especial? ¿Debería el sistema registrar el tipo de mayoría requerida según el motivo?

---

### Duda 9: ¿El motivo "Integración CD" es distinto de "Relevo autoridades"?

El sistema tiene ambos como motivos separados. Según los docs:

- **Relevo:** la AGE remueve a una autoridad existente (art. 12).
- **Integración:** la AGE elige reemplazantes cuando la CD no puede funcionar por vacantes (sección 10 del doc).

**Duda a validar:** ¿Son realmente motivos distintos, o "Integración CD" es una consecuencia de "Relevo autoridades" o de renuncias masivas? ¿Deberían combinarse en un solo motivo "Relevo e integración de autoridades"?

---

### Duda 10: ¿Falta el motivo "Disolución de la cooperadora"?

El doc `tipos-asambleas.md` menciona que la AGE puede tratar la disolución de la cooperadora, pero no está en la lista de `MOTIVOS_CONVOCATORIA` del sistema.

**Duda a validar:** ¿Debería agregarse "Disolución de la cooperadora" como motivo? ¿Es un caso que el sistema necesita contemplar?

---

## Matriz de combinaciones origen ↔ motivo (propuesta de análisis)

| Motivo \ Origen | >10% socios | 2 miembros CD | Dir. Coop. Escolar | Comisión Directiva |
|---|---|---|---|---|
| Reforma estatuto | ? | ? (duda del usuario) | ? | ? |
| Relevo autoridades | ? | ? | ? | ? |
| Integración CD | ? | ? | ? | ? |
| Decisión excepcional | ? | ? | ? | ? |
| Modificación temporal atribuciones | ? | ? | ? | ? |
| Constitución cooperadora | ? (¿no hay socios todavía?) | ? (¿no hay CD todavía?) | ? | ? (¿no hay CD todavía?) |
| Otro | ? | ? | ? | ? |
| Disolución (si se agrega) | ? | ? | ? | ? |

Cada celda con `?` es una combinación que necesita validación normativa.

---

## Resumen de lo que necesitamos decidir

1. **¿Hay restricciones reales entre origen y motivo, o son independientes?**
2. **¿"Comisión Directiva" es un origen válido o debería eliminarse?**
3. **¿Qué origen corresponde para "Constitución cooperadora"?**
4. **¿Falta el motivo "Disolución"?**
5. **¿Debería el sistema validar el plazo de convocatoria (5-15 días)?**
6. **¿Debería registrar el plazo de modificación temporal de atribuciones?**
7. **¿"Relevo" e "Integración CD" son motivos distintos o deberían unificarse?**
8. **¿Qué nivel de validación aplicar (bloqueante, advertencia, ninguna)?**

Estas dudas deben validarse contra el texto exacto del Decreto 4767/72 (arts. 11 y 12), el Decreto 355/73, el Estatuto Modelo vigente y el Manual de la DGCyE antes de implementar validaciones cruzadas en el sistema.

---

# Respuestas y conclusiones validadas

## Principio fundamental: separar tres conceptos distintos

**No mezclar "motivo de convocatoria" con "requisito para aprobar".** Son tres cosas distintas:

1. **Quién puede pedir la Asamblea** (art. 11 — origen de convocatoria)
2. **Qué puede resolver la Asamblea** (art. 12 — motivo/orden del día)
3. **Qué mayoría necesita cada resolución** (quórum especial según el tema)

El art. 11 establece quiénes pueden solicitar la convocatoria **y no limita esa facultad a determinados motivos**. Por lo tanto, **no se debe implementar una matriz rígida origen → motivos permitidos**.

## Duda 1 (resuelta): 2 miembros de CD + Reforma estatuto

**Sí, es válido.** 2 miembros de CD pueden impulsar la convocatoria de una AGE para cualquier tema, incluyendo reforma de estatuto. La AGE puede tratar la reforma, pero esta requiere mayoría especial (2/3 de socios activos).

```text
2 miembros CD
      ↓
pueden impulsar convocatoria
      ↓
AGE
      ↓
reforma estatutaria
      ↓
requiere mayoría especial (2/3)
```

**Solicitar la convocatoria ≠ aprobar el asunto.** No hay contradicción.

**Decisión del sistema:** NO implementar validación cruzada origen ↔ motivo. Mantener ambos campos como independientes.

## Dudas 2-4, 7-8 (postergadas): no implementar todavía

Las siguientes dudas **NO se implementan como reglas normativas** hasta contrastarlas directamente contra Decreto 4767/72 + Decreto 355/73 + Estatuto Modelo vigente:

- "Comisión Directiva" como origen adicional (¿está en el art. 11?)
- "Constitución" como tipo ordinario de AGE (¿qué origen corresponde?)
- "Disolución" sin verificar su tratamiento estatutario
- "Relevo" vs. "Integración CD" (¿son jurídicamente el mismo evento?)
- Quórum especial para cada tipo de "relevo"
- Matriz origen ↔ motivo

**Razón:** Es muy fácil convertir una interpretación administrativa en una falsa restricción del sistema. Primero hay que validar contra las fuentes normativas primarias.

## Dudas 5-6 (postergadas): plazo de convocatoria y modificación temporal

El plazo de convocatoria (5-15 días, art. 11) y el plazo de modificación temporal (90/180 días, art. 12) son normas reales, pero **no se implementan todavía** como validaciones del sistema. Se registran en el acta/orden del día.

## Lo que SÍ es seguro modelar

### Convocatoria

- quién la solicita (origen)
- fecha de solicitud
- motivo / orden del día
- fecha de realización
- cumplimiento del plazo de convocatoria (informativo, no bloqueante)

### Asamblea

- socios presentes
- quórum
- decisiones
- votación

### Resolución

- tema tratado
- resultado
- mayoría requerida
- resultado obtenido

Así no se asume que "motivo X → siempre quórum Y" si la normativa establece el requisito sobre **la decisión concreta**.

## Sobre la Memoria anual y el registro histórico

### Principio: no duplicar información

**La Asamblea registra las decisiones; Tesorería los movimientos; Inventario los bienes; Gobierno las autoridades; Actividades lo realizado. La Memoria reúne y narra lo relevante de todo eso.**

### Registrar obligatoriamente

**1. Asamblea**
- fecha
- tipo: constitutiva / ordinaria / extraordinaria
- motivo / orden del día
- asistentes
- resultado de cada punto tratado
- decisiones aprobadas
- votación cuando corresponda

**2. Cambios institucionales**
- autoridades elegidas/reemplazadas
- reformas del estatuto
- altas/bajas o modificaciones importantes
- decisiones sobre patrimonio
- decisiones económicas extraordinarias
- disolución/reorganización, si correspondiera

**3. Documentación**
- acta
- convocatoria
- documentación presentada
- resoluciones resultantes

### Para la Memoria: registro de hechos relevantes

En vez de obligar al usuario a escribir una "Memoria" manualmente, registrar:

**Actividad / hecho relevante**
- fecha o período
- categoría
- descripción breve
- resultado
- monto, si corresponde
- documentación asociada

La **Memoria anual** debería ser una síntesis automática de esos registros + decisiones institucionales.

### Lo que NO se debe obligar a registrar manualmente

- todas las personas presentes como entidades permanentes → basta el registro de asistencia
- todos los detalles económicos → ya están en Tesorería
- cada cargo nuevamente → se obtiene del registro histórico de autoridades
- cada bien → se obtiene del inventario
- cada actividad repetitiva → se registra como actividad

Esto es coherente con la documentación oficial: la presentación anual separa **Memoria, Balance, Informe de CRC, Inventario y demás documentación**.

## Fuentes

- [Manual de formación y fortalecimiento para cooperadoras escolares – Continuemos estudiando](https://continuemosestudiando.abc.gob.ar/contenido/manual-de-formacion-y-fortalecimiento-para-cooperadoras-escolares/)
- [Resolución N° 05/2025 SCE – Anexo III (Cooperadoras.ar)](https://www.cooperadoras.ar/asambleas_2025_archivos/2025_05%20Anexo%20III.pdf)
- [Cooperadoras.ar – Asambleas 2026](https://www.cooperadoras.ar/asambleas_2026.html)

