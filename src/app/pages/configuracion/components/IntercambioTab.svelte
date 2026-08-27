<script>
  import * as Card from '$lib/components/ui/card'
  import { Button } from '$lib/components/ui/button'
  import { Badge } from '$lib/components/ui/badge'
  import { Separator } from '$lib/components/ui/separator'
  import { Checkbox } from '$lib/components/ui/checkbox'
  import * as Select from '$lib/components/ui/select'
  import { Alert, AlertDescription } from '$lib/components/ui/alert'
  import DownloadIcon from '@lucide/svelte/icons/download'
  import UploadIcon from '@lucide/svelte/icons/upload'
  import ArrowLeftRightIcon from '@lucide/svelte/icons/arrow-left-right'
  import CheckCircleIcon from '@lucide/svelte/icons/circle-check'
  import AlertCircleIcon from '@lucide/svelte/icons/circle-alert'
  import FileUpIcon from '@lucide/svelte/icons/file-up'
  import ShareIcon from '@lucide/svelte/icons/share'
  import {
    exportParcial,
    importWorkingSet,
    analizarMerge,
    aplicarMerge,
    validarIntercambio,
    limpiarDispositivo,
  } from '$core/data/intercambio.js'
  import { exportBackup } from '$core/data/backup.js'
  import { getActiveBackend } from '$core/data/dataRepository'
  import { loadConfig } from '$app/pages/cooperadora/cooperadoraApi.js'
  import { notify } from '$core/ui/notify.svelte'
  import { trackEvent } from '$core/analytics/plausible.js'
  import TrashIcon from '@lucide/svelte/icons/trash-2'
  import HandHeartIcon from '@lucide/svelte/icons/hand-heart'

  const isPouchMode = getActiveBackend() === 'pouch'

  // --- Modo colaborador ---
  let config = $state(null)
  let isColaborador = $derived(config?.modo_colaborador === true)
  let cleaning = $state(false)
  let showCleanupConfirm = $state(false)
  let patchExported = $state(false)

  async function loadConfigData() {
    try { config = await loadConfig() } catch { /* ignore */ }
  }
  loadConfigData()

  const handleExportPatchYLimpiar = async () => {
    cleaning = true
    try {
      const profile = config?.modulo_carga_consolidada ? 'patch_consolidada' : 'patch_integral'
      const res = await exportParcial(profile)
      patchExported = true
      notify.success(`Patch exportado: ${res.filename} (${res.docCount} documentos)`)
      trackEvent('colaborador_patch_exported', { profile, doc_count: res.docCount })
    } catch (e) {
      notify.error(e?.message || 'Error al exportar patch')
      patchExported = false
    } finally {
      cleaning = false
    }
  }

  const handleLimpiarDispositivo = async () => {
    cleaning = true
    try {
      await limpiarDispositivo()
      // limpiarDispositivo recarga la página, no llegamos acá
    } catch (e) {
      notify.error(e?.message || 'Error al limpiar dispositivo')
      cleaning = false
    }
  }

  // --- Export ---
  let exportProfile = $state('working_set')
  let exporting = $state(false)
  let exportResult = $state(null)

  const PROFILE_LABELS = {
    working_set: 'Set de trabajo (para colaborador)',
    patch_movimientos: 'Solo movimientos nuevos (patch)',
    full: 'Backup completo',
  }

  const handleExport = async () => {
    if (exportProfile === 'full') {
      // Delegar al backup existente
      exporting = true
      exportResult = null
      try {
        const res = await exportBackup()
        exportResult = res
        trackEvent('backup_exported', { backend: 'pouch', profile: 'full', doc_count: res.docCount })
      } catch (e) {
        notify.error(e?.message || 'Error al exportar')
      } finally {
        exporting = false
      }
      return
    }

    exporting = true
    exportResult = null
    try {
      const res = await exportParcial(exportProfile)
      exportResult = res
      trackEvent('intercambio_exported', { backend: 'pouch', profile: exportProfile, doc_count: res.docCount })
      notify.success(`Exportado: ${res.filename} (${res.docCount} documentos)`)
    } catch (e) {
      notify.error(e?.message || 'Error al exportar')
    } finally {
      exporting = false
    }
  }

  // --- Import working set ---
  let wsFileInput = $state(null)
  let importingWs = $state(false)

  const handleWsImport = async (/** @type {Event} */ e) => {
    const input = /** @type {HTMLInputElement} */ (e.target)
    const file = input.files?.[0]
    if (!file) return
    importingWs = true
    const id = notify.loading('Importando set de trabajo…')
    try {
      const res = await importWorkingSet(file)
      notify.dismiss(id)
      trackEvent('intercambio_ws_imported', { backend: 'pouch', inserted: res.inserted, skipped: res.skipped })
      notify.success(`Set importado: ${res.inserted} documentos insertados, ${res.skipped} ya existían.`)
    } catch (e) {
      notify.dismiss(id)
      notify.error(e?.message || 'Error al importar set de trabajo')
    } finally {
      importingWs = false
      input.value = ''
    }
  }

  // --- Merge import (con análisis previo) ---
  let mergeFileInput = $state(null)
  let mergeFile = $state(null)
  let mergeAnalysis = $state(null)
  let analyzing = $state(false)
  let applying = $state(false)
  let mergeResult = $state(null)
  let doBackupBefore = $state(true)
  let showMovimientos = $state(false)
  let showPersonas = $state(false)

  const handleMergeFileSelect = async (/** @type {Event} */ e) => {
    const input = /** @type {HTMLInputElement} */ (e.target)
    const file = input.files?.[0]
    if (!file) return
    mergeFile = file
    mergeAnalysis = null
    mergeResult = null
    analyzing = true
    try {
      const report = await analizarMerge(file)
      mergeAnalysis = report
      trackEvent('intercambio_merge_analyzed', { backend: 'pouch', conflictos: report.resumen.conflictos })
    } catch (e) {
      notify.error(e?.message || 'Error al analizar el patch')
      mergeFile = null
    } finally {
      analyzing = false
      input.value = ''
    }
  }

  const canApply = $derived(
    mergeAnalysis != null &&
    mergeAnalysis.resumen.conflictos === 0 &&
    mergeAnalysis.detalle.movimientos.length > 0 &&
    !applying
  )

  const handleApplyMerge = async () => {
    if (!mergeFile || !mergeAnalysis) return
    applying = true
    mergeResult = null

    // Backup opcional antes del merge
    if (doBackupBefore) {
      try {
        await exportBackup()
        notify.info('Backup exportado antes del merge.')
      } catch (e) {
        notify.error('No se pudo exportar el backup previo. Merge cancelado por seguridad.')
        applying = false
        return
      }
    }

    const id = notify.loading('Aplicando merge…')
    try {
      const res = await aplicarMerge(mergeFile, mergeAnalysis.analisisHash)
      notify.dismiss(id)
      mergeResult = res
      trackEvent('intercambio_merge_applied', {
        backend: 'pouch',
        movimientos: res.added.movimientos,
        personas: res.added.personas,
        dedup: res.deduped.personas,
      })
      notify.success(
        `Merge completado: ${res.added.movimientos} movimiento(s), ${res.added.personas} persona(s) nueva(s), ${res.deduped.personas} deduplicada(s).`
      )
      // Limpiar estado
      mergeFile = null
      mergeAnalysis = null
    } catch (e) {
      notify.dismiss(id)
      notify.error(e?.message || 'Error al aplicar el merge')
    } finally {
      applying = false
    }
  }

  const handleCancelMerge = () => {
    mergeFile = null
    mergeAnalysis = null
    mergeResult = null
  }

  // --- Validar archivo al seleccionar ---
  const handleValidate = async (file) => {
    const res = await validarIntercambio(file)
    if (!res.valid) {
      notify.error(`Archivo inválido: ${res.error}`)
      return false
    }
    return true
  }
