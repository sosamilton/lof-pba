<script>
  import * as Dialog from '$lib/components/ui/dialog'
  import { Button } from '$lib/components/ui/button'
  import { Badge } from '$lib/components/ui/badge'
  import * as Select from '$lib/components/ui/select'
  import * as Table from '$lib/components/ui/table'
  import * as Tabs from '$lib/components/ui/tabs'
  import EmptyState from '$lib/components/EmptyState.svelte'
  import ControlledDialog from '$lib/components/ControlledDialog.svelte'
  import { ORGANISMOS, ORGANISMO_LABELS } from '$app/modules/gobierno/constants.js'
  import { formatFecha } from '$core/format/format'
  import { dateToInput } from '$core/utils/utils'
  import HistoryIcon from '@lucide/svelte/icons/history'
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right'
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down'

  let { open = $bindable(false), store } = $props()

  // Estado local
  let ejercicioSeleccionado = $state(null)
  let organismoSeleccionado = $state('CD')
  let cargosExpandidos = $state(new Set())
  let cargado = $state(false)
  /** @type {any[]} */
  let autoridadesLocales = $state([])

  // Cargar datos al abrir
  $effect(() => {
    if (open && !cargado) {
      cargado = true
      store.loadTodosLosCargos()
      // Cargar autoridades y guardar localmente para asegurar reactividad
      store.loadAutoridades().then((data) => { autoridadesLocales = data || [] })
    }
    if (!open) {
      cargado = false
      cargosExpandidos = new Set()
      autoridadesLocales = []
    }
  })

  // Ejercicios ordenados descendente (más reciente primero)
  let ejerciciosOpciones = $derived(
    [...(store.ejercicios || [])]
      .sort((a, b) => Number(b.anio_inicio || 0) - Number(a.anio_inicio || 0))
      .map((e) => ({ value: String(e.id), label: `${e.anio_inicio}-${e.anio_fin}` })),
  )

  // Default: ejercicio en curso, o el primero disponible
  $effect(() => {
    if (!open || ejercicioSeleccionado !== null) return
    const enCurso = store.ejercicioEnCurso
    if (enCurso) {
      ejercicioSeleccionado = String(enCurso.id)
      return
    }
    // Fallback: primer ejercicio de la lista
    const opts = ejerciciosOpciones
    if (opts.length > 0) {
      ejercicioSeleccionado = opts[0].value
    }
  })

  // Cargos del organismo seleccionado (de todosLosCargos)
  let cargosOrganismo = $derived(
    (store.todosLosCargos || [])
      .filter((c) => String(c.organismo) === organismoSeleccionado)
      .sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0)),
  )

  // Mapa de cargo por id (de todos los cargos, no solo del organismo)
  let cargoById = $derived(
    new Map((store.todosLosCargos || []).map((c) => [Number(c.id), c])),
  )

  // Autoridades del ejercicio seleccionado y organismo seleccionado.
  // Si no hay ejercicio seleccionado, muestra todas las del organismo.
  let autoridadesEjercicio = $derived.by(() => {
    const ejId = ejercicioSeleccionado ? Number(ejercicioSeleccionado) : null
    const todas = autoridadesLocales
    return todas
      .filter((a) => String(a.organismo) === organismoSeleccionado)
      .filter((a) => ejId == null || Number(a.ejercicio_id) === ejId)
      .sort((a, b) => {
        const cA = cargoById.get(Number(a.cargo_id))
        const cB = cargoById.get(Number(b.cargo_id))
        const o = Number(cA?.orden || 0) - Number(cB?.orden || 0)
        if (o !== 0) return o
        return String(b.fecha_asuncion || '').localeCompare(String(a.fecha_asuncion || ''))
      })
  })

  // Todas las autoridades de un cargo específico (todos los ejercicios) para la cadena
  const cadenaPorCargo = (cargoId) => {
    return autoridadesLocales
      .filter((a) => Number(a.cargo_id) === Number(cargoId))
      .filter((a) => String(a.organismo) === organismoSeleccionado)
      .sort((a, b) => {
        // Ordenar por ejercicio descendente, luego por fecha_asuncion
        const ejComp = Number(b.ejercicio_id || 0) - Number(a.ejercicio_id || 0)
        if (ejComp !== 0) return ejComp
        return String(b.fecha_asuncion || '').localeCompare(String(a.fecha_asuncion || ''))
      })
  }

  // Ejercicio label por id
  const ejLabel = (id) => {
    const e = (store.ejercicios || []).find((x) => Number(x.id) === Number(id))
    return e ? `${e.anio_inicio}-${e.anio_fin}` : '?'
  }

  const toggleCargo = (cargoId) => {
    const sel = new Set(cargosExpandidos)
    if (sel.has(cargoId)) sel.delete(cargoId)
    else sel.add(cargoId)
    cargosExpandidos = sel
  }
