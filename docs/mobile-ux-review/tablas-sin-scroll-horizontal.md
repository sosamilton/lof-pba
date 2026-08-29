# Tablas sin scroll horizontal

## Problemática

5 tablas no tienen wrapper `overflow-x-auto` y desbordarán horizontalmente en mobile (375px).

## Ubicaciones afectadas

| Archivo | Línea | Tabla | Columnas | Riesgo |
|---------|-------|-------|----------|--------|
| `CargaPIAMatrix.svelte` | 716 | Matriz de rubros | 6 (código, rubro, cuenta, detalle, importe, acciones) | Alto |
| `ConfirmarFirmaDialog.svelte` | 56 | Resumen de firma | 4+ | Alto |
| `TabGastosIngresos.svelte` | 96, 136 | Gastos/Ingresos por rubro | 4+ | Alto |
| `TabFlujoCaja.svelte` | 107 | Flujo de caja | 4+ | Alto |
| `TabComparativa.svelte` | 181 | Comparativa entre ejercicios | 5+ | Alto |

## Fix sugerido

Envolver cada `Table.Root` en `<div class="overflow-x-auto rounded-lg border">`. Para `CargaPIAMatrix` y `ConfirmarFirmaDialog`, cambiar `overflow-hidden` por `overflow-x-auto overflow-y-hidden`.

## Ubicaciones ya OK

- `TabAutoridades.svelte` (línea 63) — tiene wrapper
- `TabHistorico.svelte` (línea 57) — tiene wrapper
- `TablaCargos.svelte` (línea 149) — tiene wrapper
- `DialogHistorico.svelte` (línea 176) — tiene `overflow-auto`
- `TabMorosidad.svelte` (línea 142) — solo 2 columnas, bajo riesgo
