<script>
  import { Button } from '$lib/components/ui/button'
  import { Separator } from '$lib/components/ui/separator'
  import { dateToInput } from '$core/utils/utils.js'
  import { formatFecha } from '$core/format/format'
  import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left'
  import CheckIcon from '@lucide/svelte/icons/check'
  import InfoIcon from '@lucide/svelte/icons/info'
  import AlertTriangleIcon from '@lucide/svelte/icons/triangle-alert'

  let {
    store,
    computed,
    ORGANISMO_LABELS,
    CONVOCATORIA_ORIGEN_LABEL,
    onBackToData,
    onBackToAutoridades,
    onGuardarSinVerificar,
    onGuardarYVerificar,
    onClose,
  } = $props()
</script>

<div class="flex flex-col gap-4">
  <div class="rounded-lg border border-primary/40 bg-primary/5 p-3">
    <div class="flex items-start gap-2">
      <InfoIcon class="size-4 shrink-0 text-primary mt-0.5" />
      <div class="flex flex-col gap-1 text-xs">
        <span class="font-bold text-foreground">Revisá los datos antes de confirmar</span>
        <span class="text-muted-foreground leading-relaxed">
          Una vez que verifiques la asamblea, la edición quedará <strong>bloqueada permanentemente</strong>. No se podrá modificar ni eliminar. Revisá que todo esté correcto.
        </span>
      </div>
    </div>
  </div>

  <!-- Datos de la asamblea -->
  <div class="rounded-lg border border-border p-3">
    <span class="text-xs font-bold text-muted-foreground">Datos de la asamblea</span>
    <div class="mt-2 grid gap-2 text-xs sm:grid-cols-2">
      <div><span class="text-muted-foreground">Fecha:</span> <span class="font-medium">{formatFecha(store.asambleaForm.fecha) || '—'}</span></div>
      <div><span class="text-muted-foreground">Acta N°:</span> <span class="font-medium">{store.asambleaForm.acta_numero || '—'}</span></div>
      <div><span class="text-muted-foreground">Fojas:</span> <span class="font-medium">{store.asambleaForm.acta_fojas || '—'}</span></div>
      <div><span class="text-muted-foreground">Tipo:</span> <span class="font-medium">{computed.isAgo ? 'Ordinaria' : computed.isAge ? 'Extraordinaria' : 'Reunión CD'}</span></div>
      {#if computed.isAge}
        <div><span class="text-muted-foreground">Motivo:</span> <span class="font-medium">{store.asambleaForm.motivo_convocatoria || '—'}</span></div>
        <div><span class="text-muted-foreground">Origen:</span> <span class="font-medium">{CONVOCATORIA_ORIGEN_LABEL(store.asambleaForm.convocatoria_origen) || '—'}</span></div>
      {/if}
      {#if computed.isAgo}
        <div><span class="text-muted-foreground">Socios presentes:</span> <span class="font-medium">{store.asambleaForm.socios_presentes_cantidad || '—'}</span></div>
        <div><span class="text-muted-foreground">Cuota social:</span> <span class="font-medium">{store.asambleaForm.cuota_social_importe ? `$${store.asambleaForm.cuota_social_importe} (${store.asambleaForm.cuota_social_modalidad || '—'})` : '—'}</span></div>
        <div><span class="text-muted-foreground">Caja chica:</span> <span class="font-medium">{store.asambleaForm.caja_chica_importe ? `$${store.asambleaForm.caja_chica_importe}` : '—'}</span></div>
      {/if}
    </div>
    {#if store.asambleaForm.orden_del_dia}
      <div class="mt-2 text-xs"><span class="text-muted-foreground">Orden del día:</span> <span class="whitespace-pre-wrap">{store.asambleaForm.orden_del_dia}</span></div>
    {/if}
  </div>

  <!-- Resoluciones (si las hay) -->
  {#if store.resoluciones.length > 0}
    <div class="rounded-lg border border-border p-3">
      <span class="text-xs font-bold text-muted-foreground">Resoluciones ({store.resoluciones.length})</span>
      <div class="mt-2 flex flex-col gap-1.5">
        {#each store.resoluciones as res, idx (idx)}
          <div class="text-xs">
            <span class="font-medium text-muted-foreground">Punto {idx + 1}:</span> {res.texto}
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Autoridades cargadas -->
  <div class="rounded-lg border border-border p-3">
    <span class="text-xs font-bold text-muted-foreground">Autoridades cargadas ({computed.autoridadesAsamblea.length})</span>
    {#if computed.autoridadesAsamblea.length === 0}
      <div class="mt-2 text-xs text-muted-foreground">No hay autoridades vinculadas a esta asamblea.</div>
    {:else}
      <div class="mt-2 flex flex-col gap-3">
        {#each computed.autoridadesPorOrganismo as [org, items] (org)}
          <div class="flex flex-col gap-1">
            <span class="text-xs font-bold text-muted-foreground">{ORGANISMO_LABELS[org] || org}</span>
            {#each items as au (au.id)}
              <div class="flex items-center gap-2 text-xs">
                <CheckIcon class="size-3 shrink-0 text-primary" />
                <span class="font-medium">{au.apellido_nombre || '—'}</span>
                <span class="text-muted-foreground">· {computed.cargoNombreMap[String(au.cargo_id)] || `Cargo #${au.cargo_id}`}</span>
                {#if au.fecha_asuncion}
                  <span class="text-muted-foreground">· desde {dateToInput(au.fecha_asuncion)}</span>
                {/if}
              </div>
            {/each}
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Validación para verificar -->
  {#if !computed.puedeVerificar}
    <div class="flex items-center gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
      <AlertTriangleIcon class="size-4 shrink-0" />
      {#if !String(store.asambleaForm?.acta_numero || '').trim()}
        Falta cargar el número de acta para poder verificar.
      {:else}
        Faltan autoridades cargadas para poder verificar.
      {/if}
    </div>
  {/if}
</div>

<div class="flex flex-wrap items-center justify-between gap-2">
  {#if computed.isVerificada}
    <Button variant="outline" onclick={onBackToData}>
      <ArrowLeftIcon data-icon="inline-start" />
      Atrás
    </Button>
    <Button variant="outline" onclick={onClose}>Cerrar</Button>
  {:else}
    <Button variant="outline" onclick={onBackToAutoridades}>
      <ArrowLeftIcon data-icon="inline-start" />
      Atrás
    </Button>
    <div class="flex gap-2">
      <Button variant="outline" onclick={onGuardarSinVerificar} disabled={store.busy}>
        Guardar sin verificar
      </Button>
      <Button onclick={onGuardarYVerificar} disabled={store.busy || !computed.puedeVerificar}>
        <CheckIcon data-icon="inline-start" />
        Guardar y verificar
      </Button>
    </div>
  {/if}
</div>
