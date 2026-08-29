# Estado de los cambios ya implementados

## ListFormLayout (stack con back)

**Funciona bien.** El patrón stack-con-back en mobile y grid 2-col en desktop está aplicado a 4 módulos:
- Movimientos
- Comunidad
- TabAsambleas
- CargaPIAMatrix

**Issue menor:** El grid de desktop usa inline style `grid-template-columns` en lugar de clases Tailwind responsive. No es un bug (solo se renderiza en desktop), pero es inconsistente con el resto del sistema.

## Sidebar auto-close

**Funciona bien.** `MobileSidebarAutoClose.svelte` cierra el Sheet al navegar en mobile.

## Filtros colapsables

**Funciona bien** en Movimientos y Comunidad (FilterBar). El botón "Filtros" togglea los selects en mobile, siempre visibles en desktop.

**Issue:** Los selects dentro del panel colapsable tienen anchos fijos (`w-[120px]`, `w-[180px]`) que pueden cliparse en mobile.

## Tabs scrollables

**Funciona parcialmente.** El componente base `Tabs.List` ahora tiene `overflow-x-auto` + `justify-start` + scrollbar oculto. Pero 8 de 10 usuarios no tienen `min-w-0` en el `Tabs.Root` padre, lo que impide que el scroll se active.
