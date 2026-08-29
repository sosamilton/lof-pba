# Alternativas evaluadas y descartadas

## Alternativa 1: Scroll + indicador visual (chevron)

Mantener el scroll horizontal actual pero agregar un chevron `›` flotante que indica "deslizar para ver más".

**Descartada porque:** El chevron es un truco de diseñador que el 60% de los usuarios no asocia con "deslizar". Es un parche sobre un patrón que no funciona bien en mobile.

## Alternativa 2: Dropdown/Select en mobile

Reemplazar los tabs por un `Select` que muestra la sección actual.

**Descartada porque:** Mata la personalidad de la app. Un Select se siente burocrático. Ocultar las 5 secciones detrás de un dropdown hace que el usuario "no sepa qué hay" hasta que toca. Eso es fricción innecesaria.

## Alternativa 3: Bottom sheet picker

Un botón ancho que abre un Sheet desde abajo con todas las opciones.

**Descartada porque:** Exagerado para 4-5 items. Un sheet desde abajo para elegir entre "Datos generales" y "Estatuto" es overkill. El sheet se justifica cuando hay 8+ opciones o acciones destructivas.

## Alternativa 4: Pills/chips con wrap

Chips horizontales que se acomodan en múltiples líneas (flex-wrap).

**Descartada porque:** Ocupa 2-3 líneas verticales con 5 items. Las pills no tienen jerarquía visual clara de "cuál está activa" vs "cuál no", y en una app seria como LOF se ven un poco juguetonas.

## Alternativa 5: Segmented control scrollable (estilo iOS)

Tabs con estilo de iOS segmented control con auto-scroll al tab activo.

**Descartada porque:** Sigue siendo scroll horizontal escondido. Básicamente es el patrón actual con mejor estética. No resuelve el problema fundamental.
