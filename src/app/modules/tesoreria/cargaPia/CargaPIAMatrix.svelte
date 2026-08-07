<script>
  import { onMount, tick } from 'svelte'
  import { movimientosStore as store } from '../movimientos/movimientosStore.svelte.js'
  import { resumenStore } from '../resumen/resumenStore.svelte.js'
  import { formatARS, normalize } from '$core/utils/utils'
  import { navigate } from '$core/ui/router.svelte'
  import { generarPeriodosEjercicio, proximoPeriodoACargar } from '../shared/tesoreriaCalc.js'
  import { Button } from '$lib/components/ui/button'
  import * as Table from '$lib/components/ui/table'
  import * as Dialog from '$lib/components/ui/dialog'
  import * as Alert from '$lib/components/ui/alert'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import { Badge } from '$lib/components/ui/badge'
  import ArsInput from '$lib/components/ArsInput.svelte'
  import PageScaffold from '$lib/components/PageScaffold.svelte'
  import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left'
  import PlusIcon from '@lucide/svelte/icons/plus'
  import TrashIcon from '@lucide/svelte/icons/trash'
  import LockIcon from '@lucide/svelte/icons/lock'
  import AlertTriangleIcon from '@lucide/svelte/icons/triangle-alert'
  import CheckCircleIcon from '@lucide/svelte/icons/circle-check'

  // Máximo de filas por rubro (una por tipo de cuenta, hasta 3).
  const MAX_FILAS_POR_RUBRO = 3

  let fecha = $state('')
  // Filas: múltiples por rubro. Cada fila:
  // { rowId, rubro_id, nombre, codigo, tipo, grupo, importe, cuenta_id, detalle, movimientoId }
  let filas = $state([])
  let cargandoPeriodo = $state(false)
  let eliminados = $state([])
  let rowCounter = 0
  // Diálogo de confirmación de firma.
  let confirmarFirma = $state(false)
  let firmando = $state(false)
  // RowId de la fila recién agregada (para hacer foco después del render).
  let focusRowId = $state(null)

  // Períodos del ejercicio para el selector.
  let periodosEjercicio = $derived(generarPeriodosEjercicio(store.ejercicio))

  // Filas con importe > 0 para el resumen de confirmación.
  let filasParaConfirmar = $derived(
    filas
      .filter((f) => Number(f.importe) > 0)
      .sort((a, b) => normalize(a.grupo || '').localeCompare(normalize(b.grupo || ''))
        || normalize(a.nombre || '').localeCompare(normalize(b.nombre || '')))
  )

  // Mapa de cuentas para mostrar nombre en el resumen read-only.
  let cuentaNombre = $derived.by(() => {
    const map = new Map()
    for (const c of store.cuentas) map.set(String(c.id), c.nombre_cuenta || '(sin nombre)')
    return map
  })

  // Agrupar filas por grupo → rubro → filas de ese rubro.
  let grupos = $derived.by(() => {
    const byGrupo = new Map()
    for (const f of filas) {
      const g = f.grupo || 'Otros'
      if (!byGrupo.has(g)) byGrupo.set(g, new Map())
      const byRubro = byGrupo.get(g)
      const rid = Number(f.rubro_id)
      if (!byRubro.has(rid)) byRubro.set(rid, { rubro: f, filas: [] })
      byRubro.get(rid).filas.push(f)
    }
    return [...byGrupo.entries()].map(([grupo, rubroMap]) => ({
      grupo,
      rubros: [...rubroMap.values()],
    }))
  })

  // Totales calculados.
  let totalIngresos = $derived(filas.reduce((s, f) => f.tipo === 'Entrada' ? s + (Number(f.importe) || 0) : s, 0))
  let totalEgresos = $derived(filas.reduce((s, f) => f.tipo === 'Salida' ? s + (Number(f.importe) || 0) : s, 0))
  let saldoPeriodo = $derived(totalIngresos - totalEgresos)

  const periodoKey = $derived(String(fecha || '').slice(0, 7))
  let firmado = $derived(periodoKey ? store.periodoFirmado(periodoKey) : false)

  /**
   * Cuentas disponibles para una fila: todas menos las ya usadas en otras
   * filas del mismo rubro. La cuenta actual de la fila siempre está incluida.
   */
  const cuentasDisponibles = (rubroId, currentCuentaId) => {
    const usadas = new Set(
      filas
        .filter((f) => Number(f.rubro_id) === Number(rubroId) && String(f.cuenta_id) !== String(currentCuentaId))
        .map((f) => String(f.cuenta_id))
        .filter(Boolean)
    )
    return store.cuentas.filter((c) => !usadas.has(String(c.id)))
  }

  /**
   * Calcula el período inicial al entrar a la página:
   * - Si hay período en la URL (#carga-pia/2026-01), usa ese.
   * - Si no, busca el próximo período a cargar (más viejo sin datos).
   * - Base: último PIA cargado + 1 mes, o inicio del ejercicio si no hay nada.
   */
  const calcularPeriodoInicial = () => {
    // Parsear período de la URL (#carga-pia/2026-01 → '2026-01').
    const hash = String(typeof window !== 'undefined' ? window.location.hash : '')
    const match = hash.match(/carga-pia\/(\d{4}-\d{2})/)
    if (match) return match[1]

    // Sin período en URL: calcular el próximo a cargar.
    const periodosConDatos = new Set(
      store.records
        .filter((m) => store.ejercicio && Number(m.ejercicio_id) === Number(store.ejercicio.id))
        .map((m) => String(m.periodo || ''))
        .filter(Boolean)
    )
    const proximo = proximoPeriodoACargar(store.ejercicio, periodosConDatos)
    return proximo
  }

  /**
   * Reconstruye las filas con los rubros PIA y precarga los importes
   * desde los movimientos existentes del período seleccionado.
   */
  const cargarFilas = async () => {
    if (!periodoKey) return
    cargandoPeriodo = true
    try {
      const cuentaDefault = String(store.cuentaDefaultId || store.cuentas[0]?.id || '')
      const existentes = await store.getMovimientosPorRubro(periodoKey)
      rowCounter = 0
      eliminados = []
      filas = [...store.rubros]
        .sort((a, b) => normalize(a.grupo_rubro || '').localeCompare(normalize(b.grupo_rubro || ''))
          || normalize(a.nombre_oficial || '').localeCompare(normalize(b.nombre_oficial || '')))
        .flatMap((r) => {
          const movs = existentes.get(Number(r.id)) || []
          const base = {
            rubro_id: r.id,
            nombre: r.nombre_oficial || '(sin nombre)',
            codigo: r.codigo_rubro || '',
            tipo: r.tipo_rubro || 'Entrada',
            grupo: r.grupo_rubro || 'Otros',
          }
          if (movs.length > 0) {
            return movs.map((m) => ({
              ...base,
              rowId: `r${rowCounter++}`,
              importe: String(m.importe || ''),
              cuenta_id: m.cuenta_id ? String(m.cuenta_id) : cuentaDefault,
              detalle: m.detalle || '',
              movimientoId: m.id,
            }))
          }
          return [{
            ...base,
            rowId: `r${rowCounter++}`,
            importe: '',
            cuenta_id: cuentaDefault,
            detalle: '',
            movimientoId: null,
          }]
        })
    } catch (e) {
      console.error('[CargaPIAMatrix] Error al precargar filas:', e)
    } finally {
      cargandoPeriodo = false
    }
  }

  // Cuando cambia el período (fecha), recargar las filas.
  let lastPeriodo = ''
  $effect(() => {
    const pk = periodoKey
    if (!pk || pk === lastPeriodo) return
    lastPeriodo = pk
    cargarFilas()
  })

  // Foco en el select de cuenta de la fila recién agregada.
  $effect(() => {
    if (!focusRowId) return
    tick().then(() => {
      const el = document.querySelector(`[data-focus-row="${focusRowId}"] select`)
      if (el) el.focus()
      focusRowId = null
    })
  })

  const volver = () => navigate('resumen')

  /**
   * Agrega una nueva fila vacía para un rubro, con la primera cuenta disponible.
   * Hace foco en el select de cuenta de la nueva fila después del render.
   */
  const agregarFila = (rubroFila) => {
    const rid = Number(rubroFila.rubro_id)
    const filasRubro = filas.filter((f) => Number(f.rubro_id) === rid)
    if (filasRubro.length >= MAX_FILAS_POR_RUBRO) return
    const usadas = new Set(filasRubro.map((f) => String(f.cuenta_id)).filter(Boolean))
    const disponible = store.cuentas.find((c) => !usadas.has(String(c.id)))
    const newRowId = `r${rowCounter++}`
    filas = [...filas, {
      rowId: newRowId,
      rubro_id: rubroFila.rubro_id,
      nombre: rubroFila.nombre,
      codigo: rubroFila.codigo,
      tipo: rubroFila.tipo,
      grupo: rubroFila.grupo,
      importe: '',
      cuenta_id: disponible ? String(disponible.id) : '',
      detalle: '',
      movimientoId: null,
    }]
    focusRowId = newRowId
  }

  /**
   * Elimina una fila. Si tenía movimientoId, lo registra para borrar en Grist.
   */
  const eliminarFila = (rowId) => {
    const fila = filas.find((f) => f.rowId === rowId)
    if (!fila) return
    if (fila.movimientoId) {
      eliminados = [...eliminados, fila.movimientoId]
    }
    filas = filas.filter((f) => f.rowId !== rowId)
  }

  const guardar = async () => {
    const validas = filas
      .filter((f) => Number(f.importe) > 0)
      .map((f) => ({
        rubro_id: Number(f.rubro_id),
        importe: Number(f.importe),
        cuenta_id: Number(f.cuenta_id),
        detalle: f.detalle || '',
        movimientoId: f.movimientoId || null,
      }))
    const ok = await store.guardarCargaPIA({ fecha, filas: validas, eliminados })
    if (ok) {
      await cargarFilas()
    }
  }

  const firmar = () => {
    if (!periodoKey) return
    confirmarFirma = true
  }

  const confirmarYFirmar = async () => {
    if (!periodoKey) return
    firmando = true
    try {
      const validas = filas
        .filter((f) => Number(f.importe) > 0)
        .map((f) => ({
          rubro_id: Number(f.rubro_id),
          importe: Number(f.importe),
          cuenta_id: Number(f.cuenta_id),
          detalle: f.detalle || '',
          movimientoId: f.movimientoId || null,
        }))
      if (validas.length > 0 || eliminados.length > 0) {
        await store.guardarCargaPIA({ fecha, filas: validas, eliminados })
      }
      const ok = await store.firmarPeriodo(periodoKey)
      if (ok) {
        confirmarFirma = false
        await cargarFilas()
      }
    } finally {
      firmando = false
    }
  }

  onMount(async () => {
    const unsub = store.subscribe()
    await store.loadAll()
    fecha = calcularPeriodoInicial()
    await cargarFilas()
    return unsub
  })
