<script>
  import { onMount } from 'svelte'
  import { movimientosStore as store } from './movimientosStore.svelte'
  import { normalize, buildMapById } from '$core/utils/utils'
  import { filterBySearch } from '$lib/hooks/useListFilter.svelte.js'
  import { useDebounce } from '$lib/hooks/useDebounce.svelte.js'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import * as Select from '$lib/components/ui/select'
  import EmptyState from '$lib/components/EmptyState.svelte'
  import PageScaff from '$lib/components/PageScaffold.svelte'
  import SearchInput from '$lib/components/SearchInput.svelte'
  import ListSkeleton from '$lib/components/ListSkeleton.svelte'
  import Combobox from '$lib/components/Combobox.svelte'
  import EjercicioSelector from '$lib/components/EjercicioSelector.svelte'
  import { keyboard } from '$core/ui/keyboard.svelte'
  import { navigate } from '$core/ui/router.svelte'
  import { personaLabel } from '$app/modules/comunidad/personas/personasApi.js'
  import PlusIcon from '@lucide/svelte/icons/plus'
  import ArrowLeftRightIcon from '@lucide/svelte/icons/arrow-left-right'
  import AlertTriangleIcon from '@lucide/svelte/icons/triangle-alert'
  import XIcon from '@lucide/svelte/icons/x'
  import * as Alert from '$lib/components/ui/alert'
  import MovimientosList from './components/MovimientosList.svelte'
  import MovimientoForm from './components/MovimientoForm.svelte'
  import ConfigRapidaCard from './components/ConfigRapidaCard.svelte'
  import CargaPIAMatrix from '../cargaPia/CargaPIAMatrix.svelte'

  let q = $state('')
  const qd = useDebounce(() => q)
  let tipo = $state('')
  let rubroFiltro = $state('')         // filtro por rubro_id (categoría PIA)
  let ejercicioFiltro = $state('')     // filtro por ejercicio_id
  let periodoFiltro = $state('')       // filtro por período (YYYY-MM)
  let personaFiltro = $state('')       // filtro por persona_id (solo integral)

  let rubroById = $derived(buildMapById(store.rubros))
  let cuentaById = $derived(buildMapById(store.cuentas))
  let personaById = $derived(buildMapById(store.personas))

  // Rubros para el filtro, filtrados por tipo si hay uno seleccionado
  let rubrosFiltroOptions = $derived.by(() => {
    const rubros = tipo
      ? store.rubros.filter((r) => String(r.tipo_rubro || '') === tipo)
      : store.rubros
    return rubros
      .slice()
      .sort((a, b) => normalize(a.nombre_oficial).localeCompare(normalize(b.nombre_oficial)))
      .map((r) => ({ value: String(r.id), label: r.nombre_oficial || '(sin nombre)' }))
  })

  // Ejercicios ordenados por año descendente
  let ejerciciosOptions = $derived(
    store.ejercicios
      .slice()
      .sort((a, b) => Number(b.anio_inicio || 0) - Number(a.anio_inicio || 0))
      .map((e) => ({
        value: String(e.id),
        label: `${e.anio_inicio || '?'}-${e.anio_fin || '?'}`,
      }))
  )

  // Períodos únicos (YYYY-MM) del ejercicio seleccionado
  let periodosOptions = $derived.by(() => {
    if (!ejercicioFiltro) return []
    const base = store.records
      .filter((m) => String(m.ejercicio_id) === ejercicioFiltro)
      .map((m) => m.periodo)
      .filter(Boolean)
    return [...new Set(base)].sort().reverse().map((p) => ({ value: p, label: p }))
  })

  // Items de personas para el Combobox (solo modo integral)
  let personaItems = $derived(
    store.personas.map((p) => ({
      value: String(p.id),
      label: personaLabel(p),
      sub: p.dni ? `DNI ${p.dni}` : '',
    }))
  )

  let filtered = $derived(
    filterBySearch(
      store.records
        .filter((/** @type {any} */ m) => (tipo ? String(m.tipo_movimiento || '') === tipo : true))
        .filter((/** @type {any} */ m) => (rubroFiltro ? String(m.rubro_id || '') === rubroFiltro : true))
        .filter((/** @type {any} */ m) => (ejercicioFiltro ? String(m.ejercicio_id) === ejercicioFiltro : true))
        .filter((/** @type {any} */ m) => (periodoFiltro ? String(m.periodo || '') === periodoFiltro : true))
        .filter((/** @type {any} */ m) => {
          if (!personaFiltro) return true
          return String(m.persona_id) === personaFiltro || String(m.socio_id) === personaFiltro
        }),
      qd.value,
      (/** @type {any} */ m) => [m.detalle],
    ).sort((/** @type {any} */ a, /** @type {any} */ b) => String(b.fecha || '').localeCompare(String(a.fecha || ''))),
  )

  let filteredRubros = $derived(
    store.form?.tipo_movimiento === 'Entrada' || store.form?.tipo_movimiento === 'Salida'
      ? store.rubros.filter((/** @type {any} */ r) => String(r.tipo_rubro || '') === store.form.tipo_movimiento)
      : store.rubros
  )
  let subrubrosByRubro = $derived.by(() => {
    const map = new Map()
    // Subrubro actualmente seleccionado en el form (para no ocultarlo si está inactivo)
    const selectedSubrubroId = store.form?.subrubro_id ? Number(store.form.subrubro_id) : null
    for (const s of store.subrubros) {
      // Filtrar inactivos, salvo el que está seleccionado en el form actual
      if (s.activo === false && Number(s.id) !== selectedSubrubroId) continue
      const k = Number(s.rubro_id)
      if (!map.has(k)) map.set(k, [])
      map.get(k).push(s)
    }
    for (const arr of map.values()) {
      arr.sort((/** @type {any} */ a, /** @type {any} */ b) => normalize(a.nombre_subrubro).localeCompare(normalize(b.nombre_subrubro)))
    }
    return map
  })

  const esIntegral = $derived(store.modoGestion === 'gestion_integral')

  // Cuando cambia el tipo, limpiar el filtro de rubro si no aplica
  $effect(() => {
    if (tipo && rubroFiltro) {
      const rubro = rubroById.get(Number(rubroFiltro))
      if (rubro && String(rubro.tipo_rubro || '') !== tipo) {
        rubroFiltro = ''
      }
    }
  })

  // Cuando cambia el ejercicio, limpiar el filtro de período si no pertenece
  $effect(() => {
    if (periodoFiltro && ejercicioFiltro) {
      const exists = periodosOptions.some((p) => p.value === periodoFiltro)
      if (!exists) periodoFiltro = ''
    }
  })

  onMount(async () => {
    const unsub = store.subscribe()
    await store.loadAll()
    // Ejercicio por defecto: el en curso
    if (store.ejercicio?.id) {
      ejercicioFiltro = String(store.ejercicio.id)
    }
    const pending = keyboard.consumePendingAction()
    if (pending) pending.action()
    return unsub
  })
