# Recomendaciones adicionales

## Bottom action bar en CargaPIAMatrix

La matriz de carga PIA tiene un footer con acciones (Guardar, Firmar, Volver) que en mobile queda lejos del thumb. Considerar un sticky bottom bar en mobile.

## Wizard footer responsive

`AsambleaWizard.svelte` (línea 311) y `WizardStepRevisar.svelte` (línea 113) usan `flex flex-wrap justify-between` para los botones back/forward. En mobile deberían usar `flex-col-reverse sm:flex-row` con `w-full` para que los botones ocupen todo el ancho.

## Setup wizard

`StepEjercicioCargos.svelte` tiene múltiples `w-[110px]`/`w-[120px]` en un `flex-wrap` que puede cliparse. Aplicar el mismo patrón `w-full sm:w-[NNNpx]`.
