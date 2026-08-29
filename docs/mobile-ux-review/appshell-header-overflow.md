# AppShell header overflow

## Problemática

El header del AppShell tiene `h-12` fija con múltiples elementos a la derecha que pueden desbordar en mobile:
- Sidebar trigger
- Título (flex-1 truncate)
- Botón paleta de comandos
- Badge "Modo colaborador" (condicional)
- Badge "Modo demo" + botón "Salir de la demo" (condicional)
- Botón "Instalar" PWA (condicional)
- Versión + icono update (condicional)

En el peor caso (demo + colaborador + install + update), son ~7 elementos en 375px.

## Fix sugerido

1. Agregar `min-w-0 overflow-hidden` al `<header>`
2. `shrink-0` a todos los elementos fijos (trigger, command, badges, botones)
3. Ocultar labels de badges en mobile (mostrar solo icono): `hidden sm:inline-flex` en el texto
4. Mover versión/update a una posición menos prominente en mobile (ej. footer del sidebar)