</script>

<PageScaff title="Movimientos" loading={store.loading} error={store.error} notice={store.notice}>
  {#if store.ejercicios.length > 1}
    <div class="mb-4 flex items-center justify-end gap-2">
      <span class="text-xs text-muted-foreground">Viendo:</span>
      <EjercicioSelector
        ejercicios={store.ejercicios}
        value={ejercicioFiltro}
        onValueChange={(v) => { ejercicioFiltro = v || '' }}
        placeholder="Ejercicio"
        class="h-8 w-[160px] text-xs"
        showMesInicio={true}
      />
    </div>
  {/if}
  {#if store.advertenciaCierreManual}
    <Alert.Root variant="default" class="mb-4 border-yellow-500/45 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400">
      <AlertTriangleIcon data-icon="inline-start" />
      <Alert.Title>Atención</Alert.Title>
      <Alert.Description>{store.advertenciaCierreManual}</Alert.Description>
    </Alert.Root>
  {/if}
  {#if store.ejercicio && store.ejercicio.cerrado !== true}
    <Alert.Root class="mb-4">
      <AlertTriangleIcon data-icon="inline-start" />
      <Alert.Title>Ejercicio sin cerrar</Alert.Title>
      <Alert.Description>
        Este ejercicio aún no está cerrado. Para cerrarlo y generar las planillas
        (PIA y Nómina) para presentación, andá a
        <button class="underline font-semibold text-primary" onclick={() => navigate('cierre')}>
          Cierre / Presentación
        </button>
        o usá el botón "Cerrar ejercicio" en Resumen.
      </Alert.Description>
    </Alert.Root>
  {/if}
  {#snippet skeleton()}
    <ListSkeleton filters={1} />
  {/snippet}
  {#if store.modoGestion === 'carga_consolidada'}
    <!-- Modo carga consolidada: CargaPIAMatrix maneja su propio header + layout -->
    <CargaPIAMatrix embedded={true} />
  {:else}
    <!-- Modo gestión integral: listado + formulario individual -->
    <ConfigRapidaCard
      rubros={store.rubros}
      cuentas={store.cuentas}
      defaultsMovimiento={store.defaultsMovimiento}
      sessionOverride={store.sessionOverride}
      onSessionOverride={(v) => store.setSessionOverride(v)}
      onResetOverride={() => store.resetSessionOverride()}
    />
    <div class="mb-4 flex flex-wrap items-center gap-3">
      <SearchInput bind:value={q} placeholder="Buscar en detalle" ariaLabel="Buscar movimientos" />
      <Select.Root type="single" bind:value={tipo} allowDeselect={true}>
        <Select.Trigger class="w-[120px]" aria-label="Filtrar por tipo de movimiento">
          <Select.Value placeholder="Tipo" />
        </Select.Trigger>
        <Select.Content>
          <Select.Item value="Entrada">Entrada</Select.Item>
          <Select.Item value="Salida">Salida</Select.Item>
          <Select.Item value="Traspaso">Traspaso</Select.Item>
        </Select.Content>
      </Select.Root>
      <Select.Root type="single" bind:value={rubroFiltro} allowDeselect={true}>
        <Select.Trigger class="w-[180px]" aria-label="Filtrar por rubro">
          <Select.Value placeholder="Rubro" />
        </Select.Trigger>
        <Select.Content>
          {#each rubrosFiltroOptions as opt}
            <Select.Item value={opt.value}>{opt.label}</Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>
      <Select.Root type="single" bind:value={periodoFiltro} allowDeselect={true}>
        <Select.Trigger class="w-[120px]" aria-label="Filtrar por período" disabled={!ejercicioFiltro}>
          <Select.Value placeholder={ejercicioFiltro ? 'Período' : 'Elegí ejercicio'} />
        </Select.Trigger>
        <Select.Content>
          {#each periodosOptions as opt}
            <Select.Item value={opt.value}>{opt.label}</Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>
      {#if esIntegral}
        <div class="flex items-center gap-1">
          <div class="w-[200px]">
            <Combobox
              bind:value={personaFiltro}
              items={personaItems}
              placeholder="Persona"
              searchPlaceholder="Buscar persona…"
            />
          </div>
          {#if personaFiltro}
            <Button variant="ghost" size="sm" onclick={() => (personaFiltro = '')} aria-label="Quitar filtro de persona">
              <XIcon class="size-4" />
            </Button>
          {/if}
        </div>
      {/if}
      <Button data-shortcut="new" onclick={() => store.nuevo()}>
        <PlusIcon data-icon="inline-start" />
        Nuevo movimiento
      </Button>
      <button data-shortcut="cuota" onclick={store.nuevoCuotaSocietaria} class="hidden" aria-hidden="true" tabindex="-1"></button>
      <span class="text-sm text-muted-foreground">{filtered.length} movimientos</span>
    </div>

    {#if !store.ejercicio}
      <EmptyState
        title="No hay ejercicio en curso"
        sub="Activá un ejercicio en Inicio → Información institucional para registrar movimientos."
      />
    {:else}
      <div class="grid gap-4" style="grid-template-columns: {filtered.length > 0 ? 'minmax(280px, 380px) 1fr' : '1fr'}">
        <MovimientosList
          items={filtered}
          selectedId={store.selectedId}
          onSelect={(m) => store.select(m)}
          {rubroById}
          {cuentaById}
        />

        <div>
          {#if store.form}
            <MovimientoForm {store} {filteredRubros} {subrubrosByRubro} {cuentaById} />
          {:else if filtered.length === 0}
            <EmptyState
              title="Listo para cargar movimientos"
              sub="Creá el primer movimiento para empezar."
              actionLabel="Nuevo movimiento"
              onaction={() => store.nuevo()}
            >
              {#snippet actionIcon()}
                <PlusIcon data-icon="inline-start" />
              {/snippet}
            </EmptyState>
          {:else}
            <div class="flex flex-col items-center gap-2 py-12 text-center">
              <ArrowLeftRightIcon class="size-8 text-muted-foreground" />
              <p class="text-sm text-muted-foreground">Seleccioná un movimiento o creá uno nuevo.</p>
            </div>
          {/if}
        </div>
      </div>
    {/if}
  {/if}

</PageScaff>
