<script>
  import { onMount, tick } from 'svelte'
  import { movimientosStore as store } from '../movimientos/movimientosStore.svelte'
  import { formatARS, normalize } from '$core/utils/utils'
  import { navigate } from '$core/ui/router.svelte'
  import { generarPeriodosEjercicio, proximoPeriodoACargar } from '../shared/tesoreriaCalc.js'
  import { Button } from '$lib/components/ui/button'
  import * as Table from '$lib/components/ui/table'
  import * as Alert from '$lib/components/ui/alert'
  import * as Card from '$lib/components/ui/card'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import { Badge } from '$lib/components/ui/badge'
  import * as Select from '$lib/components/ui/select'
  import ArsInput from '$lib/components/ArsInput.svelte'
  import PageScaff from '$lib/components/PageScaffold.svelte'
  import SearchInput from '$lib/components/SearchInput.svelte'
  import EmptyState from '$lib/components/EmptyState.svelte'
  import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left'
  import ConfirmarFirmaDialog from './components/ConfirmarFirmaDialog.svelte'
  import PlusIcon from '@lucide/svelte/icons/plus'
  import TrashIcon from '@lucide/svelte/icons/trash'
  import LockIcon from '@lucide/svelte/icons/lock'
  import UnlockIcon from '@lucide/svelte/icons/lock-open'
  import FileIcon from '@lucide/svelte/icons/file'
  import FileCheckIcon from '@lucide/svelte/icons/file-check'
  import ArrowLeftRightIcon from '@lucide/svelte/icons/arrow-left-right'

  // Props para modo embebido (dentro de Movimientos)
  let { embedded = false } = $props()

  // Máximo de filas por rubro (una por tipo de cuenta, hasta 3).
  const MAX_FILAS_POR_RUBRO = 3

  // Estado de la carga seleccionada
  let cargaSeleccionadaId = $state(null)
  // Filas: múltiples por rubro. Cada fila:
  // { rowId, rubro_id, nombre, codigo, tipo, grupo, importe, cuenta_id, detalle, movimientoId }
  let filas = $state([])
  let cargandoPeriodo = $state(false)
  let eliminados = $state([])
  // Diálogo de confirmación de firma.
  let confirmarFirma = $state(false)
  let firmando = $state(false)
  // RowId de la fila recién agregada (para hacer foco después del render).
  let focusRowId = $state(null)
  // Diálogo para crear nueva carga
  let showNuevaCarga = $state(false)
  let nuevaCargaPeriodo = $state('')
  // Diálogo para reabrir período
  let showReabrir = $state(false)
  let reabrirPeriodoKey = $state('')
  let reabrirMotivo = $state('')
  // Ejercicio seleccionado (default: en curso)
  let ejercicioSel = $state('')

  /** Genera un ID único para cada fila */
  const newRowId = () => `r${crypto.randomUUID()}`

  /** Transforma las filas con importe > 0 al formato que espera guardarCargaPIA */
  const prepararFilasParaGuardar = () =>
    filas
      .filter((f) => Number(f.importe) > 0)
      .map((f) => ({
        rubro_id: Number(f.rubro_id),
        importe: Number(f.importe),
        cuenta_id: Number(f.cuenta_id),
        detalle: f.detalle || '',
        movimientoId: f.movimientoId || null,
      }))

  // Períodos del ejercicio para el selector de nueva carga.
  let periodosEjercicio = $derived(generarPeriodosEjercicio(store.ejercicio))

  // Ejercicios ordenados por año descendente (para el selector del header).
  let ejerciciosOptions = $derived(
    store.ejercicios
      .slice()
      .sort((a, b) => Number(b.anio_inicio || 0) - Number(a.anio_inicio || 0))
      .map((e) => ({
        value: String(e.id),
        label: `${e.anio_inicio || '?'}-${e.anio_fin || '?'}${e.en_curso ? ' (en curso)' : ''}`,
      }))
  )

  // Label del ejercicio seleccionado (para mostrar en el trigger).
  let ejercicioSelLabel = $derived(
    ejerciciosOptions.find((o) => o.value === ejercicioSel)?.label || 'Ejercicio'
  )

  // Cuando cambia el ejercicio seleccionado, actualizar el store, recargar
  // cargas y seleccionar automáticamente el primer período del nuevo ejercicio.
  let cargasCargadas = $state(0) // contador para detectar cuando loadCargas terminó
  $effect(() => {
    if (!ejercicioSel) return
    const ejId = Number(ejercicioSel)
    if (store.ejercicio && Number(store.ejercicio.id) === ejId) return
    // Limpiar la carga seleccionada (pertenece al ejercicio anterior)
    cargaSeleccionadaId = null
    store.setEjercicio(ejId)
    store.loadCargas().then(() => {
      // Seleccionar automáticamente el primer período abierto
      const primerAbierto = periodosAgrupados.find((g) => g.abierta)
      if (primerAbierto) {
        seleccionarPeriodo(primerAbierto)
      } else if (periodosAgrupados.length > 0) {
        seleccionarPeriodo(periodosAgrupados[0])
      }
      cargasCargadas++
    })
  })

  // Cargas del ejercicio.
  let cargas = $derived(store.cargas.slice())

  // Agrupar cargas por período, ordenadas descendente.
  // Cada grupo: { periodo, cargas[], firmado, abierta }
  let periodosAgrupados = $derived.by(() => {
    const byPeriodo = new Map()
    for (const c of cargas) {
      const p = String(c.periodo || '')
      if (!p) continue
      if (!byPeriodo.has(p)) byPeriodo.set(p, [])
      byPeriodo.get(p).push(c)
    }
    return [...byPeriodo.entries()]
      .map(([periodo, cargasP]) => ({
        periodo,
        cargas: cargasP.sort((a, b) => Number(b.id) - Number(a.id)),
        firmado: cargasP.every((c) => c.estado === 'firmado'),
        abierta: cargasP.some((c) => c.estado !== 'firmado'),
      }))
      .sort((a, b) => String(b.periodo).localeCompare(String(a.periodo)))
  })

  // Períodos que ya tienen al menos una carga.
  let periodosConCarga = $derived(new Set(cargas.map((c) => String(c.periodo || ''))))

  // Períodos firmados (no se pueden agregar cargas).
  let periodosFirmadosSet = $derived(
    new Set(periodosAgrupados.filter((g) => g.firmado).map((g) => g.periodo))
  )

  // Períodos disponibles para nueva carga: todos los del ejercicio que
  // NO estén firmados (pueden no tener cargas o tener cargas en borrador).
  let periodosDisponibles = $derived(
    periodosEjercicio
      .filter((p) => !periodosFirmadosSet.has(p))
      .map((p) => ({
        value: p,
        label: periodosConCarga.has(p) ? `${p} (ya tiene cargas)` : p,
      }))
  )

  // La carga seleccionada (objeto completo).
  let cargaActual = $derived(
    cargaSeleccionadaId ? store.getCarga(Number(cargaSeleccionadaId)) : null
  )

  // El período de la carga seleccionada.
  const periodoKey = $derived(cargaActual?.periodo || '')

  // El período está firmado si todas sus cargas lo están.
  let periodoFirmado = $derived(
    periodoKey ? store.periodoFirmado(periodoKey) : false
  )

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

  /** Construye las filas de la matriz desde los rubros PIA + movimientos existentes */
  const construirFilasDesdeRubros = (rubros, existentes, cuentaDefault) =>
    [...rubros]
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
            rowId: newRowId(),
            importe: String(m.importe || ''),
            cuenta_id: m.cuenta_id ? String(m.cuenta_id) : cuentaDefault,
            detalle: m.detalle || '',
            movimientoId: m.id,
          }))
        }
        return [{
          ...base,
          rowId: newRowId(),
          importe: '',
          cuenta_id: cuentaDefault,
          detalle: '',
          movimientoId: null,
        }]
      })

  // Totales calculados.
  let totalIngresos = $derived(filas.reduce((s, f) => f.tipo === 'Entrada' ? s + (Number(f.importe) || 0) : s, 0))
  let totalEgresos = $derived(filas.reduce((s, f) => f.tipo === 'Salida' ? s + (Number(f.importe) || 0) : s, 0))
  let saldoPeriodo = $derived(totalIngresos - totalEgresos)

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
   * Reconstruye las filas con los rubros PIA y precarga los importes
   * desde los movimientos existentes de la carga seleccionada.
   */
  const cargarFilas = async () => {
    if (!cargaSeleccionadaId) { filas = []; return }
    cargandoPeriodo = true
    try {
      const cuentaDefault = String(store.cuentaDefaultId || store.cuentas[0]?.id || '')
      const existentes = await store.getMovimientosPorRubro(Number(cargaSeleccionadaId))
      eliminados = []
      filas = construirFilasDesdeRubros(store.rubros, existentes, cuentaDefault)
    } catch (e) {
      console.error('[CargaPIAMatrix] Error al precargar filas:', e)
    } finally {
      cargandoPeriodo = false
    }
  }

  // Cuando cambia la carga seleccionada, recargar las filas.
  let lastCargaId = null
  $effect(() => {
    const cid = cargaSeleccionadaId
    if (!cid || cid === lastCargaId) return
    lastCargaId = cid
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

  const volver = () => {
    if (embedded) return
    navigate('resumen')
  }

  /**
   * Selecciona la última carga en borrador de un período (o la única si hay una).
   * Si todas están firmadas, selecciona la última.
   */
  const seleccionarPeriodo = (periodoGrupo) => {
    const abierta = periodoGrupo.cargas.find((c) => c.estado !== 'firmado')
    const carga = abierta || periodoGrupo.cargas[0]
    if (carga) cargaSeleccionadaId = carga.id
  }

  /**
   * Crea una nueva carga para el período seleccionado.
   */
  const crearNuevaCarga = async () => {
    if (!nuevaCargaPeriodo) return
    const nueva = await store.crearCarga(nuevaCargaPeriodo)
    if (nueva) {
      showNuevaCarga = false
      nuevaCargaPeriodo = ''
      cargaSeleccionadaId = nueva.id
    }
  }

  /**
   * Abre el diálogo para crear una nueva carga, sugiriendo el próximo período pendiente.
   */
  const abrirNuevaCarga = () => {
    const periodosConDatos = new Set(cargas.map((c) => String(c.periodo || '')))
    const proximo = proximoPeriodoACargar(store.ejercicio, periodosConDatos)
    nuevaCargaPeriodo = proximo
    showNuevaCarga = true
  }

  /**
   * Agrega una nueva fila vacía para un rubro, con la primera cuenta disponible.
   */
  const agregarFila = (rubroFila) => {
    const rid = Number(rubroFila.rubro_id)
    const filasRubro = filas.filter((f) => Number(f.rubro_id) === rid)
    if (filasRubro.length >= MAX_FILAS_POR_RUBRO) return
    const usadas = new Set(filasRubro.map((f) => String(f.cuenta_id)).filter(Boolean))
    const disponible = store.cuentas.find((c) => !usadas.has(String(c.id)))
    const newId = newRowId()
    filas = [...filas, {
      rowId: newId,
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
    focusRowId = newId
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
    if (!cargaSeleccionadaId) return
    const ok = await store.guardarCargaPIA({
      cargaId: Number(cargaSeleccionadaId),
      fecha: periodoKey + '-01',
      filas: prepararFilasParaGuardar(),
      eliminados,
    })
    if (ok) {
      await cargarFilas()
    }
  }

  // --- Acciones a nivel período ---

  const firmar = () => {
    if (!periodoKey) return
    confirmarFirma = true
  }

  const confirmarYFirmar = async () => {
    if (!periodoKey) return
    firmando = true
    try {
      // Guardar cambios pendientes de la carga actual
      const validas = prepararFilasParaGuardar()
      if (validas.length > 0 || eliminados.length > 0) {
        await store.guardarCargaPIA({
          cargaId: Number(cargaSeleccionadaId),
          fecha: periodoKey + '-01',
          filas: validas,
          eliminados,
        })
      }
      // Cerrar el período (firma todas las cargas + crea cierre_mensuales)
      const ok = await store.cerrarPeriodo(periodoKey)
      if (ok) {
        confirmarFirma = false
        await store.loadCargas()
        await cargarFilas()
      }
    } finally {
      firmando = false
    }
  }

  const abrirReabrir = (pk) => {
    reabrirPeriodoKey = pk
    reabrirMotivo = ''
    showReabrir = true
  }

  const confirmarReabrir = async () => {
    if (!reabrirPeriodoKey) return
    const ok = await store.reabrirPeriodo(reabrirPeriodoKey, reabrirMotivo)
    if (ok) {
      showReabrir = false
      reabrirPeriodoKey = ''
      reabrirMotivo = ''
      await store.loadCargas()
      // Si el período reabierto tiene cargas, seleccionar la última
      const grupo = periodosAgrupados.find((g) => g.periodo === periodoKey)
      if (grupo) seleccionarPeriodo(grupo)
    }
  }

  /**
   * Elimina una carga individual después de confirmación.
   * Solo permitido si el período no está firmado.
   */
  const eliminarCarga = async (cargaId) => {
    if (!confirm('¿Eliminar esta carga y todos sus movimientos? Esta acción no se puede deshacer.')) return
    const ok = await store.eliminarCarga(Number(cargaId))
    if (ok) {
      if (Number(cargaSeleccionadaId) === Number(cargaId)) {
        cargaSeleccionadaId = null
      }
    }
  }

  // Cargas del período seleccionado (para mostrar sub-lista si hay múltiples).
  let cargasDelPeriodo = $derived(
    periodoKey ? cargas.filter((c) => String(c.periodo) === periodoKey) : []
  )

  onMount(async () => {
    if (!embedded) {
      const unsub = store.subscribe()
      await store.loadAll()
      await store.loadCargas()
      // Setear ejercicio por defecto (en curso)
      if (store.ejercicio?.id) {
        ejercicioSel = String(store.ejercicio.id)
      }
      // Seleccionar automáticamente el primer período abierto
      const primerAbierto = periodosAgrupados.find((g) => g.abierta)
      if (primerAbierto) {
        seleccionarPeriodo(primerAbierto)
      } else if (periodosAgrupados.length > 0) {
        seleccionarPeriodo(periodosAgrupados[0])
      }
      return unsub
    }
    // Embebido: el padre ya cargó los datos. Solo cargar cargas.
    await store.loadCargas()
    if (store.ejercicio?.id) {
      ejercicioSel = String(store.ejercicio.id)
    }
    const primerAbierto = periodosAgrupados.find((g) => g.abierta)
    if (primerAbierto) {
      seleccionarPeriodo(primerAbierto)
    } else if (periodosAgrupados.length > 0) {
      seleccionarPeriodo(periodosAgrupados[0])
    }
  })
</script>

{#snippet tipoBadge(tipo)}
  {#if tipo === 'Entrada'}
    <Badge variant="outline" class="text-xs text-primary border-primary/30">Entrada</Badge>
  {:else}
    <Badge variant="outline" class="text-xs text-destructive border-destructive/30">Salida</Badge>
  {/if}
{/snippet}

{#snippet totalesFooter(colspan)}
  <Table.Footer>
    <Table.Row>
      <Table.Cell colspan={colspan} class="font-bold text-right text-sm">Total ingresos</Table.Cell>
      <Table.Cell class="text-right font-bold text-primary">+{formatARS(totalIngresos)}</Table.Cell>
    </Table.Row>
    <Table.Row>
      <Table.Cell colspan={colspan} class="font-bold text-right text-sm">Total egresos</Table.Cell>
      <Table.Cell class="text-right font-bold text-destructive">-{formatARS(totalEgresos)}</Table.Cell>
    </Table.Row>
    <Table.Row>
      <Table.Cell colspan={colspan} class="font-bold text-right text-sm">Saldo del período</Table.Cell>
      <Table.Cell class="text-right font-bold">{formatARS(saldoPeriodo)}</Table.Cell>
    </Table.Row>
  </Table.Footer>
{/snippet}

{#snippet innerContent()}
  {#if !embedded}
    <div class="flex items-center gap-3 mb-4">
      <Button variant="outline" size="icon" onclick={volver} title="Volver al resumen">
        <ArrowLeftIcon class="size-4" />
      </Button>
      <h1 class="text-lg font-bold">Carga por rubro</h1>
    </div>
  {/if}

  <!-- Header tipo FilterBar: selector de ejercicio + botón Nueva + contador -->
  <div class="mb-4 flex flex-wrap items-end gap-3">
    <div class="flex flex-col gap-1">
      <Label class="text-xs font-bold text-muted-foreground" for="carga_ej">Ejercicio</Label>
      <Select.Root type="single" bind:value={ejercicioSel} allowDeselect={false}>
        <Select.Trigger id="carga_ej" class="w-[180px]" aria-label="Filtrar por ejercicio">
          <Select.Value placeholder="Ejercicio">
            {ejercicioSelLabel}
          </Select.Value>
        </Select.Trigger>
        <Select.Content>
          {#each ejerciciosOptions as opt}
            <Select.Item value={opt.value}>{opt.label}</Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>
    </div>
    <Button onclick={abrirNuevaCarga} disabled={periodosDisponibles.length === 0}>
      <PlusIcon data-icon="inline-start" />
      Nueva carga
    </Button>
    <span class="text-sm text-muted-foreground">{periodosAgrupados.length} períodos</span>
  </div>

  <!-- Grid lista + panel derecho (igual que Comunidad) -->
  <div class="grid gap-4 items-start" style="grid-template-columns: {periodosAgrupados.length > 0 ? 'minmax(280px, 380px) 1fr' : '1fr'}">
    {#if periodosAgrupados.length > 0}
      <!-- Lista de períodos (estilo RecordList) -->
      <div class="relative min-h-0 self-stretch min-h-[75vh]">
        <div class="absolute inset-0 overflow-y-auto rounded-lg border border-border bg-card">
          {#each periodosAgrupados as pg (pg.periodo)}
            <button
              class="w-full border-b border-border px-4 py-3 text-left transition-colors hover:bg-accent {periodoKey === pg.periodo ? 'bg-primary/10' : ''}"
              onclick={() => seleccionarPeriodo(pg)}
              aria-pressed={periodoKey === pg.periodo}
            >
              <div class="flex items-center justify-between gap-2">
                <span class="font-semibold text-sm font-mono">{pg.periodo}</span>
                {#if pg.firmado}
                  <Badge variant="destructive" class="text-[10px] py-0 px-1.5 gap-0.5">
                    <LockIcon class="size-2.5" />
                    Firmado
                  </Badge>
                {:else}
                  <Badge variant="secondary" class="text-[10px] py-0 px-1.5">Abierto</Badge>
                {/if}
              </div>
              <div class="text-xs text-muted-foreground mt-0.5">
                {#if pg.firmado}
                  <FileCheckIcon class="size-3.5 inline mr-1" />
                {:else}
                  <FileIcon class="size-3.5 inline mr-1" />
                {/if}
                {pg.cargas.length} carga{pg.cargas.length > 1 ? 's' : ''}
                {#if pg.firmado}
                  <span class="ml-2 text-primary hover:underline" onclick={(e) => { e.stopPropagation(); abrirReabrir(pg.periodo) }}>· Reabrir</span>
                {/if}
              </div>
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Panel derecho: matriz de la carga seleccionada -->
    <div>
      {#if cargaSeleccionadaId}
        <!-- Header del período seleccionado -->
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div class="flex items-center gap-2">
            <h2 class="text-base font-bold">{periodoKey}</h2>
            {#if periodoFirmado}
              <Badge variant="destructive" class="gap-0.5">
                <LockIcon class="size-3" />
                Firmado — no editable
              </Badge>
            {:else}
              <Badge variant="secondary">Abierto</Badge>
            {/if}
          </div>
          {#if cargasDelPeriodo.length > 1}
            <div class="flex items-center gap-1.5">
              <Label class="text-xs text-muted-foreground">Carga:</Label>
              <select
                value={cargaSeleccionadaId}
                onchange={(e) => cargaSeleccionadaId = e.target.value}
                class="flex h-8 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {#each cargasDelPeriodo as c (c.id)}
                  <option value={c.id}>
                    #{c.id}{c.estado === 'firmado' ? ' (firmada)' : ' (borrador)'}
                  </option>
                {/each}
              </select>
              {#if !periodoFirmado}
                <Button
                  variant="ghost"
                  size="icon"
                  class="size-7 text-destructive hover:text-destructive"
                  onclick={() => eliminarCarga(cargaSeleccionadaId)}
                  aria-label="Eliminar carga"
                  title="Eliminar esta carga"
                >
                  <TrashIcon class="size-3.5" />
                </Button>
              {/if}
            </div>
          {/if}
        </div>

        {#if periodoFirmado}
          <Alert.Root class="mb-4">
            <LockIcon data-icon="inline-start" />
            <Alert.Title>Período firmado</Alert.Title>
            <Alert.Description>
              Este período está firmado y cerrado. Los movimientos no pueden modificarse.
              Para editar, reabrí el período desde la lista de la izquierda.
            </Alert.Description>
          </Alert.Root>
        {/if}

        <!-- Matriz por grupo -->
        <div class="border rounded-lg overflow-hidden">
          <Table.Root>
            <Table.Header>
              <Table.Row>
                <Table.Head class="w-16">Código</Table.Head>
                <Table.Head>Rubro</Table.Head>
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
                            {@render tipoBadge(f.tipo)}
                          </div>
                        </Table.Cell>
                      {:else}
                        <Table.Cell></Table.Cell>
                        <Table.Cell class="text-xs text-muted-foreground pl-8">↳ otra cuenta</Table.Cell>
                      {/if}
                      <Table.Cell data-focus-row={f.rowId}>
                        <select
                          bind:value={f.cuenta_id}
                          disabled={periodoFirmado}
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
                          disabled={periodoFirmado}
                          class="h-8 text-xs"
                        />
                      </Table.Cell>
                      <Table.Cell class="text-right">
                        <ArsInput
                          bind:value={f.importe}
                          disabled={periodoFirmado}
                          class="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-right text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                        />
                      </Table.Cell>
                      <Table.Cell class="text-center">
                        <div class="flex items-center justify-center gap-0.5">
                          {#if i === r.filas.length - 1 && !periodoFirmado}
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
                          {#if !periodoFirmado}
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
            {@render totalesFooter(5)}
          </Table.Root>
        </div>

        <!-- Footer con acciones -->
        <div class="flex flex-wrap items-center justify-end gap-2 mt-2">
          {#if !embedded}
            <Button variant="outline" onclick={volver}>Volver al resumen</Button>
          {/if}
          {#if !periodoFirmado}
            <Button variant="secondary" onclick={firmar} disabled={store.busy || !cargaSeleccionadaId}>
              <LockIcon data-icon="inline-start" />
              Firmar y cerrar período
            </Button>
            <Button onclick={guardar} disabled={store.busy || !cargaSeleccionadaId || cargandoPeriodo}>
              {#if store.busy}Guardando…{:else}<PlusIcon data-icon="inline-start" />Guardar{/if}
            </Button>
          {/if}
        </div>
      {:else if periodosAgrupados.length === 0}
        <EmptyState
          title="Listo para cargar"
          sub="Creá la primera carga del ejercicio para empezar."
          actionLabel="Nueva carga"
          onaction={abrirNuevaCarga}
        >
          {#snippet actionIcon()}
            <PlusIcon data-icon="inline-start" />
          {/snippet}
        </EmptyState>
      {:else}
        <div class="flex flex-col items-center gap-2 py-12 text-center">
          <ArrowLeftRightIcon class="size-8 text-muted-foreground" />
          <p class="text-sm text-muted-foreground">Seleccioná un período de la lista o creá una nueva carga.</p>
        </div>
      {/if}
    </div>
  </div>
{/snippet}

{#if embedded}
  {@render innerContent()}
{:else}
  <PageScaff title="Carga por rubro" loading={cargandoPeriodo && filas.length === 0} error={store.error} notice={store.notice}>
    {@render innerContent()}
  </PageScaff>
{/if}

{#if showNuevaCarga}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true">
    <div class="bg-background rounded-lg border border-border shadow-lg p-6 max-w-sm w-full mx-4">
      <h3 class="text-base font-bold mb-4">Nueva carga</h3>
      <div class="flex flex-col gap-3">
        <div class="flex flex-col gap-1.5">
          <Label for="nueva-carga-periodo" class="text-sm">Período</Label>
          <select
            id="nueva-carga-periodo"
            bind:value={nuevaCargaPeriodo}
            class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {#each periodosDisponibles as opt}
              <option value={opt.value}>{opt.label}</option>
            {/each}
          </select>
        </div>
        <div class="flex justify-end gap-2 mt-2">
          <Button variant="outline" size="sm" onclick={() => { showNuevaCarga = false; nuevaCargaPeriodo = '' }}>
            Cancelar
          </Button>
          <Button size="sm" onclick={crearNuevaCarga} disabled={!nuevaCargaPeriodo}>
            <PlusIcon data-icon="inline-start" />
            Crear
          </Button>
        </div>
      </div>
    </div>
  </div>
{/if}

{#if showReabrir}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true">
    <div class="bg-background rounded-lg border border-border shadow-lg p-6 max-w-sm w-full mx-4">
      <h3 class="text-base font-bold mb-4">Reabrir período {reabrirPeriodoKey}</h3>
      <div class="flex flex-col gap-3">
        <div class="flex flex-col gap-1.5">
          <Label for="reabrir-motivo" class="text-sm">Motivo de reapertura</Label>
          <Input id="reabrir-motivo" bind:value={reabrirMotivo} placeholder="Ej: corrección de importes" />
        </div>
        <div class="flex justify-end gap-2 mt-2">
          <Button variant="outline" size="sm" onclick={() => { showReabrir = false; reabrirPeriodoKey = ''; reabrirMotivo = '' }}>
            Cancelar
          </Button>
          <Button size="sm" onclick={confirmarReabrir} disabled={!reabrirMotivo.trim()}>
            <UnlockIcon data-icon="inline-start" />
            Reabrir
          </Button>
        </div>
      </div>
    </div>
  </div>
{/if}

<ConfirmarFirmaDialog
  bind:open={confirmarFirma}
  bind:firmando={firmando}
  {periodoKey}
  {filasParaConfirmar}
  {cuentaNombre}
  {totalIngresos}
  {totalEgresos}
  {saldoPeriodo}
  storeError={store.error}
  storeBusy={store.busy}
  onConfirm={confirmarYFirmar}
  onCancel={() => { confirmarFirma = false }}
/>
