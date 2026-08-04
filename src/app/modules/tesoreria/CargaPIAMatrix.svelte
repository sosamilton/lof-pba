<script>
  import { movimientosStore as store } from './movimientosStore.svelte.js'
  import { formatARS, normalize } from '$core/utils'
  import { Button } from '$lib/components/ui/button'
  import * as Card from '$lib/components/ui/card'
  import * as Table from '$lib/components/ui/table'
  import * as Dialog from '$lib/components/ui/dialog'
  import * as Alert from '$lib/components/ui/alert'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import { Badge } from '$lib/components/ui/badge'
  import PlusIcon from '@lucide/svelte/icons/plus'
  import PencilIcon from '@lucide/svelte/icons/pencil'
  import LockIcon from '@lucide/svelte/icons/lock'
  import UnlockIcon from '@lucide/svelte/icons/lock-open'
  import AlertTriangleIcon from '@lucide/svelte/icons/triangle-alert'

  // Diálogo de matriz PIA.
  let abierto = $state(false)
  let fecha = $state('')
  // Filas: una por rubro PIA. { rubro_id, nombre, tipo, grupo, importe, cuenta_id, detalle }
  let filas = $state([])
  let cargandoPeriodo = $state(false)

  // Agrupar rubros por grupo para mostrar secciones.
  let grupos = $derived.by(() => {
    const map = new Map()
    for (const f of filas) {
      const g = f.grupo || 'Otros'
      if (!map.has(g)) map.set(g, [])
      map.get(g).push(f)
    }
    return [...map.entries()]
  })

  // Totales calculados.
  let totalIngresos = $derived(filas.reduce((s, f) => f.tipo === 'Entrada' ? s + (Number(f.importe) || 0) : s, 0))
  let totalEgresos = $derived(filas.reduce((s, f) => f.tipo === 'Salida' ? s + (Number(f.importe) || 0) : s, 0))
  let saldoPeriodo = $derived(totalIngresos - totalEgresos)

  const periodoKey = $derived(String(fecha || '').slice(0, 7))
  let firmado = $derived(periodoKey ? store.periodoFirmado(periodoKey) : false)

  /**
   * Construye las filas base (una por rubro PIA) y las precarga con los
   * movimientos existentes del período si los hay.
   * @param {string} fechaInicial
   */
  const abrir = async (fechaInicial) => {
    fecha = fechaInicial || new Date().toISOString().slice(0, 10)
    abierto = true
    await cargarFilas()
  }

  /**
   * Reconstruye las filas con los rubros PIA y precarga los importes
   * desde los movimientos existentes del período seleccionado.
   */
  const cargarFilas = async () => {
    if (!periodoKey) return
    cargandoPeriodo = true
    try {
      const cuentaDefault = store.cuentaDefaultId || (store.cuentas[0]?.id ?? '')
      const existentes = await store.getMovimientosPorRubro(periodoKey)
      filas = [...store.rubros]
        .sort((a, b) => normalize(a.grupo_rubro || '').localeCompare(normalize(b.grupo_rubro || ''))
          || normalize(a.nombre_oficial || '').localeCompare(normalize(b.nombre_oficial || '')))
        .map((r) => {
          const existente = existentes.get(Number(r.id))
          return {
            rubro_id: r.id,
            nombre: r.nombre_oficial || '(sin nombre)',
            codigo: r.codigo_rubro || '',
            tipo: r.tipo_rubro || 'Entrada',
            grupo: r.grupo_rubro || 'Otros',
            importe: existente ? String(existente.importe || '') : '',
            cuenta_id: existente?.cuenta_id ? String(existente.cuenta_id) : cuentaDefault,
            detalle: existente?.detalle || '',
          }
        })
    } catch (e) {
      console.error('[CargaPIAMatrix] Error al precargar filas:', e)
    } finally {
      cargandoPeriodo = false
    }
  }

  // Cuando cambia el período (fecha), recargar las filas con los datos
  // existentes del nuevo período. Solo si el diálogo está abierto.
  let lastPeriodo = ''
  $effect(() => {
    const pk = periodoKey
    if (!abierto || !pk || pk === lastPeriodo) return
    lastPeriodo = pk
    cargarFilas()
  })

  const cerrar = () => { abierto = false }

  const guardar = async () => {
    const validas = filas
      .filter((f) => Number(f.importe) > 0)
      .map((f) => ({
        rubro_id: Number(f.rubro_id),
        importe: Number(f.importe),
        cuenta_id: Number(f.cuenta_id),
        detalle: f.detalle || '',
      }))
    const ok = await store.guardarCargaPIA({ fecha, filas: validas })
    if (ok) {
      // Recargar las filas para reflejar el estado guardado (upsert).
      await cargarFilas()
    }
  }

  const firmar = async () => {
    if (!periodoKey) return
    const ok = await store.firmarPeriodo(periodoKey)
    // No cerramos el diálogo: el usuario puede seguir viendo la matriz (read-only).
  }

  // Exponer abrir para que ResumenMensual.svelte lo invoque.
  export { abrir }
</script>

