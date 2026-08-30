# Plan de implementación sugerido

## Fase 1 — Crítico (tablas + header)

1. Envolver 5 tablas sin scroll en `overflow-x-auto`
2. Fix AppShell header overflow (min-w-0, shrink-0, hide labels en mobile)

## Fase 2 — Alto (tabs + filtros)

3. Agregar `min-w-0` + `w-full` a 8 `Tabs.List` restantes
4. Aplicar `w-full sm:w-[NNNpx]` a todos los selects de filtros

## Fase 3 — Medio (skeletons + grids)

5. Fix skeletons con grid inline
6. Fix 3 grids viejos sin fallback mobile

## Fase 4 — Bajo (viewport + flex-wrap)

7. Migrar `100vh` → `100dvh` en 5 ubicaciones
8. Remover `min-h-[75vh]` en 2 ubicaciones
9. Optimizar flex-wrap más densos con grid mobile
