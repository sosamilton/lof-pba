# Anchos fijos en barras de filtros

## Problemática

Los `Select.Trigger` y `Combobox` en barras de filtros usan anchos fijos (`w-[120px]`, `w-[180px]`, `w-[200px]`) que pueden cliparse o forzar wrapping excesivo en mobile.

## Ubicaciones afectadas

| Archivo | Línea(s) | Elementos | Ancho total aproximado |
|---------|----------|-----------|----------------------|
| `Movimientos.svelte` | 312, 322, 332, 343 | 3 Selects + Combobox | ~620px |
| `Comunidad.svelte` (via FilterBar) | 85, 99, 114, 125, 139 | 5 Selects | ~700px |
| `FilterBar.svelte` | 64 | Default 140px | — |
| `TabGastosIngresos.svelte` | 46, 55 | 2 Selects | ~310px |
| `CargaPIAMatrix.svelte` | 584 | EjercicioSelector | 200px |
| `AsambleasAutoridades.svelte` | 54 | EjercicioSelector | 180px |
| `DialogHistorico.svelte` | 141 | EjercicioSelector | 140px |
| `SearchInput.svelte` | 8 | `min-w-[200px]` | 200px mínimo |

## Fix sugerido

Patrón `w-full sm:w-[NNNpx]` para todos los triggers/selectores en barras de filtros. En mobile ocupan el ancho disponible; en desktop mantienen su ancho fijo.

Para `SearchInput`, cambiar `min-w-[200px]` a `min-w-[140px] sm:min-w-[200px]`.
