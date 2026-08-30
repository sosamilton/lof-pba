# Solución adoptada: scroll-fade (utility oficial de shadcn)

## Hallazgo clave

Al revisar la documentación oficial de shadcn (https://ui.shadcn.com/docs/utils/scroll-fade), encontramos que shadcn incluye un utility CSS llamado `scroll-fade` que hace exactamente lo que necesitamos: agrega un fade visual en los bordes de un scroll container que reacciona al scroll position, **sin JavaScript, sin librerías extra, puramente CSS**.

## Cómo funciona scroll-fade

- Usa `mask-image` con `animation-timeline: scroll()` (CSS scroll-driven animations)
- El fade se aplica al contenido mismo (mask), no es un overlay de color
- Es scroll-aware: el borde inicial está nítido, el borde final tiene fade; al hacer scroll, el fade se mueve; al llegar al final, el borde final se vuelve nítido
- Si el contenido no desborda, no se muestra ningún fade (no hay que verificar overflow manualmente)
- En browsers que no soportan scroll-driven animations (Firefox), cae a un fade estático en ambos bordes
- Soporta RTL automáticamente con `scroll-fade-s` / `scroll-fade-e`

## Clases disponibles

| Clase | Eje | Función |
|-------|-----|---------|
| `scroll-fade-x` | Horizontal | Fade en bordes izquierdo y derecho, trackea scroll horizontal |
| `scroll-fade-s` | Start edge | Fade solo en el borde inicial (izquierdo en LTR) |
| `scroll-fade-e` | End edge | Fade solo en el borde final (derecho en LTR) |
| `scroll-fade-none` | — | Desactiva el fade (útil con responsive: `md:scroll-fade-none`) |
| `scroll-fade-<n>` | — | Tamaño del fade en spacing scale (ej: `scroll-fade-4`, `scroll-fade-24`) |

## Por qué es la mejor solución

1. **Es el patrón oficial de shadcn.** No estamos inventando nada ni sumando librerías. Es el utility que el equipo de shadcn diseñó exactamente para este caso de uso.

2. **Zero JavaScript.** Puramente CSS con `mask-image` + `animation-timeline: scroll()`. No hay scroll listeners, no hay re-renders, no hay estado. Cero costo de runtime.

3. **El fade es el indicador más honesto.** No le dice al usuario "toca acá" (chevron) ni "estás en el 40%" (barra). Le dice "esto sigue". Es lo más cercano a cómo el cerebro naturalmente entiende que hay más contenido. Es el mismo patrón que usa iOS en Safari y Android en Chrome.

4. **No hay que verificar overflow.** Si el contenido no desborda, no se muestra el fade. Esto significa que podemos aplicar `scroll-fade-x` a todos los `Tabs.List` sin preocuparnos por los que tienen 3 tabs que sí caben.

5. **Responsive sin esfuerzo.** Con `scroll-fade-x md:scroll-fade-none` podemos activar el fade solo en mobile y desactivarlo en desktop donde los tabs caben.

6. **Se integra con el componente Tabs existente.** Solo hay que agregar la clase `scroll-fade-x` al `Tabs.List`. No se cambia el componente, no se cambia el estado, no se cambia la API.

## Estado del proyecto

- **Tailwind CSS:** 4.3.3 (soporta scroll-driven animations) ✓
- **shadcn-svelte:** El utility `scroll-fade` fue portado a shadcn-svelte (PR #2816, commit 15f819e)
- **Instalación:** El proyecto no tiene el paquete `shadcn` instalado directamente. Hay que verificar si el utility viene con la versión actual de shadcn-svelte o si hay que instalarlo manualmente.
- **Compatibilidad:** Chrome/Edge/Safari soportan scroll-driven animations. Firefox tiene un bug conocido (issue #11291) donde el fade se aplica siempre, incluso sin overflow. Esto es aceptable porque el fade es sutil y no rompe la funcionalidad.

## Implementación

### Paso 1: Verificar/installar scroll-fade

Verificar si `scroll-fade` ya está disponible en el proyecto. Si no, instalar el paquete `shadcn` o agregar las clases CSS manualmente desde el source de shadcn.

### Paso 2: Modificar Tabs.List

En `src/lib/components/ui/tabs/tabs-list.svelte`, agregar `scroll-fade-x` a la lista de classes del base:

```text
base: "rounded-lg p-[3px] ... overflow-x-auto ... scroll-fade-x md:scroll-fade-none ..."
```

Esto activa el fade horizontal en mobile y lo desactiva en desktop.

### Paso 3: Auto-scroll al tab activo (opcional pero recomendado)

Agregar un `$effect` en el componente que usa Tabs que, cuando cambie el tab activo, haga `scrollIntoView({ behavior: 'smooth', inline: 'start' })` del trigger activo. Esto asegura que el tab activo siempre sea visible sin que el usuario tenga que deslizar manualmente.

### Paso 4: Botones de crear asamblea

Para los 3 botones ("Ordinaria/Autoridades", "Extraordinaria", "Reunión de CD") en TabAsambleas:

- Instalar `dropdown-menu` de shadcn-svelte (no está instalado actualmente)
- Reemplazar los 3 botones por un solo botón `+ Nueva asamblea` con un dropdown que muestre las 3 opciones
- En desktop, se puede mantener el botón + dropdown, o mostrar los 3 botones si hay espacio

## Comparación final

| Criterio | scroll-fade (oficial) | Otras alternativas |
|----------|----------------------|-------------------|
| Descubribilidad | Alta (fade dice "hay más") | Media a baja |
| Espacio vertical | 1 línea | 1-3 líneas |
| Velocidad de cambio | Alta (1 tap + deslizar) | Media (2 taps en Select/Sheet) |
| Consistencia desktop | Sí (mismo componente) | No (cambia patrón) |
| Costo implementación | Muy bajo (1 clase CSS) | Medio |
| JavaScript | No (puro CSS) | Sí (todas las otras) |
| Dependencias | Ninguna (ya en shadcn) | Embla, Sheet, Select, etc. |
| Es best practice | Sí (utility oficial de shadcn) | No (workarounds ad-hoc) |
