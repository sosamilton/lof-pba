<script>
  import * as Card from '$lib/components/ui/card'
  import { Badge } from '$lib/components/ui/badge'
  import * as Table from '$lib/components/ui/table'
  import * as Tabs from '$lib/components/ui/tabs'
  import * as Select from '$lib/components/ui/select'
  import EmptyState from '$lib/components/EmptyState.svelte'
  import { ORGANISMOS, ORGANISMO_LABELS } from '$app/modules/gobierno/constants.js'
  import { formatFecha } from '$core/format/format'
  import HistoryIcon from '@lucide/svelte/icons/history'

  let { store } = $props()

  // Ejercicios ordenados descendente para el selector (más reciente primero).
  let ejerciciosOpciones = $derived(
    [...(store.ejercicios || [])]
      .sort((a, b) => Number(b.anio_inicio || 0) - Number(a.anio_inicio || 0))
      .map((e) => ({ value: String(e.id), label: `${e.anio_inicio}-${e.anio_fin}` }))
  )
</script>

<Card.Root>
  <Card.Header>
    <div class="flex flex-wrap items-center justify-between gap-3">
      <Card.Title class="text-base">Histórico de mandatos</Card.Title>
      <div class="flex items-center gap-3">
        {#if ejerciciosOpciones.length > 1}
          <div class="flex items-center gap-2">
            <span class="text-xs text-muted-foreground">Ejercicio:</span>
            <Select.Root
              type="single"
              value={String(store.ejercicioHistorico ?? '')}
              onValueChange={(v) => { store.ejercicioHistorico = v ? Number(v) : null }}
            >
              <Select.Trigger class="h-8 w-[130px] text-xs">
                <Select.Value placeholder="Ejercicio…" />
              </Select.Trigger>
              <Select.Content>
                {#each ejerciciosOpciones as opt (opt.value)}
                  <Select.Item value={opt.value} class="text-xs">{opt.label}</Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>
          </div>
        {/if}
        <Tabs.Root bind:value={store.organismo}>
          <Tabs.List>
            {#each ORGANISMOS as org}
              <Tabs.Trigger value={org}>{ORGANISMO_LABELS[org]}</Tabs.Trigger>
            {/each}
          </Tabs.List>
        </Tabs.Root>
      </div>
    </div>
    <Card.Description class="text-xs">
      Mandatos del ejercicio seleccionado (vigentes y cesados). Permite reconstruir quién ocupó cada cargo y desde qué acta.
    </Card.Description>
  </Card.Header>
  <Card.Content>
    {#if store.rowsHistorico.length === 0}
      <EmptyState
        title="Sin mandatos registrados"
        sub="Cargá las autoridades desde una asamblea en el tab 'Asambleas y reuniones' para ver el histórico aquí."
      >
        {#snippet icon()}
          <HistoryIcon class="size-8 text-muted-foreground" />
        {/snippet}
      </EmptyState>
    {:else}
      <div class="overflow-x-auto rounded-lg border border-border">
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.Head>Cargo</Table.Head>
              <Table.Head>Persona</Table.Head>
              <Table.Head class="w-[120px]">Asunción</Table.Head>
              <Table.Head class="w-[120px]">Cese</Table.Head>
              <Table.Head class="w-[110px]">Motivo</Table.Head>
              <Table.Head class="w-[110px]">Origen</Table.Head>
              <Table.Head class="w-[120px]">Acta ref.</Table.Head>
              <Table.Head class="w-[90px]">Estado</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {#each store.rowsHistorico as r (r.id ?? `${r.cargoId}-${r.fecha_asuncion}`)}
              <Table.Row>
                <Table.Cell><span class="text-sm font-medium">{r.cargoNombre}</span></Table.Cell>
                <Table.Cell>
                  <div class="flex flex-col gap-0.5">
                    <span class="text-sm">{r.apellido_nombre || '(sin nombre)'}</span>
                    {#if r.reemplaza_autoridad_id}
                      <span class="text-xs text-muted-foreground">Reemplaza a mandato anterior</span>
                    {/if}
                  </div>
                </Table.Cell>
                <Table.Cell><span class="text-xs">{formatFecha(r.fecha_asuncion) || '-'}</span></Table.Cell>
                <Table.Cell><span class="text-xs">{formatFecha(r.fecha_cese) || '-'}</span></Table.Cell>
                <Table.Cell><span class="text-xs">{r.motivo_cese || '-'}</span></Table.Cell>
                <Table.Cell>
                  {#if r.tipo_origen === 'ReunionCD'}
                    <Badge variant="outline">RCD</Badge>
                  {:else if r.tipo_origen === 'Asamblea'}
                    <Badge variant="secondary">Asamblea</Badge>
                  {/if}
                </Table.Cell>
                <Table.Cell><span class="text-xs">{r.acta_origen_ref || '-'}</span></Table.Cell>
                <Table.Cell>
                  {#if r.cesado}
                    <Badge variant="destructive">Cesado</Badge>
                  {:else}
                    <Badge variant="default">Vigente</Badge>
                  {/if}
                </Table.Cell>
              </Table.Row>
            {/each}
          </Table.Body>
        </Table.Root>
      </div>
    {/if}
  </Card.Content>
</Card.Root>