</script>

{#if !isPouchMode}
  <Alert variant="destructive">
    <AlertCircleIcon data-icon="inline-start" />
    <AlertDescription>
      El intercambio descentralizado solo está disponible en modo standalone (PouchDB).
      En modo Grist, la app vive dentro del documento y no puede abrirse en otro dispositivo.
    </AlertDescription>
  </Alert>
{:else}
  <div class="flex flex-col gap-6">
    <!-- Exportar -->
    <Card.Root>
      <Card.Header>
        <Card.Title class="flex items-center gap-2">
          <ShareIcon class="size-5" />
          Exportar
        </Card.Title>
        <Card.Description>
          Exportá un subset de datos para enviar a un colaborador o para traer de vuelta los cambios.
        </Card.Description>
      </Card.Header>
      <Card.Content class="flex flex-col gap-4">
        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium" for="export-profile">Perfil de exportación</label>
          <Select.Root type="single" bind:value={exportProfile}>
            <Select.Trigger id="export-profile" class="w-full">
              {PROFILE_LABELS[exportProfile] ?? 'Seleccionar…'}
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="working_set" label="Set de trabajo (para colaborador)">
                Set de trabajo (para colaborador)
              </Select.Item>
              <Select.Item value="patch_movimientos" label="Solo movimientos nuevos (patch)">
                Solo movimientos nuevos (patch)
              </Select.Item>
              <Select.Item value="full" label="Backup completo">Backup completo</Select.Item>
            </Select.Content>
          </Select.Root>
        </div>

        {#if exportProfile === 'working_set'}
          <Alert>
            <CheckCircleIcon data-icon="inline-start" />
            <AlertDescription>
              Incluye personas (datos reducidos: sin domicilio, teléfono ni email), socios,
              cuentas, rubros, subrubros, ejercicios y configuración. Un colaborador puede
              usarlo para cargar movimientos desde su dispositivo.
            </AlertDescription>
          </Alert>
        {:else if exportProfile === 'patch_movimientos'}
          <Alert>
            <CheckCircleIcon data-icon="inline-start" />
            <AlertDescription>
              Exporta solo los movimientos, personas y socios que creaste localmente
              (excluye lo que recibiste de un set de trabajo). Pensado para devolver a la
              cooperadora y que haga merge.
            </AlertDescription>
          </Alert>
        {/if}

        <Button onclick={handleExport} disabled={exporting} class="w-fit">
          {#if exporting}
            <CheckCircleIcon data-icon="inline-start" class="animate-spin" />
            Exportando…
          {:else}
            <DownloadIcon data-icon="inline-start" />
            Exportar .lof
          {/if}
        </Button>

        {#if exportResult}
          <p class="text-sm text-muted-foreground">
            {exportResult.filename} — {exportResult.docCount} documentos
          </p>
        {/if}
      </Card.Content>
    </Card.Root>

    <Separator />

    <!-- Importar set de trabajo (colaborador) -->
    <Card.Root>
      <Card.Header>
        <Card.Title class="flex items-center gap-2">
          <FileUpIcon class="size-5" />
          Importar set de trabajo
        </Card.Title>
        <Card.Description>
          Para colaboradores: importá el set de trabajo que te envió la cooperadora y empezá
          a cargar movimientos desde tu dispositivo.
        </Card.Description>
      </Card.Header>
      <Card.Content class="flex flex-col gap-4">
        <input
          bind:this={wsFileInput}
          type="file"
          accept=".lof"
          class="hidden"
          onchange={handleWsImport}
        />
        <Button
          variant="outline"
          onclick={() => wsFileInput?.click()}
          disabled={importingWs}
          class="w-fit"
        >
          {#if importingWs}
            <CheckCircleIcon data-icon="inline-start" class="animate-spin" />
            Importando…
          {:else}
            <UploadIcon data-icon="inline-start" />
            Seleccionar set de trabajo (.lof)
          {/if}
        </Button>
      </Card.Content>
    </Card.Root>

    <Separator />

    <!-- Merge import (cooperadora) -->
    <Card.Root>
      <Card.Header>
        <Card.Title class="flex items-center gap-2">
          <ArrowLeftRightIcon class="size-5" />
          Integrar cambios de un colaborador
        </Card.Title>
        <Card.Description>
          Importá el patch que te devolvió un colaborador. Primero se analiza lo que se va a
          agregar; vos lo revisás y aprobás antes de que se aplique.
        </Card.Description>
      </Card.Header>
      <Card.Content class="flex flex-col gap-4">
        <input
          bind:this={mergeFileInput}
          type="file"
          accept=".lof"
          class="hidden"
          onchange={handleMergeFileSelect}
        />

        {#if !mergeAnalysis && !analyzing}
          <Button
            variant="outline"
            onclick={() => mergeFileInput?.click()}
            class="w-fit"
          >
            <UploadIcon data-icon="inline-start" />
            Seleccionar patch (.lof) para analizar
          </Button>
        {/if}

        {#if analyzing}
          <div class="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircleIcon class="size-4 animate-spin" />
            Analizando patch…
          </div>
        {/if}

        {#if mergeAnalysis}
          <div class="flex flex-col gap-4">
            <!-- Resumen -->
            <div class="flex flex-col gap-2">
              <div class="flex items-center gap-2 text-sm">
                <span class="font-medium">Origen:</span>
                <span class="text-muted-foreground">
                  {mergeAnalysis.source?.cooperadora || '—'}
                  {#if mergeAnalysis.source?.ejercicio}
                    — Ejercicio {mergeAnalysis.source.ejercicio}
                  {/if}
                </span>
              </div>
              <div class="flex items-center gap-2 text-sm">
                <span class="font-medium">Exportado:</span>
                <span class="text-muted-foreground">
                  {mergeAnalysis.exportedAt
                    ? new Date(mergeAnalysis.exportedAt).toLocaleString('es-AR')
                    : '—'}
                </span>
              </div>
            </div>

            <Separator />

            <!-- Conteos -->
            <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div class="flex flex-col gap-1">
                <span class="text-2xl font-bold">{mergeAnalysis.resumen.movimientosNuevos}</span>
                <span class="text-xs text-muted-foreground">Movimientos nuevos</span>
              </div>
              <div class="flex flex-col gap-1">
                <span class="text-2xl font-bold">{mergeAnalysis.resumen.personasNuevas}</span>
                <span class="text-xs text-muted-foreground">Personas nuevas</span>
              </div>
              <div class="flex flex-col gap-1">
                <span class="text-2xl font-bold text-amber-600">{mergeAnalysis.resumen.personasDeduplicadas}</span>
                <span class="text-xs text-muted-foreground">Personas deduplicadas</span>
              </div>
              <div class="flex flex-col gap-1">
                <span class="text-2xl font-bold">{mergeAnalysis.resumen.sociosNuevos}</span>
                <span class="text-xs text-muted-foreground">Socios nuevos</span>
              </div>
              <div class="flex flex-col gap-1">
                <span class="text-2xl font-bold {mergeAnalysis.resumen.conflictos > 0 ? 'text-destructive' : 'text-green-600'}">
                  {mergeAnalysis.resumen.conflictos}
                </span>
                <span class="text-xs text-muted-foreground">Conflictos</span>
              </div>
            </div>

            <!-- Advertencias -->
            {#if mergeAnalysis.advertencias.length > 0}
              <Alert variant="default">
                <AlertCircleIcon data-icon="inline-start" />
                <AlertDescription>
                  <ul class="list-disc pl-4">
                    {#each mergeAnalysis.advertencias as adv}
                      <li>{adv}</li>
                    {/each}
                  </ul>
                </AlertDescription>
              </Alert>
            {/if}

            <!-- Conflictos bloqueantes -->
            {#if mergeAnalysis.resumen.conflictos > 0}
              <Alert variant="destructive">
                <AlertCircleIcon data-icon="inline-start" />
                <AlertDescription>
                  Hay {mergeAnalysis.resumen.conflictos} conflicto(s) que bloquean el merge.
                  Referencias rotas: el patch usa IDs que no existen en tu base de datos.
                  {#each mergeAnalysis.detalle.conflictos as c}
                    <div class="mt-1 text-xs">
                      <strong>{c.movimientoDetalle}</strong>: {c.conflictos.map((x) => x.razon).join('; ')}
                    </div>
                  {/each}
                </AlertDescription>
              </Alert>
            {/if}

            <!-- Detalle colapsable: movimientos -->
            {#if mergeAnalysis.detalle.movimientos.length > 0}
              <div class="flex flex-col gap-2">
                <button
                  class="flex items-center gap-2 text-sm font-medium text-left"
                  onclick={() => (showMovimientos = !showMovimientos)}
                >
                  {showMovimientos ? '▾' : '▸'} Ver detalle de movimientos ({mergeAnalysis.detalle.movimientos.length})
                </button>
                {#if showMovimientos}
                  <div class="overflow-x-auto rounded-md border">
                    <table class="w-full text-sm">
                      <thead class="bg-muted/50">
                        <tr>
                          <th class="px-2 py-1 text-left">Fecha</th>
                          <th class="px-2 py-1 text-left">Detalle</th>
                          <th class="px-2 py-1 text-right">Importe</th>
                          <th class="px-2 py-1 text-left">Tipo</th>
                          <th class="px-2 py-1 text-left">Rubro</th>
                          <th class="px-2 py-1 text-left">Persona</th>
                          <th class="px-2 py-1 text-left">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {#each mergeAnalysis.detalle.movimientos as m, i (i)}
                          <tr class="border-t">
                            <td class="px-2 py-1">{m.fecha}</td>
                            <td class="px-2 py-1">{m.detalle}</td>
                            <td class="px-2 py-1 text-right">
                              {#if m.importe != null}
                                ${m.importe.toLocaleString('es-AR')}
                              {/if}
                            </td>
                            <td class="px-2 py-1">{m.tipo}</td>
                            <td class="px-2 py-1">{m.rubro}</td>
                            <td class="px-2 py-1">{m.persona}</td>
                            <td class="px-2 py-1">
                              {#if m.estado === 'conflicto'}
                                <Badge variant="destructive">Conflicto</Badge>
                              {:else}
                                <Badge variant="secondary">Nuevo</Badge>
                              {/if}
                            </td>
                          </tr>
                        {/each}
                      </tbody>
                    </table>
                  </div>
                {/if}
              </div>
            {/if}

            <!-- Detalle colapsable: personas -->
            {#if mergeAnalysis.detalle.personas.length > 0}
              <div class="flex flex-col gap-2">
                <button
                  class="flex items-center gap-2 text-sm font-medium text-left"
                  onclick={() => (showPersonas = !showPersonas)}
                >
                  {showPersonas ? '▾' : '▸'} Ver personas ({mergeAnalysis.detalle.personas.length})
                </button>
                {#if showPersonas}
                  <div class="overflow-x-auto rounded-md border">
                    <table class="w-full text-sm">
                      <thead class="bg-muted/50">
                        <tr>
                          <th class="px-2 py-1 text-left">DNI</th>
                          <th class="px-2 py-1 text-left">Apellido, Nombre</th>
                          <th class="px-2 py-1 text-left">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {#each mergeAnalysis.detalle.personas as p, i (i)}
                          <tr class="border-t">
                            <td class="px-2 py-1">{p.dni}</td>
                            <td class="px-2 py-1">{p.apellido}{#if p.nombre}, {p.nombre}{/if}</td>
                            <td class="px-2 py-1">
                              {#if p.estado === 'deduplicada'}
                                <Badge variant="secondary">Deduplicada</Badge>
                              {:else}
                                <Badge>Nueva</Badge>
                              {/if}
                            </td>
                          </tr>
                        {/each}
                      </tbody>
                    </table>
                  </div>
                {/if}
              </div>
            {/if}

            <Separator />

            <!-- Opción backup + botones -->
            <label class="flex items-center gap-2 text-sm">
              <Checkbox bind:checked={doBackupBefore} />
              Exportar backup antes de aplicar (recomendado)
            </label>

            <div class="flex gap-2">
              <Button variant="outline" onclick={handleCancelMerge} disabled={applying}>
                Cancelar
              </Button>
              <Button onclick={handleApplyMerge} disabled={!canApply}>
                {#if applying}
                  <CheckCircleIcon data-icon="inline-start" class="animate-spin" />
                  Aplicando…
                {:else}
                  <CheckCircleIcon data-icon="inline-start" />
                  Aprobar e importar
                {/if}
              </Button>
            </div>

            {#if !canApply && mergeAnalysis.resumen.conflictos > 0}
              <p class="text-xs text-destructive">
                No se puede aplicar mientras haya conflictos sin resolver.
              </p>
            {/if}
          </div>
        {/if}

        {#if mergeResult}
          <Alert>
            <CheckCircleIcon data-icon="inline-start" />
            <AlertDescription>
              <p class="font-medium">Merge completado</p>
              <ul class="mt-1 list-disc pl-4 text-sm">
                <li>{mergeResult.added.movimientos} movimiento(s) agregado(s)</li>
                <li>{mergeResult.added.personas} persona(s) nueva(s)</li>
                <li>{mergeResult.deduped.personas} persona(s) deduplicada(s)</li>
                <li>{mergeResult.added.socios} socio(s) nuevo(s)</li>
              </ul>
            </AlertDescription>
          </Alert>
        {/if}
      </Card.Content>
    </Card.Root>

    {#if isColaborador}
      <Separator />

      <!-- Finalizar colaboración -->
      <Card.Root class="border-amber-500/30">
        <Card.Header>
          <Card.Title class="flex items-center gap-2">
            <HandHeartIcon class="size-5 text-amber-600" />
            Finalizar colaboración
          </Card.Title>
          <Card.Description>
            Exportá los movimientos que cargaste para devolverselos a la cooperadora.
            Después podés limpiar el dispositivo para borrar todos los datos.
          </Card.Description>
        </Card.Header>
        <Card.Content class="flex flex-col gap-4">
          {#if !patchExported}
            <Button onclick={handleExportPatchYLimpiar} disabled={cleaning} class="w-fit">
              {#if cleaning}
                <CheckCircleIcon data-icon="inline-start" class="animate-spin" />
                Exportando…
              {:else}
                <DownloadIcon data-icon="inline-start" />
                Exportar patch y limpiar
              {/if}
            </Button>
          {:else}
            <Alert>
              <CheckCircleIcon data-icon="inline-start" />
              <AlertDescription>
                Patch exportado. Ya podés limpiar el dispositivo.
              </AlertDescription>
            </Alert>

            <Button variant="outline" onclick={() => (showCleanupConfirm = true)} disabled={cleaning} class="w-fit">
              <TrashIcon data-icon="inline-start" />
              Limpiar dispositivo
            </Button>
          {/if}

          {#if showCleanupConfirm}
            <Alert variant="destructive">
              <AlertCircleIcon data-icon="inline-start" />
              <AlertDescription>
                <p class="font-medium">¿Seguro que querés limpiar el dispositivo?</p>
                <p class="mt-1 text-sm">
                  Se borrarán todos los datos locales (movimientos, personas, configuración).
                  Esta acción no se puede deshacer. Asegurate de haber exportado el patch.
                </p>
                <div class="mt-3 flex gap-2">
                  <Button variant="destructive" size="sm" onclick={handleLimpiarDispositivo} disabled={cleaning}>
                    {#if cleaning}
                      <CheckCircleIcon data-icon="inline-start" class="animate-spin" />
                      Limpiando…
                    {:else}
                      <TrashIcon data-icon="inline-start" />
                      Sí, limpiar todo
                    {/if}
                  </Button>
                  <Button variant="outline" size="sm" onclick={() => (showCleanupConfirm = false)}>
                    Cancelar
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          {/if}
        </Card.Content>
      </Card.Root>
    {/if}
  </div>
{/if}
