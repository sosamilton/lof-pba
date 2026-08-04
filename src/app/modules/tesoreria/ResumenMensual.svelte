<script>
  import { onMount } from 'svelte'
  import { resumenStore as store } from './resumenStore.svelte.js'
  import { formatARS } from '$core/utils'
  import { Button } from '$lib/components/ui/button'
  import * as Card from '$lib/components/ui/card'
  import * as Table from '$lib/components/ui/table'
  import * as Tabs from '$lib/components/ui/tabs'
  import * as Dialog from '$lib/components/ui/dialog'
  import * as Tooltip from '$lib/components/ui/tooltip'
  import * as Alert from '$lib/components/ui/alert'
  import { Badge } from '$lib/components/ui/badge'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import { Skeleton } from '$lib/components/ui/skeleton'
  import PageScaffold from '$lib/components/PageScaffold.svelte'
  import BarChartIcon from '@lucide/svelte/icons/bar-chart'
  import WalletIcon from '@lucide/svelte/icons/wallet'
  import AlertTriangleIcon from '@lucide/svelte/icons/triangle-alert'
  import PencilIcon from '@lucide/svelte/icons/pencil'
  import PlusIcon from '@lucide/svelte/icons/plus'

  onMount(() => store.load())

  // Diálogo de carga de total manual.
  let dialogCargaAbierto = $state(false)
  let periodoCarga = $state('')
  let formCarga = $state({
    ingresos_banco: 0, ingresos_efectivo: 0, ingresos_caja_chica: 0,
    egresos_banco: 0, egresos_efectivo: 0, egresos_caja_chica: 0,
  })

  const abrirCargaManual = (periodo) => {
    periodoCarga = periodo
    const existente = store.cierreDePeriodo(periodo)
    formCarga = {
      ingresos_banco: Number(existente?.ingresos_banco) || 0,
      ingresos_efectivo: Number(existente?.ingresos_efectivo) || 0,
      ingresos_caja_chica: Number(existente?.ingresos_caja_chica) || 0,
      egresos_banco: Number(existente?.egresos_banco) || 0,
      egresos_efectivo: Number(existente?.egresos_efectivo) || 0,
      egresos_caja_chica: Number(existente?.egresos_caja_chica) || 0,
    }
    dialogCargaAbierto = true
  }

  const cerrarCargaManual = () => {
    dialogCargaAbierto = false
    periodoCarga = ''
  }

  const guardarCargaManual = async () => {
    const ok = await store.guardarCierreManual({
      periodo: periodoCarga,
      ingresosBanco: formCarga.ingresos_banco,
      ingresosEfectivo: formCarga.ingresos_efectivo,
      ingresosCajaChica: formCarga.ingresos_caja_chica,
      egresosBanco: formCarga.egresos_banco,
      egresosEfectivo: formCarga.egresos_efectivo,
      egresosCajaChica: formCarga.egresos_caja_chica,
    })
    if (ok) dialogCargaAbierto = false
  }
</script>

