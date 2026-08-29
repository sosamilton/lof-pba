# Grids viejos de 2/3 columnas sin fallback mobile

## Problemática

Algunos grids usan `grid-cols-2` o `grid-cols-3` sin breakpoint `sm:`, forzando múltiples columnas en mobile.

## Ubicaciones afectadas

| Archivo | Línea | Snippet | Fix |
|---------|-------|---------|-----|
| `IntercambioTab.svelte` | 242 | `grid grid-cols-2 sm:grid-cols-3` | `grid-cols-1 sm:grid-cols-3` |
| `Cierre.svelte` | 128 | `grid grid-cols-2 md:grid-cols-4` | `grid-cols-1 sm:grid-cols-2 md:grid-cols-4` |
| `TabFlujoCaja.svelte` | 32 | `grid grid-cols-3` | `grid-cols-1 sm:grid-cols-3` |
