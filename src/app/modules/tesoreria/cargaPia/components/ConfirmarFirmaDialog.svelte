<script>
  import * as Table from '$lib/components/ui/table'
  import * as Dialog from '$lib/components/ui/dialog'
  import * as Alert from '$lib/components/ui/alert'
  import { Button } from '$lib/components/ui/button'
  import { Badge } from '$lib/components/ui/badge'
  import { formatARS } from '$core/utils/utils'
  import LockIcon from '@lucide/svelte/icons/lock'
  import AlertTriangleIcon from '@lucide/svelte/icons/triangle-alert'
  import CheckCircleIcon from '@lucide/svelte/icons/circle-check'

  let {
    open = $bindable(false),
    periodoKey = '',
    filasParaConfirmar = [],
    cuentaNombre = new Map(),
    totalIngresos = 0,
    totalEgresos = 0,
    saldoPeriodo = 0,
    storeError = '',
    storeBusy = false,
    firmando = $bindable(false),
    onConfirm = () => {},
    onCancel = () => {},
  } = $props()
</script>

{#snippet tipoBadge(tipo)}
  {#if tipo === 'Entrada'}
    <Badge variant="outline" class="text-xs text-primary border-primary/30">Entrada</Badge>
  {:else}
    <Badge variant="outline" class="text-xs text-destructive border-destructive/30">Salida</Badge>
  {/if}
{/snippet}

<Dialog.Root bind:open>
  <Dialog.Content class="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
    <Dialog.Header>
      <Dialog.Title>Confirmar cierre del período {periodoKey}</Dialog.Title>
      <Dialog.Description>
        Revisá los movimientos antes de firmar. Una vez firmado, el período no podrá modificarse.
      </Dialog.Description>
    </Dialog.Header>

    <div class="flex flex-col gap-4 py-2">
      {#if filasParaConfirmar.length === 0}
        <Alert.Root>
          <AlertTriangleIcon data-icon="inline-start" />
          <Alert.Title>Sin movimientos</Alert.Title>
          <Alert.Description>
            No hay filas con importe para este período. El período se firmará sin movimientos cargados.
          </Alert.Description>
        </Alert.Root>
      {:else}
        <div class="border rounded-lg overflow-x-auto">
          <Table.Root>
            <Table.Header>
              <Table.Row>
                <Table.Head class="w-16">Código</Table.Head>
                <Table.Head>Rubro</Table.Head>
                <Table.Head class="w-28">Cuenta</Table.Head>
                <Table.Head class="w-32 text-right">Importe</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {#each filasParaConfirmar as f (f.rowId)}
                <Table.Row>
                  <Table.Cell class="font-mono text-xs text-muted-foreground">{f.codigo}</Table.Cell>
                  <Table.Cell>
                    <div class="flex items-center gap-2">
                      <span class="text-sm">{f.nombre}</span>
                      {@render tipoBadge(f.tipo)}
                    </div>
                  </Table.Cell>
                  <Table.Cell class="text-xs text-muted-foreground">
                    {cuentaNombre.get(String(f.cuenta_id)) || '—'}
                  </Table.Cell>
                  <Table.Cell class="text-right font-mono text-sm">
                    {#if f.tipo === 'Entrada'}
                      <span class="text-primary">+{formatARS(f.importe)}</span>
                    {:else}
                      <span class="text-destructive">-{formatARS(f.importe)}</span>
                    {/if}
                  </Table.Cell>
                </Table.Row>
              {/each}
            </Table.Body>
            <Table.Footer>
              <Table.Row>
                <Table.Cell colspan="3" class="font-bold text-right text-sm">Total ingresos</Table.Cell>
                <Table.Cell class="text-right font-bold text-primary">+{formatARS(totalIngresos)}</Table.Cell>
              </Table.Row>
              <Table.Row>
                <Table.Cell colspan="3" class="font-bold text-right text-sm">Total egresos</Table.Cell>
                <Table.Cell class="text-right font-bold text-destructive">-{formatARS(totalEgresos)}</Table.Cell>
              </Table.Row>
              <Table.Row>
                <Table.Cell colspan="3" class="font-bold text-right text-sm">Saldo del período</Table.Cell>
                <Table.Cell class="text-right font-bold">{formatARS(saldoPeriodo)}</Table.Cell>
              </Table.Row>
            </Table.Footer>
          </Table.Root>
        </div>
      {/if}

      <Alert.Root class="border-primary/45 bg-primary/10 text-primary">
        <CheckCircleIcon data-icon="inline-start" />
        <Alert.Description>
          Se guardarán los cambios pendientes y se firmará el período <strong>{periodoKey}</strong>. Esta acción no se puede deshacer.
        </Alert.Description>
      </Alert.Root>

      {#if storeError}
        <Alert.Root variant="destructive">
          <AlertTriangleIcon data-icon="inline-start" />
          <Alert.Description>{storeError}</Alert.Description>
        </Alert.Root>
      {/if}
    </div>

    <Dialog.Footer>
      <Button variant="outline" onclick={onCancel} disabled={firmando}>
        Cancelar
      </Button>
      <Button variant="secondary" onclick={onConfirm} disabled={firmando || storeBusy}>
        {#if firmando}
          Firmando…
        {:else}
          <LockIcon data-icon="inline-start" />
          Confirmar y firmar
        {/if}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
