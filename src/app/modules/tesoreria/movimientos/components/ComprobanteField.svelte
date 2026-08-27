<script>
  import { Button } from '$lib/components/ui/button'
  import { Badge } from '$lib/components/ui/badge'
  import {
    uploadAttachments,
    getAttachmentMetadata,
    getAttachmentUrl,
  } from '$core/data/dataRepository'
  import UploadIcon from '@lucide/svelte/icons/upload'
  import PaperclipIcon from '@lucide/svelte/icons/paperclip'
  import TrashIcon from '@lucide/svelte/icons/trash-2'
  import LoaderIcon from '@lucide/svelte/icons/loader-circle'
  import DownloadIcon from '@lucide/svelte/icons/download'

  let {
    attachmentIds = [],
    onchange = () => {},
    disabled = false,
  } = $props()

  let uploading = $state(false)
  let error = $state('')
  let fileInput = $state(null)
  let metadataCache = $state(new Map())

  // Cargar metadata para los attachments actuales (nombre, tamaño)
  $effect(() => {
    const ids = [...attachmentIds]
    for (const id of ids) {
      if (metadataCache.has(id)) continue
      getAttachmentMetadata(id).then((m) => {
        metadataCache = new Map(metadataCache).set(id, m)
      }).catch(() => {})
    }
  })

  const handleFileSelect = async (/** @type {Event} */ e) => {
    const input = /** @type {HTMLInputElement} */ (e.target)
    const files = Array.from(input.files || [])
    if (files.length === 0) return
    uploading = true
    error = ''
    try {
      const ids = await uploadAttachments(files)
      onchange([...attachmentIds, ...ids])
    } catch (err) {
      error = err?.message || String(err)
    } finally {
      uploading = false
      input.value = ''
    }
  }

  const removeAttachment = (/** @type {number} */ id) => {
    onchange(attachmentIds.filter((x) => x !== id))
  }

  // Generar URL de descarga con token fresco al hacer click.
  // El token de getAccessToken() expira a los 15 min, así que no podemos
  // cachear la URL al cargar el componente — hay que generarla al momento
  // del click para que el token sea válido.
  const handleDownload = async (/** @type {number} */ id) => {
    try {
      const url = await getAttachmentUrl(id)
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

<div class="flex flex-col gap-2">
  <input
    bind:this={fileInput}
    type="file"
    class="hidden"
    multiple
    onchange={handleFileSelect}
  />

  {#if attachmentIds.length > 0}
    <div class="flex flex-col gap-1">
      {#each attachmentIds as id (id)}
        <div class="flex items-center gap-2 rounded-md border border-border px-2 py-1.5">
          <PaperclipIcon class="size-4 text-muted-foreground shrink-0" />
          <button
            type="button"
            class="flex-1 truncate text-left text-sm hover:underline"
            onclick={() => handleDownload(id)}
            title="Descargar/ver archivo"
          >
            {metadataCache.get(id)?.fileName || `Archivo #${id}`}
          </button>
          {#if metadataCache.get(id)?.fileSize}
            <Badge variant="secondary" class="text-[10px] font-mono shrink-0">
              {formatSize(metadataCache.get(id).fileSize)}
            </Badge>
          {/if}
          <Button
            variant="ghost"
            size="sm"
            class="h-6 w-6 p-0 shrink-0"
            onclick={() => handleDownload(id)}
            aria-label="Descargar archivo"
            title="Descargar/ver"
          >
            <DownloadIcon class="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            class="h-6 w-6 p-0 text-destructive hover:text-destructive shrink-0"
            onclick={() => removeAttachment(id)}
            aria-label="Quitar archivo"
            title="Quitar del movimiento"
          >
            <TrashIcon class="size-3.5" />
          </Button>
        </div>
      {/each}
    </div>
  {/if}

  <Button
    variant="outline"
    size="sm"
    onclick={() => fileInput?.click()}
    disabled={uploading || disabled}
  >
    {#if uploading}
      <LoaderIcon class="size-4 animate-spin" />
      Subiendo…
    {:else}
      <UploadIcon class="size-4" />
      {attachmentIds.length > 0 ? 'Agregar más' : 'Subir comprobante'}
    {/if}
  </Button>

  {#if error}
    <p class="text-xs text-destructive">{error}</p>
  {/if}
</div>
