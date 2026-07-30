<script>
  import { onMount } from 'svelte'
  import { gobiernoStore as store } from '../stores/gobiernoStore.svelte'
  import { isInGrist, subscribeRecords } from '../grist'
  import { ORGANISMOS, ORGANISMO_LABELS } from '../utils'
  import { personaLabel } from '../personas'
  import { notify } from '../stores/notify.svelte'
  import { Button } from '$lib/components/ui/button'
  import * as Card from '$lib/components/ui/card'
  import { Badge } from '$lib/components/ui/badge'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import { Separator } from '$lib/components/ui/separator'
  import { Textarea } from '$lib/components/ui/textarea'
  import * as Tabs from '$lib/components/ui/tabs'
  import * as Table from '$lib/components/ui/table'
  import { Alert, AlertDescription } from '$lib/components/ui/alert'
  import { Skeleton } from '$lib/components/ui/skeleton'
  import PlusIcon from '@lucide/svelte/icons/plus'
  import TrashIcon from '@lucide/svelte/icons/trash-2'
  import RefreshIcon from '@lucide/svelte/icons/refresh-cw'
  import UsersIcon from '@lucide/svelte/icons/users'
  import GavelIcon from '@lucide/svelte/icons/gavel'
  import LinkIcon from '@lucide/svelte/icons/link'
  import UnlinkIcon from '@lucide/svelte/icons/unlink'

  onMount(async () => {
    if (!isInGrist()) return
    await store.initFromOptions()
    const unsub = subscribeRecords(() => {
      if (!store.busy && !store.loading) store.load()
    })
    await store.load()
    return unsub
  })

  const handleSaveComision = async () => {
    await store.saveComision()
    if (store.error) notify.error(store.error)
    else if (store.notice) notify.success(store.notice)
  }

  const handleSaveAsamblea = async () => {
    await store.saveAsamblea()
    if (store.error) notify.error(store.error)
    else if (store.notice) notify.success(store.notice)
  }

  const handleInitComision = async () => {
    await store.initComision()
    if (store.error) notify.error(store.error)
    else if (store.notice) notify.info(store.notice)
  }
</script>

