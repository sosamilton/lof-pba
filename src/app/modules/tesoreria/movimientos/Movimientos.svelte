<script>
  import { onMount } from 'svelte'
  import { movimientosStore as store } from './movimientosStore.svelte'
  import { normalize, buildMapById } from '$core/utils/utils'
  import { filterBySearch } from '$lib/hooks/useListFilter.svelte.js'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import * as Select from '$lib/components/ui/select'
  import EmptyState from '$lib/components/EmptyState.svelte'
  import PageScaff from '$lib/components/PageScaffold.svelte'
  import SearchInput from '$lib/components/SearchInput.svelte'
  import ListSkeleton from '$lib/components/ListSkeleton.svelte'
  import { keyboard } from '$core/ui/keyboard.svelte'
  import PlusIcon from '@lucide/svelte/icons/plus'
  import ArrowLeftRightIcon from '@lucide/svelte/icons/arrow-left-right'
  import AlertTriangleIcon from '@lucide/svelte/icons/triangle-alert'
  import * as Alert from '$lib/components/ui/alert'
  import MovimientosList from './components/MovimientosList.svelte'
  import MovimientoForm from './components/MovimientoForm.svelte'

  let q = $state('')
  let tipo = $state('')

  let filtered = $derived(
    filterBySearch(
      store.records.filter((/** @type {any} */ m) => (tipo ? String(m.tipo_movimiento || '') === tipo : true)),
      q,
      (/** @type {any} */ m) => [m.detalle],
    ).sort((/** @type {any} */ a, /** @type {any} */ b) => String(b.fecha || '').localeCompare(String(a.fecha || ''))),
  )

  let rubroById = $derived(buildMapById(store.rubros))
  let filteredRubros = $derived(
    store.form?.tipo_movimiento === 'Entrada' || store.form?.tipo_movimiento === 'Salida'
      ? store.rubros.filter((/** @type {any} */ r) => String(r.tipo_rubro || '') === store.form.tipo_movimiento)
      : store.rubros
  )
  let subrubrosByRubro = $derived.by(() => {
    const map = new Map()
    for (const s of store.subrubros) {
      const k = Number(s.rubro_id)
      if (!map.has(k)) map.set(k, [])
      map.get(k).push(s)
    }
    for (const arr of map.values()) {
      arr.sort((/** @type {any} */ a, /** @type {any} */ b) => normalize(a.nombre_subrubro).localeCompare(normalize(b.nombre_subrubro)))
    }
    return map
  })
  let cuentaById = $derived(buildMapById(store.cuentas))

  onMount(async () => {
    const unsub = store.subscribe()
    await store.loadAll()
    const pending = keyboard.consumePendingAction()
    if (pending) pending.action()
    return unsub
  })
</script>

<PageScaff title="Movimientos" loading={store.loading} error={store.error} notice={store.notice}>
  {#if store.advertenciaCierreManual}
    <Alert.Root variant="default" class="mb-4 border-yellow-500/45 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400">
      <AlertTriangleIcon data-icon="inline-start" />
      <Alert.Title>Atención</Alert.Title>
      <Alert.Description>{store.advertenciaCierreManual}</Alert.Description>
    </Alert.Root>
  {/if}
  {#snippet skeleton()}
    <ListSkeleton filters={1} />
  {/snippet}
  <div class="mb-4 flex flex-wrap items-center gap-3">
    <SearchInput bind:value={q} placeholder="Buscar en detalle" ariaLabel="Buscar movimientos" />
    <Select.Root type="single" bind:value={tipo} allowDeselect={true}>
      <Select.Trigger class="w-[120px]" aria-label="Filtrar por tipo de movimiento">
        <Select.Value placeholder="Todos" />
      </Select.Trigger>
      <Select.Content>
        <Select.Item value="Entrada">Entrada</Select.Item>
        <Select.Item value="Salida">Salida</Select.Item>
        <Select.Item value="Traspaso">Traspaso</Select.Item>
      </Select.Content>
    </Select.Root>
    {#if store.modoGestion !== 'carga_consolidada'}
      <Button data-shortcut="new" onclick={() => store.nuevo()}>
        <PlusIcon data-icon="inline-start" />
        Nuevo movimiento
      </Button>
      <button data-shortcut="cuota" onclick={store.nuevoCuotaSocietaria} class="hidden" aria-hidden="true" tabindex="-1"></button>
    {/if}
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
            title={store.modoGestion === 'carga_consolidada' ? "Sin movimientos en este período" : "Listo para cargar movimientos"}
            sub={store.modoGestion === 'carga_consolidada' ? "Los movimientos se cargan desde Resumen → Cargar PIA por rubro." : "Creá el primer movimiento para empezar."}
            actionLabel={store.modoGestion === 'carga_consolidada' ? null : "Nuevo movimiento"}
            onaction={store.modoGestion === 'carga_consolidada' ? null : () => store.nuevo()}
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

</PageScaff>
