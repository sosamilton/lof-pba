# Flex-wrap con espacio vertical excesivo

## Problemática

Los contenedores `flex flex-wrap` en barras de herramientas generan múltiples filas en mobile, ocupando demasiado espacio vertical antes de llegar al contenido.

## Ubicaciones más afectadas

| Archivo | Línea | Elementos | Filas estimadas en 375px |
|---------|-------|-----------|--------------------------|
| `Movimientos.svelte` | 285, 310 | Search + 4 selects + combobox + botón | 3-4 |
| `FilterBar.svelte` | 29, 56 | Search + 5 selects + botón | 3-4 |
| `CargaPIAMatrix.svelte` | 576, 661, 816 | Header + period header + footer | 2-3 cada uno |
| `TabAsambleas.svelte` | 80 | Search + 3 botones crear | 2-3 |
| `AsambleasAutoridades.svelte` | 36 | Title + ejercicio + tabs | 2-3 |

## Fix sugerido

Para las barras más densas, considerar `grid grid-cols-1 sm:flex sm:flex-wrap` en lugar de `flex flex-wrap`, para que en mobile los elementos se apilen verticalmente de forma controlada en lugar de wrappear caóticamente.
