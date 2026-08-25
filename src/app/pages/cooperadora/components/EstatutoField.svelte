<script>
  import { Button } from '$lib/components/ui/button'
  import { Badge } from '$lib/components/ui/badge'
  import * as Alert from '$lib/components/ui/alert'
  import {
    uploadAttachments,
    getAttachmentMetadata,
    getAttachmentUrl,
  } from '$core/data/dataRepository'
  import UploadIcon from '@lucide/svelte/icons/upload'
  import FileTextIcon from '@lucide/svelte/icons/file-text'
  import TrashIcon from '@lucide/svelte/icons/trash-2'
  import LoaderIcon from '@lucide/svelte/icons/loader-circle'
  import DownloadIcon from '@lucide/svelte/icons/download'
  import LockIcon from '@lucide/svelte/icons/lock'
  import CheckCircleIcon from '@lucide/svelte/icons/circle-check'

  let {
    attachmentId = null,
    validado = false,
    busy = false,
    onchange = () => {},
    onValidar = () => {},
  } = $props()

  let uploading = $state(false)
  let error = $state('')
  let fileInput = $state(null)
  let metadata = $state(null)

  // Cargar metadata del attachment actual
  $effect(() => {
    const id = attachmentId
    if (!id) { metadata = null; return }
    getAttachmentMetadata(id).then((m) => { metadata = m }).catch(() => {})
  })

  const handleFileSelect = async (/** @type {Event} */ e) => {
    const input = /** @type {HTMLInputElement} */ (e.target)
    const files = Array.from(input.files || [])
    if (files.length === 0) return
    // Validar que sea PDF
    const file = files[0]
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      error = 'El estatuto debe ser un archivo PDF.'
      input.value = ''
      return
    }
    uploading = true
    error = ''
    try {
      const ids = await uploadAttachments([file])
      onchange(ids[0] ?? null)
    } catch (err) {
      error = err?.message || String(err)
    } finally {
      uploading = false
      input.value = ''
    }
  }

  const removeAttachment = () => {
    onchange(null)
    metadata = null
  }

  // Generar URL de descarga con token fresco al hacer click.
  const handleDownload = async () => {
    if (!attachmentId) return
    try {
      const url = await getAttachmentUrl(attachmentId)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (e) {
      error = e?.message || String(e)
    }
  }

  const formatSize = (/** @type {number} */ bytes) => {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }
</script>

<div class="flex flex-col gap-3">
  <input
    bind:this={fileInput}
    type="file"
    class="hidden"
    accept="application/pdf,.pdf"
    onchange={handleFileSelect}
  />

  {#if validado}
    <Alert.Root>
      <CheckCircleIcon data-icon="inline-start" />
      <Alert.Title>Estatuto validado</Alert.Title>
      <Alert.Description>
        El estatuto fue verificado y bloqueado. Para reemplazarlo, pedí a alguien con acceso a Grist que modifique la tabla directamente.
      </Alert.Description>
    </Alert.Root>
  {/if}

  {#if attachmentId}
    <div class="flex items-center gap-2 rounded-md border border-border px-3 py-2">
      <FileTextIcon class="size-5 text-muted-foreground shrink-0" />
      <button
        type="button"
        class="flex-1 truncate text-left text-sm hover:underline"
        onclick={handleDownload}
        title="Descargar/ver estatuto"
      >
        {metadata?.fileName || `Estatuto (archivo #${attachmentId})`}
      </button>
      {#if metadata?.fileSize}
        <Badge variant="secondary" class="text-[10px] font-mono shrink-0">
          {formatSize(metadata.fileSize)}
        </Badge>
      {/if}
      <Button
        variant="ghost"
        size="sm"
        class="h-7 w-7 p-0 shrink-0"
        onclick={handleDownload}
        aria-label="Descargar estatuto"
        title="Descargar/ver"
      >
        <DownloadIcon class="size-4" />
      </Button>
      {#if !validado}
        <Button
          variant="ghost"
          size="sm"
          class="h-7 w-7 p-0 text-destructive hover:text-destructive shrink-0"
          onclick={removeAttachment}
          aria-label="Quitar estatuto"
          title="Quitar estatuto"
        >
          <TrashIcon class="size-4" />
        </Button>
      {/if}
    </div>
  {:else}
    <div class="rounded-md border border-dashed border-border p-6 text-center">
      <FileTextIcon class="size-8 mx-auto text-muted-foreground mb-2" />
      <p class="text-sm text-muted-foreground mb-3">
        No hay estatuto cargado. Subí el PDF del estatuto de la cooperadora.
      </p>
    </div>
  {/if}

  {#if !validado}
    <div class="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onclick={() => fileInput?.click()}
        disabled={uploading || busy}
      >
        {#if uploading}
          <LoaderIcon class="size-4 animate-spin" />
          Subiendo…
        {:else if attachmentId}
          <UploadIcon class="size-4" />
          Reemplazar
        {:else}
          <UploadIcon class="size-4" />
          Subir estatuto (PDF)
        {/if}
      </Button>

      {#if attachmentId && !validado}
        <Button
          variant="default"
          size="sm"
          onclick={onValidar}
          disabled={busy}
        >
          <LockIcon data-icon="inline-start" />
          Validar y bloquear
        </Button>
      {/if}
    </div>
  {/if}

  {#if error}
    <p class="text-xs text-destructive">{error}</p>
  {/if}
</div>
