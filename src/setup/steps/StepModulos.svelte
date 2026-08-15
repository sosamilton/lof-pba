<script>
  import * as Card from '$lib/components/ui/card'
  import * as Field from '$lib/components/ui/field'
  import { Checkbox } from '$lib/components/ui/checkbox'
  import { Switch } from '$lib/components/ui/switch'
  import { Input } from '$lib/components/ui/input'
  import { Badge } from '$lib/components/ui/badge'
  import { MODULES } from '../setupStore.svelte'
  import { identidad } from '$core/data/identidad'

  let { store } = $props()

  const modeKeys = Object.entries(MODULES).filter(([, m]) => !m.optional)
  const optionalKeys = Object.entries(MODULES).filter(([, m]) => m.optional)
</script>

{#if store.isDev}
  <Card.Root class="mb-4 border-amber-500/30">
    <Card.Content class="pt-6">
      <h2 class="text-[17px] font-bold mb-1.5">Datos de prueba (desarrollo)</h2>
      <p class="text-[13px] text-muted-foreground mb-4">
        Cargá automáticamente datos de ejemplo para probar la app sin completar
        cada paso a mano. Solo disponible en desarrollo.
      </p>

      <div class="flex flex-col gap-3">
        <!-- Check 1: precargar datos demo en todos los pasos -->
        <div class="flex items-start gap-3 p-3.5 rounded-xl border border-amber-500/40 bg-amber-500/5">
          <Switch
            checked={store.precargarDemoPorDefecto}
            onCheckedChange={(v) => {
              store.precargarDemoPorDefecto = v
              if (v) store.fillAllDemoData()
            }}
            class="mt-0.5"
          />
          <div>
            <div class="font-bold text-[13px] text-amber-700 dark:text-amber-400">
              Precargar datos demo en todos los pasos
            </div>
            <p class="text-[12px] text-muted-foreground mt-0.5 m-0 leading-relaxed">
              Rellena automáticamente los campos de cada paso con datos de
              ejemplo (módulos, escuela, banco, ejercicio y cargos) y pasa
              directo a instalar. Reemplaza al botón "Precargar datos demo"
              que aparecía en cada paso.
            </p>
          </div>
        </div>

        <!-- Check 2: cargar datos de prueba (generador) -->
        <div class="flex items-start gap-3 p-3.5 rounded-xl border border-amber-500/40 bg-amber-500/5">
          <Switch
            checked={store.cargarDatosPrueba}
            onCheckedChange={(v) => { store.cargarDatosPrueba = v }}
            class="mt-0.5"
          />
          <div>
            <div class="font-bold text-[13px] text-amber-700 dark:text-amber-400">
              Cargar datos de prueba tras instalar
            </div>
            <p class="text-[12px] text-muted-foreground mt-0.5 m-0 leading-relaxed">
              Genera personas, socios, movimientos
              {#if store.selectedModules.gestion_integral || store.selectedModules.carga_consolidada}
                , asamblea(s) y autoridades de CD/CRC
              {/if}
              y planillas PIA/Nómina con Refs resueltas para probar performance
              de listados y filtros.
            </p>
          </div>
        </div>

        {#if store.precargarDemoPorDefecto}
          <div class="p-3 rounded-lg border border-primary/30 bg-primary/5 text-[12px] text-muted-foreground">
            Datos demo cargados en todos los pasos. Vas directo a instalar
            {#if store.cargarDatosPrueba}con generación de datos de prueba incluida{/if}.
          </div>
        {/if}

        <!-- Formulario de cantidades: visible cuando se va a generar datos -->
        {#if store.cargarDatosPrueba}
          <div class="mt-1 p-3.5 rounded-xl border border-border bg-muted/5">
            <div class="font-extrabold text-[13px] mb-3">Cantidades a generar</div>
            <Field.FieldSet>
              <Field.FieldLegend class="text-[12px] text-muted-foreground">
                Ajustá los volúmenes. Valores por defecto = generación actual.
              </Field.FieldLegend>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                <Field.Field>
                  <Field.FieldLabel for="dp-personas" class="text-[12px]">Personas</Field.FieldLabel>
                  <Input
                    id="dp-personas"
                    type="number"
                    min="1"
                    bind:value={store.datosPruebaConfig.cantPersonas}
                    class="h-9"
                  />
                </Field.Field>
                <Field.Field>
                  <Field.FieldLabel for="dp-socios" class="text-[12px]">Socios</Field.FieldLabel>
                  <Input
                    id="dp-socios"
                    type="number"
                    min="1"
                    bind:value={store.datosPruebaConfig.cantSocios}
                    class="h-9"
                  />
                </Field.Field>
                <Field.Field>
                  <Field.FieldLabel for="dp-movimientos" class="text-[12px]">Movimientos</Field.FieldLabel>
                  <Input
                    id="dp-movimientos"
                    type="number"
                    min="1"
                    bind:value={store.datosPruebaConfig.cantMovimientos}
                    class="h-9"
                  />
                </Field.Field>
                <Field.Field>
                  <Field.FieldLabel for="dp-batch" class="text-[12px]">Tamaño de lote (batch)</Field.FieldLabel>
                  <Input
                    id="dp-batch"
                    type="number"
                    min="1"
                    bind:value={store.datosPruebaConfig.batchSize}
                    class="h-9"
                  />
                  <Field.FieldDescription class="text-[11px]">
                    Para volúmenes altos (~10000) conviene aumentarlo.
                  </Field.FieldDescription>
                </Field.Field>
                <Field.Field>
                  <Field.FieldLabel for="dp-ejercicios" class="text-[12px]">Ejercicios</Field.FieldLabel>
                  <Input
                    id="dp-ejercicios"
                    type="number"
                    min="1"
                    max="5"
                    bind:value={store.datosPruebaConfig.cantEjercicios}
                    class="h-9"
                  />
                  <Field.FieldDescription class="text-[11px]">
                    Crea ejercicios anteriores además del actual. Cada uno con su asamblea y autoridades, para probar el histórico multi-ejercicio.
                  </Field.FieldDescription>
                </Field.Field>
                <Field.Field>
                  <Field.FieldLabel for="dp-asambleas" class="text-[12px]">Asambleas por ejercicio</Field.FieldLabel>
                  <Input
                    id="dp-asambleas"
                    type="number"
                    min="1"
                    max="12"
                    bind:value={store.datosPruebaConfig.cantAsambleas}
                    class="h-9"
                  />
                  <Field.FieldDescription class="text-[11px]">
                    Más de 1 genera asambleas en distintos meses del ejercicio para probar cierre y cambio de período.
                  </Field.FieldDescription>
                </Field.Field>
              </div>
            </Field.FieldSet>
          </div>
        {/if}
      </div>
    </Card.Content>
  </Card.Root>
{/if}

<Card.Root class="mb-4">
  <Card.Content class="pt-6">
    <h2 class="text-[17px] font-bold mb-1.5">¿Cómo vas a usar {identidad.nombre}?</h2>
    <p class="text-[13px] text-muted-foreground mb-4">Elegí el tipo de gestión según cuánto quieras registrar en la app. Podés cambiar de modo más adelante desde la configuración.</p>

    <div class="flex flex-col gap-2.5">
      {#each modeKeys as [key, mod]}
        <button
          type="button"
          disabled={!mod.implemented}
          onclick={() => store.toggleModule(key)}
          class="flex items-start gap-3 p-3.5 rounded-xl border text-left transition-colors {store.selectedModules[key] ? 'border-primary/50 bg-primary/5' : 'border-border bg-muted/5'} {!mod.implemented ? 'opacity-55 cursor-not-allowed' : 'cursor-pointer hover:border-primary/30'}"
        >
          <div class="mt-0.5 size-5 rounded-full border-2 shrink-0 flex items-center justify-center {store.selectedModules[key] ? 'border-primary' : 'border-muted-foreground/30'}">
            {#if store.selectedModules[key]}
              <div class="size-2.5 rounded-full bg-primary"></div>
            {/if}
          </div>
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <span class="font-extrabold text-sm">{mod.label}</span>
              {#if !mod.implemented}
                <Badge variant="secondary" class="text-[10px] py-0 px-1.5">Próximamente</Badge>
              {/if}
            </div>
            <div class="text-[13px] text-muted-foreground mt-0.5 leading-relaxed">{mod.description}</div>
          </div>
        </button>
      {/each}
    </div>

    {#if optionalKeys.length > 0}
      <div class="mt-4 pt-4 border-t border-border">
        <div class="text-[13px] font-bold mb-2.5 text-muted-foreground">Complementos opcionales (podés activarlos o no)</div>
        <div class="flex flex-col gap-2.5">
          {#each optionalKeys as [key, mod]}
            <label class="flex items-start gap-2.5 p-3 rounded-xl border bg-muted/5 cursor-pointer transition-colors hover:border-primary/30 {store.selectedModules[key] ? 'border-primary/40 bg-primary/5' : 'border-border'}">
              <Checkbox checked={store.selectedModules[key]} onchange={() => store.toggleModule(key)} class="mt-0.5" />
              <div>
                <div class="font-extrabold text-sm">{mod.label}</div>
                <div class="text-[13px] text-muted-foreground mt-0.5">{mod.description}</div>
              </div>
            </label>
          {/each}
        </div>
      </div>
    {/if}
  </Card.Content>
</Card.Root>
