<script>
  import * as Card from '$lib/components/ui/card'
  import { Button } from '$lib/components/ui/button'
  import { Badge } from '$lib/components/ui/badge'
  import { Separator } from '$lib/components/ui/separator'
  import { Checkbox } from '$lib/components/ui/checkbox'
  import * as Field from '$lib/components/ui/field'
  import { Input } from '$lib/components/ui/input'
  import { Alert, AlertDescription } from '$lib/components/ui/alert'
  import KeyIcon from '@lucide/svelte/icons/key-round'
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
  import { formatFecha } from '$core/format/format'
  import { createIntercambioService } from '../intercambioService.svelte.js'
  import { pinStore } from '$core/security/pinStore.svelte'
  import { configStore } from '$core/grist/stores/configStore.svelte'

  // Rol activo para decidir qué secciones mostrar
  const activeRole = $derived(pinStore.activeRole || (configStore.config?.modo_colaborador ? 'tesorero' : 'super_admin'))
  const isColaboradorMode = $derived(!!configStore.config?.modo_colaborador || activeRole === 'tesorero')
  // "Integrar cambios" solo para super_admin y admin (la cooperadora)
  const canImportPatches = $derived(activeRole === 'super_admin' || activeRole === 'admin')

  const isPouchMode = getActiveBackend() === 'pouch'
  const svc = createIntercambioService()

  // File inputs (referencias DOM que necesitan vivir en el componente)
  let wsFileInput = $state(null)
  let mergeFileInput = $state(null)

  // Estado de UI colapsable (puramente presentacional, vive en el componente)
  let showMovimientos = $state(false)
  let showPersonas = $state(false)

</script>

{#if !isPouchMode}
  <Alert>
    <CheckCircleIcon data-icon="inline-start" />
    <AlertDescription>
      En modo Grist, podés exportar un backup completo en formato <span class="font-mono">.lof</span>
      para migrar a una instalación standalone (PouchDB). Para un respaldo del documento Grist
      nativo, usá las herramientas de backup de Grist. El intercambio descentralizado
      (sets de trabajo y patches entre colaboradores) solo está disponible en modo standalone.
    </AlertDescription>
  </Alert>
{/if}

<div class="flex flex-col gap-6">
  {#if isColaboradorMode}
    <!-- Modo colaborador: solo "Finalizar colaboración" -->
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
              Exportar cargas realizadas
            {/if}
          </Button>
        {:else}
          <Alert>
            <CheckCircleIcon data-icon="inline-start" />
            <AlertDescription>
              Cargas exportadas. Ya podés limpiar el dispositivo.
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
                Esta acción no se puede deshacer. Asegurate de haber exportado las cargas.
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
  {:else if canImportPatches}
    <!-- Modo cooperadora (super_admin / admin): Exportar set de trabajo + Integrar cambios -->
  <Card.Root>
    <Card.Header>
      <Card.Title class="flex items-center gap-2">
        <ShareIcon class="size-5" />
        Exportar set de trabajo
      </Card.Title>
      <Card.Description>
        Generá un archivo <span class="font-mono">.lof</span> con los datos que un colaborador
        necesita para cargar movimientos desde su dispositivo.
      </Card.Description>
    </Card.Header>
    <Card.Content class="flex flex-col gap-4">
      <Alert>
        <CheckCircleIcon data-icon="inline-start" />
        <AlertDescription>
          Incluye personas (datos reducidos: sin domicilio, teléfono ni email), socios,
          cuentas, rubros, subrubros, ejercicios y configuración. El colaborador puede
          usarlo para cargar movimientos y después devolverte los cambios.
        </AlertDescription>
      </Alert>

      <!-- Contraseña opcional para cifrar el set de trabajo -->
      <div class="flex flex-col gap-2 rounded-lg border border-input p-3 bg-muted/30">
        <div class="flex items-center gap-2 text-sm font-medium">
          <KeyIcon class="size-4 text-muted-foreground" />
          Cifrar con contraseña (opcional)
        </div>
        <p class="text-xs text-muted-foreground">
          Si ingresás una contraseña, el archivo <span class="font-mono">.lof</span> se cifra con AES-GCM.
          El colaborador debe ingresar la misma contraseña para importarlo.
          Dejalo vacío para exportar sin cifrar.
        </p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Input
            type="password"
            placeholder="Contraseña"
            autocomplete="off"
            bind:value={svc.exportPassphrase}
            disabled={svc.exporting}
          />
          <Input
            type="password"
            placeholder="Repetir contraseña"
            autocomplete="off"
            bind:value={svc.exportConfirmPassphrase}
            disabled={svc.exporting}
          />
        </div>
      </div>

      <Button onclick={svc.handleExport} disabled={svc.exporting} class="w-fit">
        {#if svc.exporting}
          <CheckCircleIcon data-icon="inline-start" class="animate-spin" />
          Exportando…
        {:else}
          <DownloadIcon data-icon="inline-start" />
          Exportar set de trabajo
        {/if}
      </Button>

      {#if svc.exportResult}
        <p class="text-sm text-muted-foreground">
          {svc.exportResult.filename} — {svc.exportResult.docCount} documentos
        </p>
      {/if}
    </Card.Content>
  </Card.Root>

  {#if isPouchMode}
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
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
                            <td class="px-2 py-1">{formatFecha(m.fecha)}</td>
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
  {/if}
{/if}
</div>