{#if !isInGrist()}
  <h1 class="text-lg font-bold">Gobierno</h1>
  <p class="text-sm text-muted-foreground">Esta pantalla solo funciona dentro de Grist.</p>
{:else if store.loading}
  <div class="flex flex-col gap-4">
    <Skeleton class="h-8 w-48" />
    <Skeleton class="h-10 w-full" />
    <Skeleton class="h-64 w-full" />
  </div>
{:else}
  <div class="mb-4">
    <h1 class="text-lg font-bold">Gobierno</h1>
    <p class="text-sm text-muted-foreground">
      {#if store.ejercicio}
        Ejercicio en curso: <span class="font-mono">{store.ejercicio.anio_inicio}-{store.ejercicio.anio_fin}</span>
      {:else}
        No hay ejercicio en curso. Activá uno en "Cooperadora".
      {/if}
    </p>
  </div>

  {#if store.ejercicio}
    <Tabs.Root bind:value={store.tab}>
      <Tabs.List class="mb-4">
        <Tabs.Trigger value="comision">
          <UsersIcon class="mr-1.5 inline size-4" />
          Comisión
        </Tabs.Trigger>
        <Tabs.Trigger value="asambleas">
          <GavelIcon class="mr-1.5 inline size-4" />
          Asambleas
        </Tabs.Trigger>
      </Tabs.List>

      <!-- Tab: Comisión -->
      <Tabs.Content value="comision">
        <Card.Root>
          <Card.Header>
            <div class="flex flex-wrap items-center justify-between gap-3">
              <Tabs.Root bind:value={store.organismo}>
                <Tabs.List>
                  {#each ORGANISMOS as org}
                    <Tabs.Trigger value={org}>{ORGANISMO_LABELS[org]}</Tabs.Trigger>
                  {/each}
                </Tabs.List>
              </Tabs.Root>
              <div class="flex gap-2">
                <Button variant="outline" size="sm" onclick={handleInitComision}>Inicializar comisión</Button>
                <Button size="sm" onclick={handleSaveComision}>Guardar comisión</Button>
              </div>
            </div>
          </Card.Header>
          <Card.Content>
            {#if store.rows.length === 0}
              <p class="py-8 text-center text-sm text-muted-foreground">No hay cargos activos. Configurá cargos en "Cooperadora".</p>
            {:else}
              <div class="overflow-x-auto rounded-lg border border-border">
                <Table.Root>
                  <Table.Header>
                    <Table.Row>
                      <Table.Head>Cargo</Table.Head>
                      <Table.Head>Apellido y nombre</Table.Head>
                      <Table.Head class="w-[120px]">DNI</Table.Head>
                      <Table.Head class="w-[140px]">CUIL</Table.Head>
                      <Table.Head class="w-[140px]">Asunción</Table.Head>
                      <Table.Head class="w-[140px]">Vence</Table.Head>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {#each store.rows as r (r.cargoId)}
                      <Table.Row>
                        <Table.Cell>
                          <div class="text-sm font-bold">{r.cargoNombre}</div>
                          {#if r.cargoObligatorio}
                            <Badge variant="secondary" class="mt-1">Obligatorio</Badge>
                          {/if}
                        </Table.Cell>
                        <Table.Cell>
                          <div class="flex flex-col gap-1">
                            <Input bind:value={r.apellido_nombre} placeholder="Apellido y nombre" disabled={!!r.persona_id} class="h-8 text-sm" />
                            {#if r.persona_id}
                              <Button variant="ghost" size="sm" class="h-7 self-start px-2 text-xs" onclick={() => store.unlinkPersona(r)}>
                                <UnlinkIcon class="mr-1 size-3" />
                                Desvincular
                              </Button>
                            {:else}
                              <Input
                                bind:value={store.personaSearch}
                                oninput={() => store.doPersonaSearch(r)}
                                placeholder="Buscar persona…"
                                class="h-8 text-xs"
                              />
                              {#if store.personaSearching && store.searchTargetRow === r}
                                <span class="text-xs text-muted-foreground">Buscando…</span>
                              {/if}
                              {#if store.personaResults.length > 0 && store.searchTargetRow === r}
                                <div class="flex flex-col gap-1">
                                  {#each store.personaResults as p (p.id)}
                                    <button
                                      class="flex items-center gap-1.5 rounded-md border border-border px-2 py-1.5 text-left text-xs transition-colors hover:bg-primary/10"
                                      onclick={() => store.linkPersona(p)}
                                    >
                                      <LinkIcon class="size-3 shrink-0 text-primary" />
                                      {personaLabel(p)} · DNI {p.dni || '-'}
                                    </button>
                                  {/each}
                                </div>
                              {/if}
                            {/if}
                          </div>
                        </Table.Cell>
                        <Table.Cell><Input bind:value={r.dni} placeholder="DNI" disabled={!!r.persona_id} class="h-8 text-sm" /></Table.Cell>
                        <Table.Cell><Input bind:value={r.cuil} placeholder="CUIL" disabled={!!r.persona_id} class="h-8 text-sm" /></Table.Cell>
                        <Table.Cell><Input type="date" bind:value={r.fecha_asuncion} class="h-8 text-sm" /></Table.Cell>
                        <Table.Cell><Input type="date" bind:value={r.fecha_vencimiento} class="h-8 text-sm" /></Table.Cell>
                      </Table.Row>
                    {/each}
                  </Table.Body>
                </Table.Root>
              </div>
            {/if}
          </Card.Content>
        </Card.Root>
      </Tabs.Content>

      <!-- Tab: Asambleas -->
      <Tabs.Content value="asambleas">
        <div class="grid gap-4" style="grid-template-columns: minmax(280px, 360px) 1fr">
          <!-- Lista de asambleas -->
          <div class="max-h-[calc(100vh-200px)] overflow-y-auto rounded-lg border border-border bg-card">
            {#if store.asambleas.length === 0}
              <div class="p-6 text-center text-sm text-muted-foreground">No hay asambleas</div>
            {:else}
              {#each store.asambleas as a (a.id)}
                <button
                  class="w-full border-b border-border px-4 py-3 text-left transition-colors hover:bg-accent {a.id === store.selectedAsambleaId ? 'bg-primary/10' : ''}"
                  onclick={() => store.editAsamblea(a)}
                >
                  <div class="text-sm font-semibold">{a.fecha || '(sin fecha)'} · {a.tipo_asamblea}</div>
                  <div class="text-xs text-muted-foreground">Acta {a.acta_numero || '-'} · {a.socios_presentes_cantidad ?? '-'} presentes</div>
                </button>
              {/each}
            {/if}
          </div>

          <!-- Editor de asamblea -->
          <div>
            <div class="mb-3 flex gap-2">
              <Button size="sm" onclick={store.newAsamblea}>
                <PlusIcon data-icon="inline-start" />
                Nueva asamblea
              </Button>
              <Button variant="outline" size="sm" onclick={store.loadAsambleas}>
                <RefreshIcon data-icon="inline-start" />
                Recargar
              </Button>
            </div>

            {#if store.asambleaForm}
              <Card.Root>
                <Card.Header>
                  <Card.Title class="text-base">
                    {store.asambleaForm.id ? 'Editar asamblea' : 'Nueva asamblea'}
                  </Card.Title>
                </Card.Header>
                <Card.Content class="flex flex-col gap-4">
                  <div class="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label for="as-fecha">Fecha</Label>
                      <Input id="as-fecha" type="date" bind:value={store.asambleaForm.fecha} class="mt-1" />
                    </div>
                    <div>
                      <Label for="as-tipo">Tipo</Label>
                      <select id="as-tipo" bind:value={store.asambleaForm.tipo_asamblea} class="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                        <option value="AnualOrdinaria">Anual ordinaria</option>
                        <option value="Extraordinaria">Extraordinaria</option>
                      </select>
                    </div>
                    <div>
                      <Label for="as-acta">Acta N°</Label>
                      <Input id="as-acta" bind:value={store.asambleaForm.acta_numero} class="mt-1" />
                    </div>
                    <div>
                      <Label for="as-fojas">Fojas</Label>
                      <Input id="as-fojas" bind:value={store.asambleaForm.acta_fojas} class="mt-1" />
                    </div>
                    <div>
                      <Label for="as-presentes">Presentes</Label>
                      <Input id="as-presentes" type="number" bind:value={store.asambleaForm.socios_presentes_cantidad} class="mt-1" />
                    </div>
                    <div>
                      <Label for="as-cuota">Cuota social ($)</Label>
                      <Input id="as-cuota" type="number" bind:value={store.asambleaForm.cuota_social_importe} class="mt-1" />
                    </div>
                    <div>
                      <Label for="as-modalidad">Cuota modalidad</Label>
                      <select id="as-modalidad" bind:value={store.asambleaForm.cuota_social_modalidad} class="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                        <option value="Mensual">Mensual</option>
                        <option value="Anual">Anual</option>
                      </select>
                    </div>
                    <div>
                      <Label for="as-caja">Caja chica ($)</Label>
                      <Input id="as-caja" type="number" bind:value={store.asambleaForm.caja_chica_importe} class="mt-1" />
                    </div>
                  </div>

                  <Separator />

                  <div class="flex flex-col gap-2">
                    <div class="flex items-center justify-between">
                      <span class="text-sm font-semibold">Resoluciones</span>
                      <Button variant="outline" size="sm" onclick={store.addResolucion}>
                        <PlusIcon data-icon="inline-start" />
                        Agregar
                      </Button>
                    </div>
                    {#each store.resoluciones as res, idx}
                      <div class="flex items-start gap-2">
                        <div class="flex-1">
                          <Label class="text-xs text-muted-foreground">Punto {idx + 1}</Label>
                          <Textarea bind:value={res.texto} placeholder="Texto de la resolución…" class="mt-1" />
                        </div>
                        <Button variant="ghost" size="sm" class="mt-5" onclick={() => store.removeResolucion(idx)}>
                          <TrashIcon class="size-4" />
                        </Button>
                      </div>
                    {/each}
                  </div>

                  <div class="flex justify-end">
                    <Button onclick={handleSaveAsamblea}>Guardar</Button>
                  </div>
                </Card.Content>
              </Card.Root>
            {:else}
              <p class="text-sm text-muted-foreground">Seleccioná una asamblea o creá una nueva.</p>
            {/if}
          </div>
        </div>
      </Tabs.Content>
    </Tabs.Root>
  {/if}

  {#if store.error}
    <Alert variant="destructive" class="mt-4">
      <AlertDescription>{store.error}</AlertDescription>
    </Alert>
  {/if}
{/if}
