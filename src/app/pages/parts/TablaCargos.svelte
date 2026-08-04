<script>
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import { Button } from '$lib/components/ui/button'
  import { Checkbox } from '$lib/components/ui/checkbox'
  import { Switch } from '$lib/components/ui/switch'
  import * as Select from '$lib/components/ui/select'
  import * as Table from '$lib/components/ui/table'
  import * as Tabs from '$lib/components/ui/tabs'
  import { Separator } from '$lib/components/ui/separator'
  import { ORGANISMOS, ORGANISMO_LABELS, NIVELES_CARGO } from '$core/utils'
  import { formatFecha } from '$core/format'
  import { navigate } from '$core/router.svelte'
  import AlertTriangleIcon from '@lucide/svelte/icons/triangle-alert'
  import ArrowRightIcon from '@lucide/svelte/icons/arrow-right'

  let {
    store,
    escuelaValidada = false,
    tieneAutoridadesVigentes = true,
  } = $props()
</script>

<div class="flex flex-col gap-4">
  <Tabs.Root value={store.organismo} onValueChange={store.setOrganismo}>
    <Tabs.List>
      {#each ORGANISMOS as org}<Tabs.Trigger value={org}>{ORGANISMO_LABELS[org]}</Tabs.Trigger>{/each}
    </Tabs.List>
  </Tabs.Root>

  {#if store.comisionDirectiva.length > 0}
    <div class="overflow-x-auto rounded-lg border border-border">
      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.Head>Cargo</Table.Head>
            <Table.Head>Titular</Table.Head>
            <Table.Head>CUIL</Table.Head>
            <Table.Head class="w-[90px]">Asunción</Table.Head>
            <Table.Head class="w-[90px]">Vence</Table.Head>
            {#if !escuelaValidada}
              <Table.Head class="w-[64px]">Orden</Table.Head>
              <Table.Head class="w-[80px]">Duración</Table.Head>
              <Table.Head class="w-[70px]">Oblig.</Table.Head>
              <Table.Head class="w-[90px]"></Table.Head>
            {/if}
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each store.comisionDirectiva as fila (fila.cargoId)}
            <Table.Row>
              <Table.Cell class="text-sm font-medium">
                {#if !escuelaValidada}
                  <Input bind:value={fila.cargo.nombre_cargo} class="h-8 text-sm" />
                {:else}
                  {fila.cargoNombre}
                {/if}
              </Table.Cell>
              <Table.Cell class="text-sm">{fila.apellido_nombre || '—'}</Table.Cell>
              <Table.Cell class="text-sm">{fila.cuil || '—'}</Table.Cell>
              <Table.Cell class="text-sm">{formatFecha(fila.fecha_asuncion) || '—'}</Table.Cell>
              <Table.Cell class="text-sm">{formatFecha(fila.fecha_vencimiento) || '—'}</Table.Cell>
              {#if !escuelaValidada}
                <Table.Cell>
                  <Input type="number" bind:value={fila.cargo.orden} class="h-8 text-sm" />
                </Table.Cell>
                <Table.Cell>
                  <Input type="number" bind:value={fila.cargo.duracion_meses} class="h-8 text-sm" />
                </Table.Cell>
                <Table.Cell>
                  <Checkbox bind:checked={fila.cargo.cargo_obligatorio} />
                </Table.Cell>
                <Table.Cell>
                  <Button variant="outline" size="sm" onclick={() => store.saveCargo(fila.cargo)}>Guardar</Button>
                </Table.Cell>
              {/if}
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
    </div>
  {:else}
    <p class="text-sm text-muted-foreground">No hay cargos cargados para este organismo.</p>
  {/if}

  {#if !escuelaValidada}
    <Separator />
    <div class="text-sm font-semibold">Agregar cargo</div>
    <div class="grid gap-3 sm:grid-cols-3">
      <div><Label for="nc-nombre">Nombre</Label><Input id="nc-nombre" bind:value={store.nuevoCargo.nombre_cargo} class="mt-1" /></div>
      <div><Label for="nc-duracion">Duración (meses)</Label><Input id="nc-duracion" type="number" bind:value={store.nuevoCargo.duracion_meses} class="mt-1" /></div>
      <div>
        <Label for="nc-nivel">Nivel</Label>
        <Select.Root type="single" bind:value={store.nuevoCargo.nivel}>
          <Select.Trigger id="nc-nivel" class="mt-1 w-full">
            <Select.Value placeholder="Elegir…" />
          </Select.Trigger>
          <Select.Content>
            {#each NIVELES_CARGO as n}<Select.Item value={n}>{n}</Select.Item>{/each}
          </Select.Content>
        </Select.Root>
      </div>
      <div><Label for="nc-orden">Orden</Label><Input id="nc-orden" type="number" bind:value={store.nuevoCargo.orden} class="mt-1" /></div>
      <div class="flex flex-col gap-1"><Label class="text-xs font-medium text-muted-foreground">Obligatorio</Label><Checkbox bind:checked={store.nuevoCargo.cargo_obligatorio} class="mt-1" /></div>
      <div class="flex flex-col gap-1"><Label class="text-xs font-medium text-muted-foreground">Activo</Label><Switch bind:checked={store.nuevoCargo.activo} disabled={store.nuevoCargo.cargo_obligatorio} class="mt-1" /></div>
    </div>
    <div class="flex justify-end"><Button size="sm" onclick={store.addCargo} disabled={store.busy}>Agregar</Button></div>
  {/if}

  {#if !tieneAutoridadesVigentes}
    <div class="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-900 dark:bg-amber-950/40">
      <AlertTriangleIcon class="size-5 shrink-0 text-amber-600 dark:text-amber-400" />
      <div class="flex flex-col gap-1">
        <span class="text-sm font-semibold text-amber-900 dark:text-amber-200">Sin autoridades designadas</span>
        <span class="text-sm text-amber-700 dark:text-amber-300">No hay autoridades vigentes para el ejercicio en curso.</span>
        <Button variant="outline" size="sm" class="mt-1 w-fit" onclick={() => navigate('gobierno')}>
          Ir a Asambleas y Autoridades
          <ArrowRightIcon data-icon="inline-end" />
        </Button>
      </div>
    </div>
  {/if}
</div>
