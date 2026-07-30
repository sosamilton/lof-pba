<script>
  import { onMount } from 'svelte'
  import { movimientosStore as store } from './movimientosStore.svelte'
  import { normalize, monthKey, formatARS } from '$core/utils'
  import { notify } from '$core/notify.svelte'
  import { Button } from '$lib/components/ui/button'
  import * as Card from '$lib/components/ui/card'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import { Textarea } from '$lib/components/ui/textarea'
  import * as Select from '$lib/components/ui/select'
  import { Skeleton } from '$lib/components/ui/skeleton'
  import FormField from '$lib/components/FormField.svelte'
  import EmptyState from '$lib/components/EmptyState.svelte'
  import Combobox from '$lib/components/Combobox.svelte'
  import PageScaffold from '$lib/components/PageScaffold.svelte'
  import SearchIcon from '@lucide/svelte/icons/search'
  import PlusIcon from '@lucide/svelte/icons/plus'
  import RefreshIcon from '@lucide/svelte/icons/refresh-cw'
  import ArrowLeftRightIcon from '@lucide/svelte/icons/arrow-left-right'

  let q = $state('')
  let tipo = $state('')

  let filtered = $derived(
    store.records
      .filter((m) => (tipo ? String(m.tipo_movimiento || '') === tipo : true))
      .filter((m) => {
        const t = normalize(q)
        if (!t) return true
        return normalize(m.detalle).includes(t)
      })
      .sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')))
  )

  let showList = $derived(store.listOpen && filtered.length > 0)

  let rubroById = $derived(new Map(store.rubros.map((r) => [Number(r.id), r])))
  let subrubrosByRubro = $derived.by(() => {
    const map = new Map()
    for (const s of store.subrubros) {
      const k = Number(s.rubro_id)
      if (!map.has(k)) map.set(k, [])
      map.get(k).push(s)
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => normalize(a.nombre_subrubro).localeCompare(normalize(b.nombre_subrubro)))
    }
    return map
  })
  let cuentaById = $derived(new Map(store.cuentas.map((c) => [Number(c.id), c])))

  const handleSave = async () => {
    await store.saveMovimiento()
    if (store.error) notify.error(store.error)
    else if (store.notice) notify.success(store.notice)
  }

  onMount(() => {
    const unsub = store.subscribe()
    store.loadAll()
    return unsub
  })
</script>

