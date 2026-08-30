# Hacks de viewport height

## Problemática

Se usa `100vh` en lugar de `100dvh` (dynamic viewport height), que no cuenta la barra de URL dinámica de browsers mobile. También hay `min-h-[75vh]` que fuerza altura mínima excesiva.

## Ubicaciones afectadas

| Archivo | Línea | Snippet | Fix |
|---------|-------|---------|-----|
| `TabAsambleas.svelte` | 123 | `max-h-[calc(100vh-220px)]` | `max-h-[calc(100dvh-180px)]` |
| `MovimientosList.svelte` | 18 | `max-h-[calc(100vh-200px)]` | `max-h-[calc(100dvh-180px)]` |
| `Comunidad.svelte` | 179 | `min-h-[75vh]` | Remover o usar `max-h-[75dvh]` |
| `CargaPIAMatrix.svelte` | 618 | `min-h-[75vh]` | Remover o usar `max-h-[75dvh]` |
| `DialogHistorico.svelte` | 175 | `max-h-[50vh]` | `max-h-[60dvh]` |
