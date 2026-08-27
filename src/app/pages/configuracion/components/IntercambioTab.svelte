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
  import TrashIcon from '@lucide/svelte/icons/trash-2'
  import HandHeartIcon from '@lucide/svelte/icons/hand-heart'
  import { getActiveBackend } from '$core/data/dataRepository'
  import { createIntercambioService } from '../intercambioService.svelte.js'

  const isPouchMode = getActiveBackend() === 'pouch'
  const svc = createIntercambioService()

  // File inputs (referencias DOM que necesitan vivir en el componente)
  let wsFileInput = $state(null)
  let mergeFileInput = $state(null)

  // Estado de UI colapsable (puramente presentacional, vive en el componente)
  let showMovimientos = $state(false)
  let showPersonas = $state(false)

  const PROFILE_LABELS = {
    working_set: 'Set de trabajo (para colaborador)',
    patch_movimientos: 'Solo movimientos nuevos (patch)',
    full: 'Backup completo',
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
          <Select.Root type="single" bind:value={svc.exportProfile}>
            <Select.Trigger id="export-profile" class="w-full">
              {PROFILE_LABELS[svc.exportProfile] ?? 'Seleccionar…'}
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

        {#if svc.exportProfile === 'working_set'}
          <Alert>
            <CheckCircleIcon data-icon="inline-start" />
            <AlertDescription>
              Incluye personas (datos reducidos: sin domicilio, teléfono ni email), socios,
              cuentas, rubros, subrubros, ejercicios y configuración. Un colaborador puede
              usarlo para cargar movimientos desde su dispositivo.
            </AlertDescription>
          </Alert>
        {:else if svc.exportProfile === 'patch_movimientos'}
          <Alert>
            <CheckCircleIcon data-icon="inline-start" />
            <AlertDescription>
              Exporta solo los movimientos, personas y socios que creaste localmente
              (excluye lo que recibiste de un set de trabajo). Pensado para devolver a la
              cooperadora y que haga merge.
            </AlertDescription>
          </Alert>
        {/if}

        <Button onclick={svc.handleExport} disabled={svc.exporting} class="w-fit">
          {#if svc.exporting}
            <CheckCircleIcon data-icon="inline-start" class="animate-spin" />
            Exportando…
          {:else}
            <DownloadIcon data-icon="inline-start" />
            Exportar .lof
          {/if}
        </Button>

        {#if svc.exportResult}
          <p class="text-sm text-muted-foreground">
            {svc.exportResult.filename} — {svc.exportResult.docCount} documentos
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
          onchange={svc.handleWsImport}
        />
        <Button
          variant="outline"
          onclick={() => wsFileInput?.click()}
          disabled={svc.importingWs}
          class="w-fit"
        >
          {#if svc.importingWs}
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
          onchange={svc.handleMergeFileSelect}
        />

        {#if !svc.mergeAnalysis && !svc.analyzing}
          <Button
            variant="outline"
            onclick={() => mergeFileInput?.click()}
            class="w-fit"
          >
            <UploadIcon data-icon="inline-start" />
            Seleccionar patch (.lof) para analizar
          </Button>
        {/if}

        {#if svc.analyzing}
          <div class="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircleIcon class="size-4 animate-spin" />
            Analizando patch…
          </div>
        {/if}

        {#if svc.mergeAnalysis}
          <div class="flex flex-col gap-4">
            <!-- Resumen -->
            <div class="flex flex-col gap-2">
              <div class="flex items-center gap-2 text-sm">
                <span class="font-medium">Origen:</span>
                <span class="text-muted-foreground">
                  {svc.mergeAnalysis.source?.cooperadora || '—'}
                  {#if svc.mergeAnalysis.source?.ejercicio}
                    — Ejercicio {svc.mergeAnalysis.source.ejercicio}
                  {/if}
                </span>
              </div>
              <div class="flex items-center gap-2 text-sm">
                <span class="font-medium">Exportado:</span>
                <span class="text-muted-foreground">
                  {svc.mergeAnalysis.exportedAt
                    ? new Date(svc.mergeAnalysis.exportedAt).toLocaleString('es-AR')
                    : '—'}
                </span>
              </div>
            </div>

            <Separator />

            <!-- Conteos -->
            <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div class="flex flex-col gap-1">
                <span class="text-2xl font-bold">{svc.mergeAnalysis.resumen.movimientosNuevos}</span>
                <span class="text-xs text-muted-foreground">Movimientos nuevos</span>
              </div>
              <div class="flex flex-col gap-1">
                <span class="text-2xl font-bold">{svc.mergeAnalysis.resumen.personasNuevas}</span>
                <span class="text-xs text-muted-foreground">Personas nuevas</span>
              </div>
              <div class="flex flex-col gap-1">
                <span class="text-2xl font-bold text-amber-600">{svc.mergeAnalysis.resumen.personasDeduplicadas}</span>
                <span class="text-xs text-muted-foreground">Personas deduplicadas</span>
              </div>
              <div class="flex flex-col gap-1">
                <span class="text-2xl font-bold">{svc.mergeAnalysis.resumen.sociosNuevos}</span>
                <span class="text-xs text-muted-foreground">Socios nuevos</span>
              </div>
              <div class="flex flex-col gap-1">
                <span class="text-2xl font-bold {svc.mergeAnalysis.resumen.conflictos > 0 ? 'text-destructive' : 'text-green-600'}">
                  {svc.mergeAnalysis.resumen.conflictos}
                </span>
                <span class="text-xs text-muted-foreground">Conflictos</span>
              </div>
            </div>

            <!-- Advertencias -->
            {#if svc.mergeAnalysis.advertencias.length > 0}
              <Alert variant="default">
                <AlertCircleIcon data-icon="inline-start" />
                <AlertDescription>
                  <ul class="list-disc pl-4">
                    {#each svc.mergeAnalysis.advertencias as adv}
                      <li>{adv}</li>
                    {/each}
                  </ul>
                </AlertDescription>
              </Alert>
            {/if}

            <!-- Conflictos bloqueantes -->
            {#if svc.mergeAnalysis.resumen.conflictos > 0}
              <Alert variant="destructive">
                <AlertCircleIcon data-icon="inline-start" />
                <AlertDescription>
                  Hay {svc.mergeAnalysis.resumen.conflictos} conflicto(s) que bloquean el merge.
                  Referencias rotas: el patch usa IDs que no existen en tu base de datos.
                  {#each svc.mergeAnalysis.detalle.conflictos as c}
                    <div class="mt-1 text-xs">
                      <strong>{c.movimientoDetalle}</strong>: {c.conflictos.map((x) => x.razon).join('; ')}
                    </div>
                  {/each}
                </AlertDescription>
              </Alert>
            {/if}

            <!-- Detalle colapsable: movimientos -->
            {#if svc.mergeAnalysis.detalle.movimientos.length > 0}
              <div class="flex flex-col gap-2">
                <button
                  class="flex items-center gap-2 text-sm font-medium text-left"
                  onclick={() => (showMovimientos = !showMovimientos)}
                >
                  {showMovimientos ? '▾' : '▸'} Ver detalle de movimientos ({svc.mergeAnalysis.detalle.movimientos.length})
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
                        {#each svc.mergeAnalysis.detalle.movimientos as m, i (i)}
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
            {#if svc.mergeAnalysis.detalle.personas.length > 0}
              <div class="flex flex-col gap-2">
                <button
                  class="flex items-center gap-2 text-sm font-medium text-left"
                  onclick={() => (showPersonas = !showPersonas)}
                >
                  {showPersonas ? '▾' : '▸'} Ver personas ({svc.mergeAnalysis.detalle.personas.length})
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
                        {#each svc.mergeAnalysis.detalle.personas as p, i (i)}
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
              <Checkbox bind:checked={svc.doBackupBefore} />
              Exportar backup antes de aplicar (recomendado)
            </label>

            <div class="flex gap-2">
              <Button variant="outline" onclick={svc.handleCancelMerge} disabled={svc.applying}>
                Cancelar
              </Button>
              <Button onclick={svc.handleApplyMerge} disabled={!svc.canApply}>
                {#if svc.applying}
                  <CheckCircleIcon data-icon="inline-start" class="animate-spin" />
                  Aplicando…
                {:else}
                  <CheckCircleIcon data-icon="inline-start" />
                  Aprobar e importar
                {/if}
              </Button>
            </div>

            {#if !svc.canApply && svc.mergeAnalysis.resumen.conflictos > 0}
              <p class="text-xs text-destructive">
                No se puede aplicar mientras haya conflictos sin resolver.
              </p>
            {/if}
          </div>
        {/if}

        {#if svc.mergeResult}
          <Alert>
            <CheckCircleIcon data-icon="inline-start" />
            <AlertDescription>
              <p class="font-medium">Merge completado</p>
              <ul class="mt-1 list-disc pl-4 text-sm">
                <li>{svc.mergeResult.added.movimientos} movimiento(s) agregado(s)</li>
                <li>{svc.mergeResult.added.personas} persona(s) nueva(s)</li>
                <li>{svc.mergeResult.deduped.personas} persona(s) deduplicada(s)</li>
                <li>{svc.mergeResult.added.socios} socio(s) nuevo(s)</li>
              </ul>
            </AlertDescription>
          </Alert>
        {/if}
      </Card.Content>
    </Card.Root>

    {#if svc.isColaborador}
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
          {#if !svc.patchExported}
            <Button onclick={svc.handleExportPatchYLimpiar} disabled={svc.cleaning} class="w-fit">
              {#if svc.cleaning}
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

            <Button variant="outline" onclick={() => (svc.showCleanupConfirm = true)} disabled={svc.cleaning} class="w-fit">
              <TrashIcon data-icon="inline-start" />
              Limpiar dispositivo
            </Button>
          {/if}

          {#if svc.showCleanupConfirm}
            <Alert variant="destructive">
              <AlertCircleIcon data-icon="inline-start" />
              <AlertDescription>
                <p class="font-medium">¿Seguro que querés limpiar el dispositivo?</p>
                <p class="mt-1 text-sm">
                  Se borrarán todos los datos locales (movimientos, personas, configuración).
                  Esta acción no se puede deshacer. Asegurate de haber exportado el patch.
                </p>
                <div class="mt-3 flex gap-2">
                  <Button variant="destructive" size="sm" onclick={svc.handleLimpiarDispositivo} disabled={svc.cleaning}>
                    {#if svc.cleaning}
                      <CheckCircleIcon data-icon="inline-start" class="animate-spin" />
                      Limpiando…
                    {:else}
                      <TrashIcon data-icon="inline-start" />
                      Sí, limpiar todo
                    {/if}
                  </Button>
                  <Button variant="outline" size="sm" onclick={() => (svc.showCleanupConfirm = false)}>
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
