<script>
  import { onMount } from 'svelte'
  import { retryAccess, subscribeAccess, getGristStatus } from '$core/grist'
  import { Button } from '$lib/components/ui/button'
  import { Alert, AlertDescription } from '$lib/components/ui/alert'
  import ShieldCheckIcon from '@lucide/svelte/icons/shield-check'

  let status = $state(getGristStatus())
  let retrying = $state(false)

  onMount(() => {
    return subscribeAccess((s) => {
      status = s
    })
  })

  const handleRetry = async () => {
    retrying = true
    await retryAccess()
    retrying = false
  }
</script>

<main class="max-w-[620px] mx-auto px-4 py-8">
  <div class="rounded-2xl border border-border bg-muted/5 p-5">
    <div class="size-10 rounded-xl flex items-center justify-center mb-3.5 border border-primary/25 bg-primary/10 text-primary">
      <ShieldCheckIcon class="size-[22px]" />
    </div>

    <h1 class="text-xl font-bold leading-tight mb-2">AppCoop necesita acceso al documento</h1>

    <p class="text-sm text-muted-foreground leading-relaxed mb-4">
      El widget está cargado dentro de Grist, pero todavía no tiene permisos
      para acceder a las tablas del documento. Sin esto, la app no puede
      funcionar.
    </p>

    <div class="flex flex-col gap-2.5 mb-4">
      <div class="flex gap-2.5 items-start rounded-xl border border-border bg-muted/5 p-3">
        <div class="size-6.5 rounded-lg flex items-center justify-center font-black text-[13px] shrink-0 border border-primary/35 bg-primary/12">1</div>
        <div>
          <div class="font-extrabold text-[13px]">Abrir configuración del widget</div>
          <div class="text-[13px] text-muted-foreground mt-0.5 leading-relaxed">
            Hacé clic en el ícono <span class="font-mono text-[0.92em]">⚙</span> (engrane) arriba a la
            derecha del widget, o en <span class="font-mono text-[0.92em]">⋮</span> →
            <span class="font-mono text-[0.92em]">Widget options</span>.
          </div>
        </div>
      </div>

      <div class="flex gap-2.5 items-start rounded-xl border border-border bg-muted/5 p-3">
        <div class="size-6.5 rounded-lg flex items-center justify-center font-black text-[13px] shrink-0 border border-primary/35 bg-primary/12">2</div>
        <div>
          <div class="font-extrabold text-[13px]">Cambiar el nivel de acceso</div>
          <div class="text-[13px] text-muted-foreground mt-0.5 leading-relaxed">
            En <span class="font-mono text-[0.92em]">Access level</span>, seleccioná
            <strong>Full document access</strong>.
          </div>
        </div>
      </div>

      <div class="flex gap-2.5 items-start rounded-xl border border-border bg-muted/5 p-3">
        <div class="size-6.5 rounded-lg flex items-center justify-center font-black text-[13px] shrink-0 border border-primary/35 bg-primary/12">3</div>
        <div>
          <div class="font-extrabold text-[13px]">Confirmar el cambio</div>
          <div class="text-[13px] text-muted-foreground mt-0.5 leading-relaxed">
            Grist pedirá confirmación. Aceptá y volvé a hacer clic en
            &laquo;Reintentar&raquo; abajo.
          </div>
        </div>
      </div>
    </div>

    <div class="flex gap-2.5">
      <Button onclick={handleRetry} disabled={retrying}>
        {retrying ? 'Verificando…' : 'Reintentar acceso'}
      </Button>
    </div>

    {#if retrying}
      <p class="mt-2.5 text-[13px] text-muted-foreground">Esperando confirmación de Grist…</p>
    {/if}
  </div>

  <Alert class="mt-4 border-yellow-500/25 bg-yellow-500/5">
    <AlertDescription class="text-[13px] leading-relaxed">
      ¿No ves la opción de permisos? Es posible que necesites permisos de
      <strong>editor</strong> en el documento. Si sos solo lector, pedile a un
      editor o dueño del documento que cambie el acceso del widget.
    </AlertDescription>
  </Alert>
</main>
