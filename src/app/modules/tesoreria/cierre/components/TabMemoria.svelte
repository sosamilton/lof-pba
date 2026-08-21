<script>
  import { Button } from '$lib/components/ui/button'
  import { Badge } from '$lib/components/ui/badge'
  import { Textarea } from '$lib/components/ui/textarea'
  import * as Field from '$lib/components/ui/field'
  import * as Select from '$lib/components/ui/select'
  import EmptyState from '$lib/components/EmptyState.svelte'
  import { notifyAfter } from '$core/ui/notify.svelte'
  import { markdownToHtml } from '../../../gobierno/memoria/markdownRenderer.js'
  import { exportMemoriaPdf, exportMemoriaDoc } from '../../../gobierno/memoria/memoriaExport.js'
  import PencilIcon from '@lucide/svelte/icons/pencil'
  import SparklesIcon from '@lucide/svelte/icons/sparkles'
  import SaveIcon from '@lucide/svelte/icons/save'
  import FileTextIcon from '@lucide/svelte/icons/file-text'
  import DownloadIcon from '@lucide/svelte/icons/download'
  import EyeIcon from '@lucide/svelte/icons/eye'
  import CodeIcon from '@lucide/svelte/icons/code'
  import SplitIcon from '@lucide/svelte/icons/columns-2'

  let { store } = $props()

  // Estado local
  let memoriaEditando = $state(false)
  let memoriaTextoLocal = $state('')
  let memoriaEstadoLocal = $state('borrador')
  let exportando = $state(false)
  // Modo de edición: 'split' (editor + preview) o 'code' (solo editor)
  let modoEdicion = $state('split')

  // HTML renderizado para el visor
  let memoriaHtml = $derived.by(() => {
    const texto = memoriaEditando ? memoriaTextoLocal : store.memoriaTexto
    return markdownToHtml(texto)
  })

  const nombreArchivo = $derived.by(() => {
    const ej = store.ejercicioSeleccionado
    if (!ej) return 'memoria'
    return `memoria_${ej.anio_inicio}-${ej.anio_fin}`
  })

  const iniciarEdicion = () => {
    memoriaTextoLocal = store.memoriaTexto || ''
    memoriaEstadoLocal = store.memoriaEstado || 'borrador'
    memoriaEditando = true
  }

  const generarBorrador = () => {
    memoriaTextoLocal = store.generarMemoria()
    memoriaEstadoLocal = 'borrador'
  }

  const guardar = () => {
    notifyAfter(store, async () => {
      const ok = await store.guardarMemoria(memoriaTextoLocal, memoriaEstadoLocal)
      if (ok) memoriaEditando = false
    })
  }

  const cancelar = () => { memoriaEditando = false }

  const handleExportPdf = async () => {
    exportando = true
    try {
      const texto = memoriaEditando ? memoriaTextoLocal : store.memoriaTexto
      await exportMemoriaPdf(texto, `${nombreArchivo}.pdf`)
    } catch (e) {
      console.error('Error exportando PDF:', e)
    } finally {
      exportando = false
    }
  }

  const handleExportDoc = () => {
    const texto = memoriaEditando ? memoriaTextoLocal : store.memoriaTexto
    exportMemoriaDoc(texto, `${nombreArchivo}.doc`)
  }

  const estadoVariant = (e) => {
    if (e === 'aprobada') return 'default'
    if (e === 'rechazada') return 'destructive'
    return 'secondary'
  }

  const estadoLabel = (e) => {
    if (e === 'aprobada') return 'Aprobada'
    if (e === 'rechazada') return 'Rechazada'
    return 'Borrador'
  }
</script>

