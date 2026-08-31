<script>
  import { identidad } from '$core/data/identidad'

  let {
    stage = '',
    current = 0,
    total = 0,
    error = '',
    fadingOut = false,
  } = $props()

  // Etapa → mensaje humano + % aproximado de la etapa dentro del proceso total.
  // Las etapas reales que reporta verDemo + importFromLof:
  //   downloading → preparing → attachments → indexing → importing → finalizing
  const STAGE_INFO = {
    downloading:   { label: 'Descargando base de ejemplo…', weight: 5  },
    preparing:     { label: 'Preparando base de datos…',     weight: 5  },
    attachments:   { label: 'Cargando documentos adjuntos…', weight: 10 },
    indexing:      { label: 'Procesando registros…',         weight: 15 },
    importing:     { label: 'Importando datos de ejemplo…',  weight: 60 },
    finalizing:    { label: 'Finalizando configuración…',    weight: 5  },
  }

  // % global: suma ponderada de etapas completadas + progreso dentro de la etapa actual
  let progressPct = $derived.by(() => {
    if (!stage || !STAGE_INFO[stage]) return 0
    const stages = ['downloading', 'preparing', 'attachments', 'indexing', 'importing', 'finalizing']
    const currentIdx = stages.indexOf(stage)
    let pct = 0
    for (let i = 0; i < currentIdx; i++) {
      pct += STAGE_INFO[stages[i]].weight
    }
    // Progreso dentro de la etapa actual
    if (stage === 'importing' && total > 0) {
      pct += Math.round((current / total) * STAGE_INFO[stage].weight)
    } else {
      // Etapas no batcheables: sumar la mitad del weight (en progreso)
      pct += Math.round(STAGE_INFO[stage].weight * 0.5)
    }
    return Math.min(pct, 100)
  })

  let stageLabel = $derived(STAGE_INFO[stage]?.label || 'Cargando…')

  // Tips que rotan mientras espera (cambia cada 3s)
  const TIPS = [
    'Navegá la app sin configurar nada. Cuando quieras, podés salir de la demo e instalar tu cooperadora real.',
    'La demo incluye dos ejercicios económicos con movimientos, autoridades y memorias ya cargados.',
    'LOF funciona offline: una vez cargado, no necesitás conexión para usar la app.',
    'Los datos de la demo son de ejemplo. Tu instalación real tendrá tus propios socios, movimientos y autoridades.',
  ]
  let tipIdx = $state(0)
  let tipTimer = $state(null)

  $effect(() => {
    if (error) return
    tipTimer = setInterval(() => {
      tipIdx = (tipIdx + 1) % TIPS.length
    }, 3500)
    return () => { if (tipTimer) clearInterval(tipTimer) }
  })
</script>

<div
  class="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background px-6 transition-opacity duration-500 {fadingOut ? 'opacity-0' : 'opacity-100'}"
>
  <!-- Logo + nombre -->
  <div class="flex flex-col items-center gap-4 mb-10">
    <img src="/favicon.svg" alt="LOF" class="size-16 rounded-xl shadow-lg" />
    <div class="text-center">
      <h1 class="text-2xl font-black tracking-tight">{identidad.nombre}</h1>
      <p class="text-sm text-muted-foreground mt-0.5">{identidad.lema}</p>
    </div>
  </div>

  {#if error}
    <!-- Error -->
    <div class="max-w-sm text-center">
      <div class="text-destructive text-sm font-semibold mb-2">No se pudo cargar la demo</div>
      <p class="text-xs text-muted-foreground">{error}</p>
    </div>
  {:else}
    <!-- Spinner -->
    <div class="relative size-12 mb-6">
      <div class="absolute inset-0 rounded-full border-4 border-muted"></div>
      <div class="absolute inset-0 rounded-full border-4 border-transparent border-t-primary animate-spin"></div>
    </div>

    <!-- Mensaje de etapa -->
    <div class="text-center mb-4 max-w-sm">
      <p class="text-sm font-medium text-foreground">{stageLabel}</p>
    </div>

    <!-- Barra de progreso -->
    <div class="w-full max-w-xs">
      <div class="h-2 rounded-full bg-muted overflow-hidden">
        <div
          class="h-full bg-primary rounded-full transition-all duration-300 ease-out"
          style="width: {progressPct}%"
        ></div>
      </div>
      <div class="flex justify-between mt-1.5">
        <span class="text-[11px] text-muted-foreground">{progressPct}%</span>
        {#if stage === 'importing' && total > 0}
          <span class="text-[11px] text-muted-foreground">{current} / {total}</span>
        {/if}
      </div>
    </div>

    <!-- Tip rotatorio -->
    <div class="mt-8 max-w-sm text-center min-h-[3rem] flex items-center">
      <p class="text-xs text-muted-foreground leading-relaxed transition-opacity duration-500">
        {TIPS[tipIdx]}
      </p>
    </div>
  {/if}
</div>
