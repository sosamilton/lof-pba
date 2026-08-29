# Skeletons con grid inline no responsive

## Problemática

Los skeletons de carga usan `style="grid-template-columns: 320px 1fr"` que fuerza 2 columnas en todos los viewports.

## Ubicaciones afectadas

| Archivo | Línea |
|---------|-------|
| `PageScaffold.svelte` | 30 |
| `ListSkeleton.svelte` | 14 |

## Fix sugerido

Reemplazar inline style con `md:grid-cols-[320px_1fr]` y dejar `grid-cols-1` como default mobile.
