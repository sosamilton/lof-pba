<script>
  import * as Card from '$lib/components/ui/card'
  import { Badge } from '$lib/components/ui/badge'
  import { Separator } from '$lib/components/ui/separator'
  import { Switch } from '$lib/components/ui/switch'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import * as Select from '$lib/components/ui/select'
  import Combobox from '$lib/components/Combobox.svelte'
  import CheckCircleIcon from '@lucide/svelte/icons/circle-check'
  import RefreshIcon from '@lucide/svelte/icons/refresh-cw'
  import WrenchIcon from '@lucide/svelte/icons/wrench'
  import CopyCheckIcon from '@lucide/svelte/icons/copy-check'
  import SettingsIcon from '@lucide/svelte/icons/settings'
  import TagIcon from '@lucide/svelte/icons/tag'
  import ArrowUpCircleIcon from '@lucide/svelte/icons/arrow-up-circle'
  import ArrowLeftRightIcon from '@lucide/svelte/icons/arrow-left-right'
  import CalendarIcon from '@lucide/svelte/icons/calendar'
  import PaletteIcon from '@lucide/svelte/icons/palette'
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte'
  import { useConfirmDialog } from '$lib/hooks/useConfirmDialog.svelte.js'
  import { identidad } from '$core/data/identidad'
  import { exportBackup } from '$core/data/backup.js'
  import { getActiveBackend, exportGristDoc, importGristDoc } from '$core/data/dataRepository'
  import DownloadIcon from '@lucide/svelte/icons/download'
  import UploadIcon from '@lucide/svelte/icons/upload'
  import { notify } from '$core/ui/notify.svelte'
  import { trackEvent } from '$core/analytics/plausible.js'

  const isPouchMode = getActiveBackend() === 'pouch'
  const isGristMode = getActiveBackend() === 'grist'
  let exporting = $state(false)
  let exportResult = $state(null)
  let importing = $state(false)
  let importResult = $state(null)
  let gristFileInput = $state(null)

  const handleExport = async () => {
    exporting = true
    exportResult = null
    try {
      const res = isPouchMode
        ? await exportBackup()
        : await exportGristDoc()
      exportResult = res
      // Analytics: backup exportado (goal "Backup exportado")
      trackEvent('backup_exported', { backend: getActiveBackend(), doc_count: res.docCount || 0 })
    } catch (e) {
      notify.error(e?.message || 'Error al exportar')
    } finally {
      exporting = false
    }
  }

  const handleGristImport = async (/** @type {Event} */ e) => {
    const input = /** @type {HTMLInputElement} */ (e.target)
    const file = input.files?.[0]
    if (!file) return
    importing = true
    importResult = null
    const id = notify.loading('Importando documento Grist…')
    try {
      const res = await importGristDoc(file)
      notify.dismiss(id)
      importResult = res
      trackEvent('backup_imported', { backend: 'grist', record_count: res.recordCount || 0 })
      notify.success(`Importación completada: ${res.recordCount} registros en ${res.tableCount} tablas.`)
    } catch (e) {
      notify.dismiss(id)
      notify.error(e?.message || 'Error al importar documento Grist')
    } finally {
      importing = false
      input.value = ''
    }
  }

  let {
    store,
  } = $props()

  const identidadNombre = identidad.nombre

  // Estado local para edición del título (guarda on blur / Enter)
  let titleDraft = $state('')
  let titleDirty = $state(false)

  $effect(() => {
    if (!titleDirty) titleDraft = store.appTitle || ''
  })

  const guardarTitulo = () => {
    if (!titleDirty) return
    titleDirty = false
    store.onAppTitleChange(titleDraft.trim())
  }

  const PERIODICIDADES = [
    { value: 'mensual', label: 'Mensual' },
    { value: 'semanal', label: 'Semanal' },
    { value: 'trimestral', label: 'Trimestral' },
    { value: 'semestral', label: 'Semestral' },
    { value: 'anual', label: 'Anual' },
  ]

  const confirm = useConfirmDialog()

  const confirmarDedup = () => {
    confirm.openConfirm({
      title: 'Deduplicar personas',
      description: 'Se buscarán y fusionarán personas con DNI duplicado. Los registros duplicados se consolidarán en uno solo.',
      confirmLabel: 'Continuar',
      variant: 'default',
      onConfirm: () => store.doDedup(),
    })
  }