</script>

<ControlledDialog bind:open class="sm:max-w-3xl">
  <Dialog.Header>
    <Dialog.Title class="flex items-center gap-2">
      <HistoryIcon class="size-5" />
      Histórico de autoridades
    </Dialog.Title>
    <Dialog.Description class="text-xs">
      Quién ocupó cada cargo en cada ejercicio. Expandí un cargo para ver la cadena completa de reemplazos.
    </Dialog.Description>
  </Dialog.Header>

  <!-- Controles: selector de ejercicio + tabs de organismo -->
  <div class="flex flex-wrap items-center justify-between gap-3">
    {#if ejerciciosOpciones.length > 0}
      <div class="flex items-center gap-2">
        <span class="text-xs text-muted-foreground">Ejercicio:</span>
        <Select.Root
          type="single"
          value={ejercicioSeleccionado ?? ''}
          onValueChange={(v) => { ejercicioSeleccionado = v || null }}
        >
          <Select.Trigger class="h-8 w-[140px] text-xs">
            <Select.Value placeholder="Ejercicio…" />
          </Select.Trigger>
          <Select.Content>
            {#each ejerciciosOpciones as opt (opt.value)}
              <Select.Item value={opt.value} class="text-xs">{opt.label}</Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
      </div>
    {:else}
      <span class="text-xs text-muted-foreground">No hay ejercicios cargados.</span>
    {/if}

    <Tabs.Root bind:value={organismoSeleccionado}>
      <Tabs.List>
        {#each ORGANISMOS as org}
          <Tabs.Trigger value={org}>{ORGANISMO_LABELS[org]}</Tabs.Trigger>
        {/each}
      </Tabs.List>
    </Tabs.Root>
  </div>

  <!-- Tabla de autoridades del ejercicio seleccionado -->
  {#if autoridadesEjercicio.length === 0}
    <EmptyState
      title="Sin mandatos registrados"
      sub="No hay autoridades registradas para {ORGANISMO_LABELS[organismoSeleccionado]}{ejercicioSeleccionado ? ' en este ejercicio' : ''}. Cargá las autoridades desde una asamblea en Gobierno."
    >
      {#snippet icon()}
        <HistoryIcon class="size-8 text-muted-foreground" />
      {/snippet}
    </EmptyState>
  {:else}
    <div class="max-h-[50vh] overflow-auto rounded-lg border border-border">
      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.Head class="w-[28px]"></Table.Head>
            <Table.Head>Cargo</Table.Head>
            <Table.Head>Persona</Table.Head>
            <Table.Head class="w-[100px]">Asunción</Table.Head>
            <Table.Head class="w-[100px]">Cese</Table.Head>
            <Table.Head class="w-[90px]">Motivo</Table.Head>
            <Table.Head class="w-[90px]">Origen</Table.Head>
            <Table.Head class="w-[80px]">Estado</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each autoridadesEjercicio as a (a.id)}
            {@const cargo = cargoById.get(Number(a.cargo_id))}
            {@const expandido = cargosExpandidos.has(Number(a.cargo_id))}
            {@const cadena = expandido ? cadenaPorCargo(a.cargo_id) : []}
            <Table.Row>
              <Table.Cell class="p-1">
                {#if cadenaPorCargo(a.cargo_id).length > 1}
                  <button
                    type="button"
                    class="flex size-6 items-center justify-center rounded hover:bg-muted"
                    onclick={() => toggleCargo(Number(a.cargo_id))}
                  >
                    {#if expandido}
                      <ChevronDownIcon class="size-4" />
                    {:else}
                      <ChevronRightIcon class="size-4" />
                    {/if}
                  </button>
                {/if}
              </Table.Cell>
              <Table.Cell class="text-sm font-medium">
                {cargo?.nombre_cargo || '(cargo sin nombre)'}
              </Table.Cell>
              <Table.Cell class="text-sm">
                <div class="flex flex-col gap-0.5">
                  <span>{a.apellido_nombre || '(sin nombre)'}</span>
                  {#if a.reemplaza_autoridad_id}
                    <span class="text-xs text-muted-foreground">Reemplaza a mandato anterior</span>
                  {/if}
                </div>
              </Table.Cell>
              <Table.Cell class="text-xs">{formatFecha(dateToInput(a.fecha_asuncion)) || '-'}</Table.Cell>
              <Table.Cell class="text-xs">{formatFecha(dateToInput(a.fecha_cese)) || '-'}</Table.Cell>
              <Table.Cell class="text-xs">{a.motivo_cese || '-'}</Table.Cell>
              <Table.Cell>
                {#if a.tipo_origen === 'ReunionCD'}
                  <Badge variant="outline">RCD</Badge>
                {:else if a.tipo_origen === 'Asamblea'}
                  <Badge variant="secondary">Asamblea</Badge>
                {/if}
              </Table.Cell>
              <Table.Cell>
                {#if a.fecha_cese || a.activo === false}
                  <Badge variant="destructive">Cesado</Badge>
                {:else}
                  <Badge variant="default">Vigente</Badge>
                {/if}
              </Table.Cell>
            </Table.Row>

            <!-- Filas expandibles: cadena completa del cargo -->
            {#if expandido && cadena.length > 1}
              <Table.Row class="bg-muted/30">
                <Table.Cell colspan="8" class="p-3">
                  <div class="flex flex-col gap-2">
                    <span class="text-xs font-semibold text-muted-foreground">
                      Cadena completa de "{cargo?.nombre_cargo || 'cargo'}" ({cadena.length} mandatos)
                    </span>
                    <div class="flex flex-col gap-1">
                      {#each cadena as c (c.id)}
                        <div class="flex items-center gap-2 text-xs">
                          <span class="w-[80px] font-mono text-muted-foreground">{ejLabel(c.ejercicio_id)}</span>
                          <span class="flex-1 font-medium">{c.apellido_nombre || '(sin nombre)'}</span>
                          <span class="text-muted-foreground">{formatFecha(dateToInput(c.fecha_asuncion)) || '?'}</span>
                          <span class="text-muted-foreground">→</span>
                          <span class="text-muted-foreground">{formatFecha(dateToInput(c.fecha_cese)) || 'vigente'}</span>
                          {#if c.tipo_origen === 'ReunionCD'}
                            <Badge variant="outline" class="text-[10px]">RCD</Badge>
                          {:else if c.tipo_origen === 'Asamblea'}
                            <Badge variant="secondary" class="text-[10px]">Asamblea</Badge>
                          {/if}
                          {#if c.fecha_cese || c.activo === false}
                            <Badge variant="destructive" class="text-[10px]">Cesado</Badge>
                          {:else}
                            <Badge variant="default" class="text-[10px]">Vigente</Badge>
                          {/if}
                        </div>
                      {/each}
                    </div>
                  </div>
                </Table.Cell>
              </Table.Row>
            {/if}
          {/each}
        </Table.Body>
      </Table.Root>
    </div>
  {/if}

  <Dialog.Footer class="gap-2">
    <Button variant="outline" onclick={() => (open = false)}>Cerrar</Button>
  </Dialog.Footer>
</ControlledDialog>
