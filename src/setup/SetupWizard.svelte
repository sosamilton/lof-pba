<script>
  import { onMount } from 'svelte'
  import { SetupStore } from './setupStore.svelte'
  import { Button } from '$lib/components/ui/button'
  import { Alert, AlertDescription } from '$lib/components/ui/alert'
  import StepModulos from './steps/StepModulos.svelte'
  import StepEscuela from './steps/StepEscuela.svelte'
  import StepBancoKiosco from './steps/StepBancoKiosco.svelte'
  import StepEjercicioCargos from './steps/StepEjercicioCargos.svelte'
  import StepInstalar from './steps/StepInstalar.svelte'
  import { applyBrandTheme } from '$core/ui/theme'
  import { identidad } from '$core/data/identidad'
  import { getActiveBackend } from '$core/data/dataRepository'
  import { trackEvent } from '$core/analytics/plausible.js'
  import { router } from '$core/ui/router.svelte'

  const store = new SetupStore()
  const dev = import.meta.env.DEV
  const backend = getActiveBackend()
  // Si la landing navegó con ?modo=colaborador, pre-seleccionar ese modo
  const modoInicial = router.query?.modo === 'colaborador' ? 'colaborador' : 'normal'
  if (modoInicial === 'colaborador') {
    store.selectedModules.colaborador = true
  }

  onMount(() => {
    trackEvent('setup_started', { backend })
    store.init()
  })

  // Preview en vivo del color de marca elegido en el paso de escuela.
  $effect(() => {
    applyBrandTheme(store.schoolData.color_primario)
  })
</script>

{#if store.loading}
  <div class="max-w-[680px] mx-auto px-4 py-6">
    <p class="text-sm text-muted-foreground">Verificando estado del documento…</p>
  </div>
{:else}
  <main class="max-w-[680px] mx-auto px-4 py-6">
    <div class="mb-5">
      <h1 class="text-[22px] font-bold mb-1.5">
        {modoInicial === 'colaborador' ? 'Ayudar con la carga' : 'Configuración inicial de ' + identidad.nombre}
      </h1>
      <p class="text-sm text-muted-foreground leading-relaxed">
        {modoInicial === 'colaborador'
          ? 'Importá el archivo que te envió la cooperadora y empezá a cargar movimientos desde tu dispositivo.'
          : 'Elegí qué módulos instalar, configurá los datos de tu escuela y cooperadora, el ejercicio en curso y los cargos del estatuto.'}
      </p>
    </div>

    <!-- Progress dots -->
    <div class="flex items-center gap-1 mb-5">
      {#each store.steps as s, i}
        <div class="flex items-center gap-1.5 shrink-0">
          <span class="size-6 rounded-full flex items-center justify-center text-xs font-bold border {store.step === i ? 'border-primary/50 bg-primary/15' : store.step > i ? 'border-primary/50 bg-primary/20 text-primary' : 'border-border bg-muted/5'}">{i + 1}</span>
          <span class="text-[13px] font-bold {store.step === i ? 'opacity-100' : 'opacity-70'} max-[600px]:hidden">{s}</span>
        </div>
        {#if i < store.steps.length - 1}
          <div class="flex-1 h-0.5 min-w-[12px] {store.step > i ? 'bg-primary/40' : 'bg-border'}"></div>
        {/if}
      {/each}
    </div>

    {#if store.step === 0}
      <StepModulos {store} modo={modoInicial} />
    {:else if store.selectedModules.colaborador}
      <!-- Modo colaborador: saltear pasos intermedios, ir directo a instalar -->
      <StepInstalar {store} />
    {:else if store.step === 1}
      <StepEscuela {store} />
    {:else if store.step === 2}
      <StepBancoKiosco {store} />
    {:else if store.step === 3}
      <StepEjercicioCargos {store} />
    {:else if store.step === 4}
      <StepInstalar {store} />
    {/if}

    {#if store.error}
      <Alert variant="destructive" class="mt-3.5">
        <AlertDescription>
          <div class="font-extrabold text-[13px]">Error</div>
          <div class="text-[13px] mt-1 text-muted-foreground">{store.error}</div>
        </AlertDescription>
      </Alert>
    {/if}

    <div class="flex justify-end gap-2.5">
      {#if dev && store.step < 4 && !store.precargarDemoPorDefecto}
        <Button variant="outline" class="mr-auto border-dashed text-muted-foreground" onclick={() => store.fillDemoData()} title="Solo en desarrollo: rellena este paso con datos de ejemplo">
          Precargar datos demo
        </Button>
      {/if}
      {#if store.step > 0 && !store.installing && !store.restoreResult}
        <Button variant="outline" onclick={() => store.step -= 1}>Atrás</Button>
      {/if}
      {#if store.step < store.steps.length - 1 && !store.selectedModules.colaborador}
        <Button onclick={() => { trackEvent('setup_step_completed', { step: store.step + 1, step_name: store.steps[store.step], backend }); store.next() }} disabled={!store.canNext()}>Siguiente</Button>
      {:else}
        <Button onclick={() => store.doInstall()} disabled={store.installing}>
          {store.installing ? 'Instalando…' : 'Instalar ahora'}
        </Button>
      {/if}
    </div>
  </main>
{/if}