<Dialog.Root bind:open={abierto}>
  <Dialog.Content class="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
    <Dialog.Header>
      <Dialog.Title>Carga PIA por rubro</Dialog.Title>
      <Dialog.Description>
        Un movimiento por rubro PIA para el período seleccionado. Si ya hay movimientos cargados para ese período, se muestran y se actualizan al guardar. Solo se guardan las filas con importe &gt; 0.
      </Dialog.Description>
    </Dialog.Header>

    <div class="flex flex-col gap-4 py-2">
      <!-- Selector de período + estado de firma -->
      <div class="flex flex-wrap items-end gap-3">
        <div class="flex flex-col gap-1">
          <Label class="text-xs text-muted-foreground" for="pia_fecha">Período (mes)</Label>
          <Input id="pia_fecha" type="month" bind:value={fecha} disabled={firmado} />
        </div>
        {#if firmado}
          <Badge variant="destructive" class="mb-1.5">
            <LockIcon class="size-3" />
            Firmado — no editable
          </Badge>
        {/if}
      </div>

      {#if firmado}
        <Alert.Root>
          <LockIcon data-icon="inline-start" />
          <Alert.Title>Período firmado</Alert.Title>
          <Alert.Description>
            El período {periodoKey} está firmado. Los movimientos no pueden modificarse desde esta pantalla.
          </Alert.Description>
        </Alert.Root>
      {/if}

      <!-- Matriz por grupo -->
      <div class="border rounded-lg overflow-hidden">
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.Head class="w-20">Código</Table.Head>
              <Table.Head>Rubro PIA</Table.Head>
              <Table.Head class="w-32">Cuenta</Table.Head>
              <Table.Head class="w-40">Detalle</Table.Head>
              <Table.Head class="w-32 text-right">Importe</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {#each grupos as [grupo, filasGrupo] (grupo)}
              <Table.Row class="bg-muted/50">
                <Table.Cell colspan="5" class="font-bold text-xs uppercase text-muted-foreground py-2">
                  {grupo}
                </Table.Cell>
              </Table.Row>
              {#each filasGrupo as f (f.rubro_id)}
                <Table.Row>
                  <Table.Cell class="font-mono text-xs text-muted-foreground">{f.codigo}</Table.Cell>
                  <Table.Cell>
                    <div class="flex items-center gap-2">
                      <span>{f.nombre}</span>
                      {#if f.tipo === 'Entrada'}
                        <Badge variant="outline" class="text-xs text-primary border-primary/30">Entrada</Badge>
                      {:else}
                        <Badge variant="outline" class="text-xs text-destructive border-destructive/30">Salida</Badge>
                      {/if}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <select
                      bind:value={f.cuenta_id}
                      disabled={firmado}
                      class="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                    >
                      {#each store.cuentas as c (c.id)}
                        <option value={c.id}>{c.nombre_cuenta}</option>
                      {/each}
                    </select>
                  </Table.Cell>
                  <Table.Cell>
                    <Input
                      type="text"
                      bind:value={f.detalle}
                      placeholder="—"
                      disabled={firmado}
                      class="h-8 text-xs"
                    />
                  </Table.Cell>
                  <Table.Cell class="text-right">
                    <Input
                      type="number"
                      bind:value={f.importe}
                      placeholder="0"
                      disabled={firmado}
                      class="h-8 text-right text-xs"
                    />
                  </Table.Cell>
                </Table.Row>
              {/each}
            {/each}
          </Table.Body>
          <Table.Footer>
            <Table.Row>
              <Table.Cell colspan="4" class="font-bold text-right">Total ingresos</Table.Cell>
              <Table.Cell class="text-right font-bold text-primary">+{formatARS(totalIngresos)}</Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell colspan="4" class="font-bold text-right">Total egresos</Table.Cell>
              <Table.Cell class="text-right font-bold text-destructive">-{formatARS(totalEgresos)}</Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell colspan="4" class="font-bold text-right">Saldo del período</Table.Cell>
              <Table.Cell class="text-right font-bold">{formatARS(saldoPeriodo)}</Table.Cell>
            </Table.Row>
          </Table.Footer>
        </Table.Root>
      </div>

      {#if store.error}
        <Alert.Root variant="destructive">
          <AlertTriangleIcon data-icon="inline-start" />
          <Alert.Description>{store.error}</Alert.Description>
        </Alert.Root>
      {/if}
      {#if store.notice}
        <Alert.Root class="border-primary/45 bg-primary/10 text-primary">
          <Alert.Description>{store.notice}</Alert.Description>
        </Alert.Root>
      {/if}
    </div>

    <Dialog.Footer>
      <Button variant="outline" onclick={cerrar}>Cerrar</Button>
      {#if !firmado}
        <Button variant="secondary" onclick={firmar} disabled={store.busy || !periodoKey}>
          <LockIcon data-icon="inline-start" />
          Firmar período
        </Button>
        <Button onclick={guardar} disabled={store.busy || !periodoKey || cargandoPeriodo}>
          {#if store.busy}Guardando…{:else}<PlusIcon data-icon="inline-start" />Guardar{/if}
        </Button>
      {/if}
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
