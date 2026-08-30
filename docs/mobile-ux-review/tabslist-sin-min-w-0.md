# Tabs.List sin min-w-0

## Problemática

El componente base `Tabs.List` tiene `overflow-x-auto` pero si el `Tabs.Root` padre no tiene `min-w-0`, el flex container no permite que el contenido se encoja, y el scroll horizontal no se activa.

## Ubicaciones a fixear (8)

| Archivo | Línea | Contexto |
|---------|-------|----------|
| `ResumenMensual.svelte` | 95 | Tabs principales (flujo, gastos, salud) |
| `ResumenMensual.svelte` | 121 | Sub-tabs (mensual/semanal) |
| `Cierre.svelte` | 151 | Tabs PIA/Nómina/Historial |
| `TablaCargos.svelte` | 100 | Selector de organismo |
| `Cooperadora.svelte` | 195 | Tabs institucional |
| `Configuracion.svelte` | 43 | Tabs configuración |
| `AsambleasAutoridades.svelte` | 62 | Tabs asambleas/histórico/memoria |
| `DialogHistorico.svelte` | 155 | Tabs organismo en diálogo |

## Fix sugerido

Agregar `class="min-w-0"` al `Tabs.Root` y `class="w-full"` al `Tabs.List` (preservando clases existentes).

## Ubicaciones ya OK (2)

- `TabAutoridades.svelte` — ya tiene `min-w-0` + `w-full`
- `TabHistorico.svelte` — ya tiene `min-w-0` + `w-full`