</script>

<PageScaffold title="Carga PIA" loading={cargandoPeriodo && filas.length === 0} error={store.error} notice={store.notice}>
  <!-- Header con botón volver -->
  <div class="flex items-center gap-3 mb-4">
    <Button variant="outline" size="icon" onclick={volver} title="Volver al resumen">
      <ArrowLeftIcon class="size-4" />
    </Button>
    <h1 class="text-lg font-bold">Carga PIA por rubro</h1>
  </div>

  <div class="flex flex-col gap-4">
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
            <Table.Head class="w-16">Código</Table.Head>
            <Table.Head>Rubro PIA</Table.Head>
            <Table.Head class="w-32">Cuenta</Table.Head>
            <Table.Head class="w-36">Detalle</Table.Head>
            <Table.Head class="w-32 text-right">Importe</Table.Head>
            <Table.Head class="w-24 text-center">Acciones</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each grupos as g (g.grupo)}
            <Table.Row class="bg-muted/50">
              <Table.Cell colspan="6" class="font-bold text-xs uppercase text-muted-foreground py-2">
                {g.grupo}
              </Table.Cell>
            </Table.Row>
            {#each g.rubros as r (r.rubro.rubro_id)}
              {#each r.filas as f, i (f.rowId)}
                <Table.Row>
                  {#if i === 0}
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
                  {:else}
                    <Table.Cell></Table.Cell>
                    <Table.Cell class="text-xs text-muted-foreground pl-8">↳ otra cuenta</Table.Cell>
                  {/if}
                  <Table.Cell data-focus-row={f.rowId}>
                    <select
                      bind:value={f.cuenta_id}
                      disabled={firmado}
                      class="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                    >
                      {#each cuentasDisponibles(f.rubro_id, f.cuenta_id) as c (c.id)}
                        <option value={String(c.id)}>{c.nombre_cuenta}</option>
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
                    <ArsInput
                      bind:value={f.importe}
                      disabled={firmado}
                      class="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-right text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                    />
                  </Table.Cell>
                  <Table.Cell class="text-center">
                    <div class="flex items-center justify-center gap-0.5">
                      {#if i === r.filas.length - 1 && !firmado}
                        <Button
                          variant="ghost"
                          size="icon"
                          class="size-7"
                          disabled={r.filas.length >= MAX_FILAS_POR_RUBRO || r.filas.length >= store.cuentas.length}
                          onclick={() => agregarFila(f)}
                          aria-label="Agregar fila"
                          title={r.filas.length >= MAX_FILAS_POR_RUBRO ? 'Máximo de filas alcanzado' : r.filas.length >= store.cuentas.length ? 'No hay más cuentas disponibles' : 'Agregar otra cuenta para este rubro'}
                        >
                          <PlusIcon class="size-4" />
                        </Button>
                      {/if}
                      {#if !firmado}
                        <Button
                          variant="ghost"
                          size="icon"
                          class="size-7 text-destructive hover:text-destructive"
                          disabled={r.filas.length <= 1 && !f.movimientoId}
                          onclick={() => eliminarFila(f.rowId)}
                          aria-label="Eliminar fila"
                          title={r.filas.length <= 1 && !f.movimientoId ? 'No se puede eliminar la única fila vacía' : 'Eliminar esta fila'}
                        >
                          <TrashIcon class="size-4" />
                        </Button>
                      {/if}
                    </div>
                  </Table.Cell>
                </Table.Row>
              {/each}
            {/each}
          {/each}
        </Table.Body>
        <Table.Footer>
          <Table.Row>
            <Table.Cell colspan="5" class="font-bold text-right">Total ingresos</Table.Cell>
            <Table.Cell class="text-right font-bold text-primary">+{formatARS(totalIngresos)}</Table.Cell>
          </Table.Row>
          <Table.Row>
            <Table.Cell colspan="5" class="font-bold text-right">Total egresos</Table.Cell>
            <Table.Cell class="text-right font-bold text-destructive">-{formatARS(totalEgresos)}</Table.Cell>
          </Table.Row>
          <Table.Row>
            <Table.Cell colspan="5" class="font-bold text-right">Saldo del período</Table.Cell>
            <Table.Cell class="text-right font-bold">{formatARS(saldoPeriodo)}</Table.Cell>
          </Table.Row>
        </Table.Footer>
      </Table.Root>
    </div>

    </div>

    <!-- Footer con acciones -->
  <div class="flex flex-wrap items-center justify-end gap-2 mt-4">
    <Button variant="outline" onclick={volver}>Volver al resumen</Button>
    {#if !firmado}
      <Button variant="secondary" onclick={firmar} disabled={store.busy || !periodoKey}>
        <LockIcon data-icon="inline-start" />
        Firmar y cerrar
      </Button>
      <Button onclick={guardar} disabled={store.busy || !periodoKey || cargandoPeriodo}>
        {#if store.busy}Guardando…{:else}<PlusIcon data-icon="inline-start" />Guardar{/if}
      </Button>
    {/if}
  </div>
</PageScaffold>

<!-- Diálogo de confirmación de firma: resumen read-only de movimientos -->
<Dialog.Root bind:open={confirmarFirma}>
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
        <div class="border rounded-lg overflow-hidden">
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
                      {#if f.tipo === 'Entrada'}
                        <Badge variant="outline" class="text-xs text-primary border-primary/30">Entrada</Badge>
                      {:else}
                        <Badge variant="outline" class="text-xs text-destructive border-destructive/30">Salida</Badge>
                      {/if}
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

      {#if store.error}
        <Alert.Root variant="destructive">
          <AlertTriangleIcon data-icon="inline-start" />
          <Alert.Description>{store.error}</Alert.Description>
        </Alert.Root>
      {/if}
    </div>

    <Dialog.Footer>
      <Button variant="outline" onclick={() => { confirmarFirma = false }} disabled={firmando}>
        Cancelar
      </Button>
      <Button variant="secondary" onclick={confirmarYFirmar} disabled={firmando || store.busy}>
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