<div class="flex flex-col gap-4">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div>
      <h3 class="text-base font-bold">Memoria anual</h3>
      <p class="text-xs text-muted-foreground">
        Texto narrativo de las actividades del ejercicio. Se presenta en la AGO y se eleva a la Dirección de Cooperación Escolar.
      </p>
    </div>
    <div class="flex items-center gap-2">
      {#if store.memoriaEstado}
        <Badge variant={estadoVariant(store.memoriaEstado)}>
          {estadoLabel(store.memoriaEstado)}
        </Badge>
      {/if}
      {#if store.hechosRelevantes.length > 0}
        <Badge variant="outline" class="text-[10px]">
          {store.hechosRelevantes.length} hechos
        </Badge>
      {/if}
    </div>
  </div>

  {#if memoriaEditando}
    <!-- Modo edición -->
    <div class="flex flex-col gap-3">
      <!-- Toolbar -->
      <div class="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onclick={generarBorrador} disabled={store.busy}>
          <SparklesIcon data-icon="inline-start" />
          Generar borrador
        </Button>
        {#if store.hechosRelevantes.length === 0}
          <span class="text-xs text-amber-600 dark:text-amber-400">
            No hay hechos relevantes cargados para este ejercicio. El borrador será básico.
          </span>
        {/if}
        <div class="ml-auto flex gap-1">
          <Button
            variant={modoEdicion === 'split' ? 'default' : 'outline'}
            size="sm"
            class="h-7"
            onclick={() => modoEdicion = 'split'}
            aria-label="Editor + preview"
          >
            <SplitIcon class="size-3.5" />
          </Button>
          <Button
            variant={modoEdicion === 'code' ? 'default' : 'outline'}
            size="sm"
            class="h-7"
            onclick={() => modoEdicion = 'code'}
            aria-label="Solo editor"
          >
            <CodeIcon class="size-3.5" />
          </Button>
        </div>
      </div>

      <!-- Estado -->
      <Field.Field>
        <Field.FieldLabel for="memoria-estado-edit" class="text-xs">Estado</Field.FieldLabel>
        <Select.Root type="single" bind:value={memoriaEstadoLocal}>
          <Select.Trigger id="memoria-estado-edit" class="h-8 text-sm w-40">
            <Select.Value />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="borrador">Borrador</Select.Item>
            <Select.Item value="aprobada">Aprobada</Select.Item>
            <Select.Item value="rechazada">Rechazada</Select.Item>
          </Select.Content>
        </Select.Root>
      </Field.Field>

      <!-- Editor: split o code -->
      {#if modoEdicion === 'split'}
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div class="flex flex-col gap-1">
            <span class="text-xs text-muted-foreground flex items-center gap-1">
              <CodeIcon class="size-3" /> Editor (markdown)
            </span>
            <Textarea
              bind:value={memoriaTextoLocal}
              class="font-mono text-xs"
              rows="24"
              placeholder="Escribí o generá el texto de la Memoria en markdown…"
            />
          </div>
          <div class="flex flex-col gap-1">
            <span class="text-xs text-muted-foreground flex items-center gap-1">
              <EyeIcon class="size-3" /> Vista previa
            </span>
            <div class="rounded-lg border border-border bg-card p-4 h-full max-h-[60vh] overflow-y-auto">
              <div class="prose-memoria">
                {@html memoriaHtml}
              </div>
            </div>
          </div>
        </div>
      {:else}
        <Textarea
          bind:value={memoriaTextoLocal}
          class="font-mono text-xs"
          rows="28"
          placeholder="Escribí o generá el texto de la Memoria en markdown…"
        />
      {/if}

      <!-- Acciones -->
      <div class="flex flex-wrap gap-2">
        <Button size="sm" onclick={guardar} disabled={store.busy}>
          <SaveIcon data-icon="inline-start" />
          Guardar Memoria
        </Button>
        <Button variant="outline" size="sm" onclick={cancelar}>Cancelar</Button>
        <div class="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onclick={handleExportPdf} disabled={exportando}>
            <DownloadIcon data-icon="inline-start" />
            {exportando ? 'Generando…' : 'PDF'}
          </Button>
          <Button variant="outline" size="sm" onclick={handleExportDoc}>
            <FileTextIcon data-icon="inline-start" />
            DOC
          </Button>
        </div>
      </div>
    </div>
  {:else}
    <!-- Modo lectura -->
    {#if store.memoriaTexto}
      <div class="rounded-lg border border-border bg-card p-6 max-h-[60vh] overflow-y-auto">
        <div class="prose-memoria">
          {@html memoriaHtml}
        </div>
      </div>
      <div class="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onclick={iniciarEdicion}>
          <PencilIcon data-icon="inline-start" />
          Editar
        </Button>
        <Button variant="outline" size="sm" onclick={handleExportPdf} disabled={exportando}>
          <DownloadIcon data-icon="inline-start" />
          {exportando ? 'Generando…' : 'Exportar PDF'}
        </Button>
        <Button variant="outline" size="sm" onclick={handleExportDoc}>
          <FileTextIcon data-icon="inline-start" />
          Exportar DOC
        </Button>
      </div>
    {:else}
      <EmptyState
        title="No hay Memoria cargada"
        sub="Generá un borrador automático desde los hechos relevantes del ejercicio o escribí la Memoria manualmente."
        actionLabel="Redactar Memoria"
        onaction={iniciarEdicion}
      >
        {#snippet actionIcon()}
          <SparklesIcon data-icon="inline-start" />
        {/snippet}
      </EmptyState>
    {/if}
  {/if}
</div>

<style>
  :global(.prose-memoria h1) {
    font-size: 1.1rem; font-weight: 700;
    margin-top: 1.2em; margin-bottom: 0.4em;
    color: hsl(var(--foreground));
  }
  :global(.prose-memoria h2) {
    font-size: 0.95rem; font-weight: 700;
    margin-top: 1em; margin-bottom: 0.3em;
    color: hsl(var(--foreground));
  }
  :global(.prose-memoria h3) {
    font-size: 0.85rem; font-weight: 600;
    margin-top: 0.8em; margin-bottom: 0.2em;
  }
  :global(.prose-memoria p) {
    font-size: 0.8rem; line-height: 1.6;
    margin: 0.3em 0; color: hsl(var(--muted-foreground));
  }
  :global(.prose-memoria ul) {
    margin-left: 1.2em; margin-top: 0.2em; margin-bottom: 0.4em;
    list-style-type: disc;
  }
  :global(.prose-memoria li) {
    font-size: 0.8rem; line-height: 1.5;
    margin-bottom: 0.15em; color: hsl(var(--muted-foreground));
  }
  :global(.prose-memoria hr) {
    border: none; border-top: 1px solid hsl(var(--border));
    margin: 0.8em 0;
  }
  :global(.prose-memoria strong) {
    font-weight: 600; color: hsl(var(--foreground));
  }
  :global(.prose-memoria code) {
    font-family: monospace; font-size: 0.75rem;
    background: hsl(var(--muted)); padding: 0.1em 0.3em; border-radius: 3px;
  }
</style>