<PageScaffold title="Resumen">
  <div class="flex items-center gap-2 mb-4">
    <BarChartIcon class="size-5 text-primary" />
    <h1 class="text-lg font-bold">Resumen de tesorería</h1>
  </div>

  {#if store.loading}
    <Skeleton class="h-64 w-full" />
  {:else if store.error}
    <Alert.Root variant="destructive">
      <AlertTriangleIcon data-icon="inline-start" />
      <Alert.Title>Error</Alert.Title>
      <Alert.Description>{store.error}</Alert.Description>
    </Alert.Root>
  {:else}
    <!-- Selectores: ejercicio + vista -->
    <div class="flex flex-wrap items-end gap-3 mb-4">
      <div class="flex flex-col gap-1">
        <Label class="text-xs font-bold text-muted-foreground" for="resumen_ej">Ejercicio</Label>
        <select
          id="resumen_ej"
          value={store.selectedEjercicioId}
          onchange={(e) => store.setSelectedEjercicio(e.target.value)}
          class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {#each store.ejercicios as e (e.id)}
            <option value={e.id}>{e.anio_inicio}-{e.anio_fin} · {e.mes_inicio}{e.en_curso ? ' (en curso)' : ''}</option>
          {/each}
        </select>
      </div>
      <Tabs.Root value={store.vista} onValueChange={(v) => store.setVista(v)}>
        <Tabs.List class="h-9">
          <Tabs.Trigger value="mensual" class="px-3">Mensual</Tabs.Trigger>
          <Tabs.Trigger value="semanal" class="px-3">Semanal</Tabs.Trigger>
        </Tabs.List>
      </Tabs.Root>
    </div>

    {#if store.saldosInicialesEnCero}
      <Alert.Root class="mb-4">
        <AlertTriangleIcon data-icon="inline-start" />
        <Alert.Title>Faltan saldos iniciales</Alert.Title>
        <Alert.Description>
          Los saldos iniciales del ejercicio están en 0. Editálos desde <strong>Cooperadora → Ejercicios</strong> para que el arrastre sea correcto.
        </Alert.Description>
      </Alert.Root>
    {/if}

    {#if store.resumen.length === 0}
      <Card.Root>
        <Card.Content class="pt-6 text-center text-sm text-muted-foreground">
          No hay períodos con movimientos ni cargas manuales para este ejercicio.
        </Card.Content>
      </Card.Root>
    {:else}
      <Card.Root>
        <Card.Content class="pt-6">
          <Table.Root>
            <Table.Header>
              <Table.Row>
                <Table.Head>Período</Table.Head>
                <Table.Head class="text-right">Ingresos</Table.Head>
                <Table.Head class="text-right">Egresos</Table.Head>
                <Table.Head class="text-right">Saldo inicial</Table.Head>
                <Table.Head class="text-right">Saldo del período</Table.Head>
                <Table.Head class="text-center">Origen</Table.Head>
                <Table.Head class="text-right">Acciones</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {#each store.resumen as r (r.periodo)}
                <Table.Row>
                  <Table.Cell class="font-mono">{r.periodo}</Table.Cell>
                  <Table.Cell class="text-right text-primary">+{formatARS(r.ingresos)}</Table.Cell>
                  <Table.Cell class="text-right text-destructive">-{formatARS(r.egresos)}</Table.Cell>
                  <Table.Cell class="text-right">{formatARS(r.saldoInicial)}</Table.Cell>
                  <Table.Cell class="text-right font-semibold">{formatARS(r.saldoPeriodo)}</Table.Cell>
                  <Table.Cell class="text-center">
                    {#if r.origen === 'detalle'}
                      <Badge variant="default">Detalle</Badge>
                    {:else}
                      <Badge variant="secondary">Manual</Badge>
                    {/if}
                  </Table.Cell>
                  <Table.Cell class="text-right">
                    {#if r.origen === 'detalle'}
                      <Tooltip.Root>
                        <Tooltip.Trigger>
                          <Button variant="ghost" size="sm" disabled>
                            <PlusIcon data-icon="inline-start" />
                            Cargar total
                          </Button>
                        </Tooltip.Trigger>
                        <Tooltip.Content>Este período ya tiene movimientos detallados.</Tooltip.Content>
                      </Tooltip.Root>
                    {:else}
                      <Button variant="outline" size="sm" onclick={() => abrirCargaManual(r.periodo)}>
                        <PencilIcon data-icon="inline-start" />
                        Editar total
                      </Button>
                    {/if}
                  </Table.Cell>
                </Table.Row>
              {/each}
            </Table.Body>
            <Table.Footer>
              <Table.Row>
                <Table.Cell class="font-bold">Totales</Table.Cell>
                <Table.Cell class="text-right font-bold text-primary">+{formatARS(store.totales.ingresos)}</Table.Cell>
                <Table.Cell class="text-right font-bold text-destructive">-{formatARS(store.totales.egresos)}</Table.Cell>
                <Table.Cell></Table.Cell>
                <Table.Cell class="text-right font-bold">{formatARS(store.totales.saldoFinal)}</Table.Cell>
                <Table.Cell></Table.Cell>
                <Table.Cell></Table.Cell>
              </Table.Row>
            </Table.Footer>
          </Table.Root>
        </Card.Content>
      </Card.Root>
    {/if}
  {/if}
</PageScaffold>

<!-- Diálogo: carga de total manual para un período -->
<Dialog.Root bind:open={dialogCargaAbierto}>
  <Dialog.Content class="sm:max-w-[520px]">
    <Dialog.Header>
      <Dialog.Title>Cargar total manual</Dialog.Title>
      <Dialog.Description>
        Período: <span class="font-mono font-semibold">{periodoCarga}</span>. Ingresá los totales por cuenta. Se guardará como carga manual y se usará solo si no hay movimientos detallados.
      </Dialog.Description>
    </Dialog.Header>
    <div class="flex flex-col gap-4 py-2">
      <div>
        <div class="text-xs font-bold text-muted-foreground mb-2">Ingresos</div>
        <div class="grid gap-3 sm:grid-cols-3">
          <div class="flex flex-col gap-1">
            <Label class="text-xs text-muted-foreground" for="carga_ing_banco">Banco</Label>
            <Input id="carga_ing_banco" type="number" bind:value={formCarga.ingresos_banco} placeholder="0" />
          </div>
          <div class="flex flex-col gap-1">
            <Label class="text-xs text-muted-foreground" for="carga_ing_efectivo">Efectivo</Label>
            <Input id="carga_ing_efectivo" type="number" bind:value={formCarga.ingresos_efectivo} placeholder="0" />
          </div>
          <div class="flex flex-col gap-1">
            <Label class="text-xs text-muted-foreground" for="carga_ing_caja">Caja chica</Label>
            <Input id="carga_ing_caja" type="number" bind:value={formCarga.ingresos_caja_chica} placeholder="0" />
          </div>
        </div>
      </div>
      <div>
        <div class="text-xs font-bold text-muted-foreground mb-2">Egresos</div>
        <div class="grid gap-3 sm:grid-cols-3">
          <div class="flex flex-col gap-1">
            <Label class="text-xs text-muted-foreground" for="carga_egr_banco">Banco</Label>
            <Input id="carga_egr_banco" type="number" bind:value={formCarga.egresos_banco} placeholder="0" />
          </div>
          <div class="flex flex-col gap-1">
            <Label class="text-xs text-muted-foreground" for="carga_egr_efectivo">Efectivo</Label>
            <Input id="carga_egr_efectivo" type="number" bind:value={formCarga.egresos_efectivo} placeholder="0" />
          </div>
          <div class="flex flex-col gap-1">
            <Label class="text-xs text-muted-foreground" for="carga_egr_caja">Caja chica</Label>
            <Input id="carga_egr_caja" type="number" bind:value={formCarga.egresos_caja_chica} placeholder="0" />
          </div>
        </div>
      </div>
      {#if store.error}
        <Alert.Root variant="destructive">
          <AlertTriangleIcon data-icon="inline-start" />
          <Alert.Title>Error</Alert.Title>
          <Alert.Description>{store.error}</Alert.Description>
        </Alert.Root>
      {/if}
    </div>
    <Dialog.Footer>
      <Button variant="outline" onclick={cerrarCargaManual} disabled={store.busy}>Cancelar</Button>
      <Button onclick={guardarCargaManual} disabled={store.busy}>
        {#if store.busy}Guardando…{:else}Guardar{/if}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