</script>

<Card.Root class="pt-2 border-0 shadow-none">
  <Card.Content class="flex flex-col gap-4 pt-4">
    <!-- Apariencia y preferencias -->
    <div class="rounded-lg border border-border px-4 py-3 flex flex-col gap-4">
      <div class="flex items-center gap-2">
        <PaletteIcon class="size-4 text-primary" />
        <span class="text-sm font-semibold">Apariencia y preferencias</span>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <div class="flex flex-col gap-1.5">
          <Label for="app-title">Título de la app</Label>
          <Input
            id="app-title"
            bind:value={titleDraft}
            oninput={() => { titleDirty = true }}
            onblur={guardarTitulo}
            onkeydown={(/** @type {KeyboardEvent} */ e) => { if (e.key === 'Enter') { e.preventDefault(); guardarTitulo() } }}
            placeholder={identidadNombre}
            disabled={store.savingConfig}
            class="mt-0.5"
          />
          <p class="text-xs text-muted-foreground">Nombre que aparece en el sidebar y en el título del navegador.</p>
        </div>

        <div class="flex flex-col gap-1.5">
          <Label for="color-primario">Color de marca</Label>
          <div class="flex items-center gap-2 mt-0.5">
            <Input
              id="color-primario"
              type="color"
              value={store.color_primario}
              oninput={(/** @type {Event} */ e) => store.onColorChange(/** @type {HTMLInputElement} */ (e.target)?.value)}
              disabled={store.savingConfig}
              class="h-10 w-16 p-1"
            />
            <span class="text-sm font-mono text-muted-foreground">{store.color_primario}</span>
          </div>
          <p class="text-xs text-muted-foreground">Se aplica inmediatamente al cambiar.</p>
        </div>

        <div class="flex flex-col gap-1.5 sm:col-span-2">
          <Label for="cuenta-default">Cuenta por defecto</Label>
          <Combobox
            value={store.cuentaDefaultId}
            items={store.cuentas.map((c) => ({ value: c.id, label: c.nombre_cuenta }))}
            placeholder="Elegir…"
            searchPlaceholder="Buscar cuenta…"
            class="mt-0.5"
            onchange={(v) => store.onCuentaDefaultChange(v)}
          />
          <p class="text-xs text-muted-foreground">Cuenta que se pre-selecciona al crear un movimiento nuevo.</p>
        </div>
      </div>
    </div>

    <Separator />

    <div class="rounded-lg border border-border px-4 py-3 flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <div>
          <div class="text-sm font-medium">Modalidad de gestión</div>
          <div class="text-xs text-muted-foreground">Forma en que la cooperadora administra su información</div>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-sm">{store.modalidadGestion}</span>
          <Switch
            checked={store.moduloGestionIntegral}
            onCheckedChange={(v) => store.onModalidadChange(v ? 'gestion_integral' : 'carga_consolidada')}
            disabled={store.savingConfig}
          />
          <span class="text-sm text-muted-foreground">{store.moduloGestionIntegral ? 'Integral' : 'Consolidada'}</span>
        </div>
      </div>

      {#if !store.moduloGestionIntegral}
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <CalendarIcon class="size-4 text-muted-foreground" />
            <div>
              <div class="text-sm font-medium">Periodicidad de carga</div>
              <div class="text-xs text-muted-foreground">Período para consolidar movimientos</div>
            </div>
          </div>
          <Select.Root
            type="single"
            value={store.periodicidad || 'mensual'}
            onValueChange={(v) => store.onPeriodicidadChange(v)}
          >
            <Select.Trigger class="w-40" disabled={store.savingConfig}>
              {PERIODICIDADES.find((p) => p.value === (store.periodicidad || 'mensual'))?.label || 'Mensual'}
            </Select.Trigger>
            <Select.Content>
              {#each PERIODICIDADES as p}
                <Select.Item value={p.value}>{p.label}</Select.Item>
              {/each}
            </Select.Content>
          </Select.Root>
        </div>
      {/if}

      {#if !store.moduloGestionIntegral && store.hasMovimientosSinCarga}
        <div class="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2">
          <ArrowLeftRightIcon class="size-4 text-warning shrink-0" />
          <span class="text-sm text-muted-foreground">Hay movimientos sin carga vinculada.</span>
          <Button
            variant="outline"
            size="sm"
            class="ml-auto"
            onclick={store.migrarMovimientosLegacy}
            disabled={store.migrandoCargas}
          >
            {store.migrandoCargas ? 'Migrando…' : 'Migrar a cargas'}
          </Button>
        </div>
      {/if}

      {#if store.migracionResult}
        <div class="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          <span class="font-semibold">Migración completada:</span>
          {store.migracionResult.cargasCreadas} cargas creadas,
          {store.migracionResult.movimientosVinculados} movimientos vinculados.
        </div>
      {/if}
    </div>

    <Separator />

    <div class="flex items-center gap-2">
      <CheckCircleIcon class="size-5 text-primary" />
      <span class="text-sm font-semibold">Plantilla {identidadNombre} instalada y sincronizada</span>
    </div>

    <Separator />

    <div class="flex flex-wrap items-center gap-2 text-xs">
      <TagIcon class="size-4 text-muted-foreground" />
      <span class="text-muted-foreground">Versión actual:</span>
      <Badge variant="secondary" class="font-mono">v{store.versionActual}</Badge>
      {#if store.shaActual && store.shaActual !== 'dev'}
        <span class="text-muted-foreground font-mono">({store.shaActual})</span>
      {/if}
    </div>
    {#if store.versionInstalada}
      <div class="flex flex-wrap items-center gap-2 text-xs">
        <span class="text-muted-foreground">Instalada en este documento:</span>
        <Badge variant="secondary" class="font-mono">v{store.versionInstalada}</Badge>
        {#if store.shaInstalado && store.shaInstalado !== 'dev'}
          <span class="text-muted-foreground font-mono">({store.shaInstalado})</span>
        {/if}
        {#if store.versionActualizada}
          <Badge variant="default" class="ml-1"><CheckCircleIcon class="size-3" /> Actualizada</Badge>
        {:else}
          <Badge variant="destructive" class="ml-1"><ArrowUpCircleIcon class="size-3" /> Desactualizada</Badge>
          <span class="text-muted-foreground">Refrescá o reinstalá para actualizar a v{store.versionActual}</span>
        {/if}
      </div>
    {:else}
      <div class="text-xs text-muted-foreground">Sin versión instalada registrada (instalación previa al versionado).</div>
    {/if}

    <div class="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onclick={store.check} disabled={store.creating}>
        <RefreshIcon data-icon="inline-start" />
        Revalidar
      </Button>
      <Button variant="outline" size="sm" onclick={store.repairSchema} disabled={store.creating}>
        <WrenchIcon data-icon="inline-start" />
        Reparar Refs
      </Button>
      <Button variant="outline" size="sm" onclick={confirmarDedup} disabled={store.migrating || store.creating}>
        <CopyCheckIcon data-icon="inline-start" />
        {store.migrating ? 'Procesando…' : 'Deduplicar personas'}
      </Button>
    </div>

    {#if isPouchMode}
      <Separator />
      <div class="rounded-lg border border-border px-4 py-3 flex flex-col gap-3">
        <div class="flex items-center gap-2">
          <DownloadIcon class="size-4 text-primary" />
          <span class="text-sm font-semibold">Backup y restauración</span>
        </div>
        <p class="text-xs text-muted-foreground">
          Exportá todos los datos de tu cooperadora a un archivo comprimido (.lof).
          Usalo para migrar a otra computadora o como respaldo de seguridad.
        </p>
        <div class="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onclick={handleExport} disabled={exporting}>
            <DownloadIcon data-icon="inline-start" />
            {exporting ? 'Exportando…' : 'Exportar backup'}
          </Button>
        </div>
        {#if exportResult}
          <div class="text-xs text-muted-foreground rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
            Backup creado: <strong>{exportResult.filename}</strong>
            ({(exportResult.size / 1024 / 1024).toFixed(2)} MB, {exportResult.docCount} documentos).
          </div>
        {/if}
      </div>
    {:else if isGristMode}
      <Separator />
      <div class="rounded-lg border border-border px-4 py-3 flex flex-col gap-3">
        <div class="flex items-center gap-2">
          <DownloadIcon class="size-4 text-primary" />
          <span class="text-sm font-semibold">Backup y restauración</span>
        </div>
        <p class="text-xs text-muted-foreground">
          Exportá el documento Grist completo (.grist) con todas las tablas, datos y adjuntos.
          Para restaurar, importá un .grist existente: se reemplazarán los datos actuales del documento.
        </p>
        <input
          bind:this={gristFileInput}
          type="file"
          accept=".grist"
          class="hidden"
          onchange={handleGristImport}
        />
        <div class="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onclick={handleExport} disabled={exporting}>
            <DownloadIcon data-icon="inline-start" />
            {exporting ? 'Exportando…' : 'Exportar .grist'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onclick={() => gristFileInput?.click()}
            disabled={importing}
          >
            <UploadIcon data-icon="inline-start" />
            {importing ? 'Importando…' : 'Importar .grist'}
          </Button>
        </div>
        {#if exportResult}
          <div class="text-xs text-muted-foreground rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
            Documento exportado: <strong>{exportResult.filename}</strong>
            ({(exportResult.size / 1024 / 1024).toFixed(2)} MB).
          </div>
        {/if}
        {#if importResult}
          <div class="text-xs text-muted-foreground rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
            Importación completada: <strong>{importResult.recordCount}</strong> registros
            en <strong>{importResult.tableCount}</strong> tablas.
          </div>
        {/if}
      </div>
    {/if}

    {#if store.dedupResult}
      <Separator />
      <div class="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
        <div class="text-sm font-semibold">Deduplicación completada</div>
        <ul class="mt-2 ml-4 list-disc text-sm text-muted-foreground">
          <li>Duplicados encontrados: <strong>{store.dedupResult.duplicatesFound}</strong></li>
          <li>Campos fusionados: <strong>{store.dedupResult.merged}</strong></li>
          <li>Personas eliminadas: <strong>{store.dedupResult.removed}</strong></li>
        </ul>
      </div>
    {/if}

    {#if store.repairResult}
      <Separator />
      <div class="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
        <div class="text-sm font-semibold">Schema reparado</div>
        <ul class="mt-2 ml-4 list-disc text-sm text-muted-foreground">
          <li>Tablas creadas: <strong>{store.repairResult.created}</strong></li>
          <li>Columnas agregadas: <strong>{store.repairResult.addedColumns}</strong></li>
          <li>Refs corregidas: <strong>{store.repairResult.repairedRefs}</strong></li>
          <li>Columnas migradas a fórmula: <strong>{store.repairResult.migratedFormulas}</strong></li>
        </ul>
      </div>
    {/if}
  </Card.Content>
</Card.Root>

<ConfirmDialog
  bind:open={confirm.open}
  title={confirm.title}
  description={confirm.description}
  confirmLabel={confirm.confirmLabel}
  variant={confirm.variant}
  busy={store.migrating}
  onConfirm={confirm.handleConfirm}
/>