<PageScaffold title="Movimientos" loading={store.loading} error={store.error} notice={store.notice}>
  {#snippet skeleton()}
    <div class="flex flex-col gap-4">
      <div class="flex gap-3">
        <Skeleton class="h-9 flex-1" />
        <Skeleton class="h-9 w-32" />
      </div>
      <div class="grid gap-4" style="grid-template-columns: 320px 1fr">
        <Skeleton class="h-96" />
        <Skeleton class="h-96" />
      </div>
    </div>
  {/snippet}
  <div class="mb-4 flex flex-wrap items-center gap-3">
    <div class="relative flex-1 min-w-[200px]">
      <SearchIcon class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input placeholder="Buscar en detalle" bind:value={q} class="pl-9" />
    </div>
    <Select.Root type="single" bind:value={tipo} allowDeselect={true}>
      <Select.Trigger class="w-[120px]">
        <Select.Value placeholder="Todos" />
      </Select.Trigger>
      <Select.Content>
        <Select.Item value="Entrada">Entrada</Select.Item>
        <Select.Item value="Salida">Salida</Select.Item>
        <Select.Item value="Traspaso">Traspaso</Select.Item>
      </Select.Content>
    </Select.Root>
    <Button onclick={store.nuevo}>
      <PlusIcon data-icon="inline-start" />
      Nuevo movimiento
    </Button>
    <Button variant="outline" onclick={store.loadAll}>
      <RefreshIcon data-icon="inline-start" />
      Recargar
    </Button>
    <span class="text-sm text-muted-foreground">{filtered.length} movimientos</span>
  </div>

  {#if !store.ejercicio}
    <EmptyState
      title="No hay ejercicio en curso"
      sub="Activá un ejercicio en Cooperadora para registrar movimientos."
    />
  {:else}
    <div class="grid gap-4" style="grid-template-columns: {showList ? 'minmax(280px, 380px) 1fr' : '1fr'}">
      {#if showList}
        <div class="max-h-[calc(100vh-200px)] overflow-y-auto rounded-lg border border-border bg-card">
          {#if filtered.length === 0}
            <div class="p-6 text-center text-sm text-muted-foreground">No hay movimientos</div>
          {:else}
            {#each filtered as m (m.id)}
              <button
                class="w-full border-b border-border px-4 py-3 text-left transition-colors hover:bg-accent {m.id === store.selectedId ? 'bg-primary/10' : ''}"
                onclick={() => store.select(m)}
              >
                <div class="text-sm font-medium">{m.fecha} · {m.tipo_movimiento} · {formatARS(m.importe)}</div>
                <div class="text-xs text-muted-foreground">
                  {#if m.tipo_movimiento === 'Traspaso'}
                    {cuentaById.get(Number(m.cuenta_id))?.nombre_cuenta || ''} → {cuentaById.get(Number(m.cuenta_destino_id))?.nombre_cuenta || ''}
                  {:else}
                    {rubroById.get(Number(m.rubro_id))?.codigo_rubro || ''} · {m.detalle || ''}
                  {/if}
                </div>
              </button>
            {/each}
          {/if}
        </div>
      {/if}

      <div>
        {#if store.form}
          <Card.Root>
            <Card.Header>
              <div class="flex items-center justify-between gap-2">
                <Card.Title class="text-base">
                  {store.form.id ? 'Editar movimiento' : 'Nuevo movimiento'}
                </Card.Title>
                <div class="flex gap-2">
                  {#if showList}
                    <Button variant="outline" size="sm" onclick={() => store.setListOpen(false)}>Ocultar lista</Button>
                  {/if}
                  <Button onclick={handleSave}>Guardar</Button>
                </div>
              </div>
            </Card.Header>
            <Card.Content class="flex flex-col gap-4">
              <div class="grid gap-4 sm:grid-cols-2">
                <FormField label="Fecha" id="fecha" type="date" bind:value={store.form.fecha} />
                <div>
                  <Label for="tipo-mov">Tipo</Label>
                  <Select.Root type="single" bind:value={store.form.tipo_movimiento}>
                    <Select.Trigger id="tipo-mov" class="mt-1 w-full">
                      <Select.Value placeholder="Elegir…" />
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Item value="Entrada">Entrada</Select.Item>
                      <Select.Item value="Salida">Salida</Select.Item>
                      <Select.Item value="Traspaso">Traspaso</Select.Item>
                    </Select.Content>
                  </Select.Root>
                </div>
                <div class="sm:col-span-2">
                  <FormField label="Detalle" id="detalle" type="textarea" bind:value={store.form.detalle} placeholder="Descripción corta (p.ej. Compra kiosco, Pago proveedor, Aporte socio)" />
                </div>
                <FormField label="Importe" id="importe" type="number" bind:value={store.form.importe} />
                <div>
                  <Label for="cuenta">Caja/cuenta</Label>
                  <Combobox
                    bind:value={store.form.cuenta_id}
                    items={store.cuentas.map((c) => ({ value: c.id, label: c.nombre_cuenta }))}
                    placeholder="Elegir…"
                    searchPlaceholder="Buscar cuenta…"
                    class="mt-1"
                  />
                </div>

                {#if store.form.tipo_movimiento === 'Traspaso'}
                  <div class="sm:col-span-2">
                    <Label for="cuenta-destino">Cuenta destino</Label>
                    <Combobox
                      bind:value={store.form.cuenta_destino_id}
                      items={store.cuentas.map((c) => ({ value: c.id, label: c.nombre_cuenta }))}
                      placeholder="Elegir…"
                      searchPlaceholder="Buscar cuenta…"
                      class="mt-1"
                    />
                  </div>
                {:else}
                  <div>
                    <Label for="rubro">Rubro</Label>
                    <Combobox
                      bind:value={store.form.rubro_id}
                      items={store.rubros.map((r) => ({ value: r.id, label: `${r.codigo_rubro} · ${r.nombre_oficial}` }))}
                      placeholder="Elegir…"
                      searchPlaceholder="Buscar rubro…"
                      class="mt-1"
                      onchange={store.onRubroChange}
                    />
                  </div>
                  <div>
                    <Label for="subrubro">Subrubro</Label>
                    <Select.Root type="single" bind:value={store.form.subrubro_id} disabled={!store.form.rubro_id} allowDeselect={true}>
                      <Select.Trigger id="subrubro" class="mt-1 w-full">
                        <Select.Value placeholder="(Opcional)" />
                      </Select.Trigger>
                      <Select.Content>
                        {#each (subrubrosByRubro.get(Number(store.form.rubro_id)) || []) as s (s.id)}
                          <Select.Item value={String(s.id)}>{s.nombre_subrubro}</Select.Item>
                        {/each}
                      </Select.Content>
                    </Select.Root>
                  </div>
                {/if}

                {#if String(cuentaById.get(Number(store.form.cuenta_id))?.nombre_cuenta || '') === 'Banco'}
                  <div class="sm:col-span-2">
                    <Label for="destino-banco">Destino en banco</Label>
                    <Select.Root type="single" bind:value={store.form.destino_bancario} allowDeselect={true}>
                      <Select.Trigger id="destino-banco" class="mt-1 w-full">
                        <Select.Value placeholder="(Opcional)" />
                      </Select.Trigger>
                      <Select.Content>
                        <Select.Item value="CuentaCorriente">Cuenta corriente</Select.Item>
                        <Select.Item value="PlazoFijo">Plazo fijo</Select.Item>
                      </Select.Content>
                    </Select.Root>
                  </div>
                {/if}

                <div class="sm:col-span-2">
                  <Label for="socio">Socio (opcional)</Label>
                  <Combobox
                    bind:value={store.form.socio_id}
                    items={store.socios.map((s) => ({ value: s.id, label: `${s.apellido}, ${s.nombre} · DNI ${s.dni || '-'}` }))}
                    placeholder="(Ninguno)"
                    searchPlaceholder="Buscar socio…"
                    class="mt-1"
                  />
                </div>
              </div>

              <p class="text-xs text-muted-foreground">
                Se registra en el período <span class="font-mono">{monthKey(store.form.fecha)}</span> del ejercicio en curso.
              </p>
            </Card.Content>
          </Card.Root>
        {:else if filtered.length === 0}
          <EmptyState
            title="Listo para cargar movimientos"
            sub="Creá el primer movimiento para empezar."
            actionLabel="Nuevo movimiento"
            onaction={store.nuevo}
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

</PageScaffold>
