<script>
  import * as Dialog from '$lib/components/ui/dialog'
  import * as ScrollArea from '$lib/components/ui/scroll-area'
  import { Badge } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import ExternalLinkIcon from '@lucide/svelte/icons/external-link'
  import GitBranchIcon from '@lucide/svelte/icons/git-branch'
  import LoaderIcon from '@lucide/svelte/icons/loader-circle'
  import AlertIcon from '@lucide/svelte/icons/triangle-alert'
  import TagIcon from '@lucide/svelte/icons/tag'
  import CalendarIcon from '@lucide/svelte/icons/calendar'

  // Repo canónico de GitHub (el nombre antiguo spa-cooperadora redirige a este).
  const REPO = 'sosamilton/lof-pba'
  const PER_PAGE = 2
  const RELEASES_URL = `https://github.com/${REPO}/releases`

  let { open = false, onClose } = $props()

  // Carga paginada: fetchea de a PER_PAGE releases y va sumando a medida que
  // el usuario hace scroll. La API pública de GitHub limita a 60 req/hora sin
  // auth, así que paginamos chico y cacheamos a nivel módulo entre aperturas.
  let releases = $state(null)
  let loading = $state(false)
  let loadingMore = $state(false)
  let error = $state(null)
  let page = 0
  let hasMore = $state(true)
  let fetched = false
  let viewportEl = $state(null)

  const formatDate = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const fetchPage = async (p) => {
    const url = `https://api.github.com/repos/${REPO}/releases?per_page=${PER_PAGE}&page=${p}`
    const res = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } })
    if (!res.ok) throw new Error(`GitHub respondió ${res.status}`)
    const data = await res.json()
    return Array.isArray(data) ? data : []
  }

  const load = async () => {
    if (fetched || loading) return
    loading = true
    error = null
    try {
      const data = await fetchPage(1)
      releases = data
      page = 1
      hasMore = data.length === PER_PAGE
      fetched = true
    } catch (e) {
      error = e?.message || String(e)
    } finally {
      loading = false
    }
  }

  const loadMore = async () => {
    if (loadingMore || loading || !hasMore || error) return
    loadingMore = true
    try {
      const next = page + 1
      const data = await fetchPage(next)
      releases = [...(releases || []), ...data]
      page = next
      hasMore = data.length === PER_PAGE
    } catch (e) {
      // No fatal: dejamos lo cargado y mostramos el error sutil en el pie.
      error = e?.message || String(e)
    } finally {
      loadingMore = false
    }
  }

  // Carga al abrir (fetch sigue redirects por default, así el nombre viejo
  // del repo también funcionaría).
  $effect(() => {
    if (open) load()
  })

  // Scroll infinito: cuando el viewport llega cerca del final, carga la
  // siguiente página. Se re-atacha si el elemento cambia.
  $effect(() => {
    const el = viewportEl
    if (!el) return
    const onScroll = () => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 160) loadMore()
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  })

  const handleOpenChange = (v) => { if (!v) onClose?.() }

  // --- Renderer markdown liviano (subset de release notes) ---
  // Escapa HTML primero para evitar inyección, luego aplica formato.
  const escapeHtml = (s) =>
    String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const inline = (s) => {
    let out = escapeHtml(s)
    // [text](url) -> <a>
    out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary font-medium underline underline-offset-2 decoration-primary/40 hover:decoration-primary">$1</a>')
    // `code`
    out = out.replace(/`([^`]+)`/g, '<code class="rounded bg-muted px-1.5 py-0.5 text-[0.82em] font-mono text-foreground/80">$1</code>')
    // **bold** (antes que *italic* para no pisar)
    out = out.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
    // *italic* / _italic_
    out = out.replace(/(?<!\w)[*_]([^*_]+)[*_](?!\w)/g, '<em>$1</em>')
    return out
  }

  const renderMd = (md) => {
    if (!md) return ''
    const lines = String(md).split('\n')
    const html = []
    let i = 0
    let listType = null // 'ul' | 'ol'
    const closeList = () => { if (listType) { html.push(`</${listType}>`); listType = null } }
    let para = []

    const flushPara = () => {
      if (para.length) {
        html.push(`<p class="my-1.5 text-sm text-muted-foreground leading-relaxed">${para.map(inline).join('<br />')}</p>`)
        para = []
      }
    }

    while (i < lines.length) {
      const trimmed = lines[i].trim()

      if (trimmed === '') {
        closeList()
        flushPara()
        i++
        continue
      }

      // Regla horizontal
      if (/^(---|\*\*\*|___)$/.test(trimmed)) {
        closeList()
        flushPara()
        html.push('<hr class="my-4 border-border" />')
        i++
        continue
      }

      // Blockquote (> ...)
      const bq = trimmed.match(/^>\s?(.*)$/)
      if (bq) {
        closeList()
        flushPara()
        html.push(`<blockquote class="my-2 border-l-2 border-l-primary/40 bg-primary/5 rounded-r-md px-3 py-2 text-sm text-muted-foreground italic">${inline(bq[1])}</blockquote>`)
        i++
        continue
      }

      // Headings
      const h = trimmed.match(/^(#{1,4})\s+(.*)$/)
      if (h) {
        closeList()
        flushPara()
        const level = h[1].length
        const cls = level <= 2
          ? 'text-sm font-semibold mt-4 mb-1.5 text-foreground'
          : level === 3
            ? 'text-sm font-semibold mt-3 mb-1 text-foreground/90'
            : 'text-xs font-semibold mt-2.5 mb-1 text-muted-foreground uppercase tracking-wide'
        html.push(`<h${level} class="${cls}">${inline(h[2])}</h${level}>`)
        i++
        continue
      }

      // Lista desordenada
      const ul = trimmed.match(/^[-*+]\s+(.*)$/)
      if (ul) {
        flushPara()
        if (listType !== 'ul') { closeList(); html.push('<ul class="ml-1 mt-1.5 mb-1 space-y-1">'); listType = 'ul' }
        html.push(`<li class="flex gap-2 text-sm text-muted-foreground leading-relaxed"><span class="mt-2 size-1.5 shrink-0 rounded-full bg-primary/50"></span><span>${inline(ul[1])}</span></li>`)
        i++
        continue
      }

      // Lista ordenada
      const ol = trimmed.match(/^\d+\.\s+(.*)$/)
      if (ol) {
        flushPara()
        if (listType !== 'ol') { closeList(); html.push('<ol class="ml-1 mt-1.5 mb-1 space-y-1 list-decimal marker:text-muted-foreground/60">'); listType = 'ol' }
        html.push(`<li class="pl-1 text-sm text-muted-foreground leading-relaxed">${inline(ol[1])}</li>`)
        i++
        continue
      }

      // Línea de texto -> párrafo
      closeList()
      para.push(trimmed)
      i++
    }
    closeList()
    flushPara()
    return html.join('\n')
  }
</script>

<Dialog.Root {open} onOpenChange={handleOpenChange}>
  <Dialog.Content class="sm:max-w-2xl">
    <Dialog.Header>
      <Dialog.Title class="flex items-center gap-2">
        <GitBranchIcon class="size-4" />
        Historial de versiones
      </Dialog.Title>
      <Dialog.Description class="text-xs">
        Novedades y cambios de cada release, desde GitHub ({REPO}).
      </Dialog.Description>
    </Dialog.Header>

    <div class="min-h-0">
      {#if loading}
        <div class="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
          <LoaderIcon class="size-6 animate-spin text-primary/60" />
          <span class="text-xs">Cargando releases…</span>
        </div>
      {:else if error}
        <div class="flex flex-col items-center justify-center gap-3 py-14 text-center">
          <div class="flex size-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertIcon class="size-6 text-destructive" />
          </div>
          <span class="text-sm text-muted-foreground">No se pudieron cargar los releases.</span>
          <span class="text-xs text-muted-foreground/70 font-mono">{error}</span>
          <Button variant="outline" size="sm" onclick={load}>Reintentar</Button>
        </div>
      {:else if releases && releases.length === 0}
        <div class="flex flex-col items-center justify-center gap-2 py-14 text-center text-muted-foreground">
          <GitBranchIcon class="size-8 text-muted-foreground/40" />
          <span class="text-sm">Todavía no hay releases publicados.</span>
        </div>
      {:else}
        <ScrollArea.ScrollArea bind:viewportRef={viewportEl} class="h-[60vh] pr-3">
          <div class="flex flex-col gap-4">
            {#each releases as r (r.id)}
              <div class="rounded-lg border border-border border-l-2 border-l-primary/40 p-4 sm:p-5 transition-colors hover:border-l-primary/70">
                <div class="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" class="font-mono gap-1">
                    <TagIcon class="size-3" />
                    {r.tag_name}
                  </Badge>
                  {#if r.prerelease}
                    <Badge variant="outline">pre-release</Badge>
                  {/if}
                  <span class="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <CalendarIcon class="size-3" />
                    {formatDate(r.published_at)}
                  </span>
                </div>
                {#if r.name && r.name !== r.tag_name}
                  <div class="mt-2.5 text-sm font-semibold text-foreground">{r.name}</div>
                {/if}
                {#if r.body}
                  <div class="mt-3 prose-release">
                    {@html renderMd(r.body)}
                  </div>
                {/if}
                <a
                  href={r.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="mt-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
                >
                  <ExternalLinkIcon class="size-3" />
                  Ver en GitHub
                </a>
              </div>
            {/each}

            {#if loadingMore}
              <div class="flex items-center justify-center gap-2 py-4 text-muted-foreground">
                <LoaderIcon class="size-4 animate-spin text-primary/60" />
                <span class="text-xs">Cargando más…</span>
              </div>
            {:else if !hasMore}
              <div class="py-4 text-center text-xs text-muted-foreground/60">
                — No hay más versiones —
              </div>
            {/if}
          </div>
        </ScrollArea.ScrollArea>
      {/if}
    </div>

    <Dialog.Footer class="sm:justify-between">
      <a
        href={RELEASES_URL}
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ExternalLinkIcon class="size-3" />
        Ver todos en GitHub
      </a>
      <Button variant="outline" size="sm" onclick={() => onClose?.()}>Cerrar</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<style>
  .prose-release :global(ul),
  .prose-release :global(ol) {
    list-style: none;
    padding: 0;
  }
  .prose-release :global(ol) {
    list-style: decimal;
    padding-left: 1.25rem;
  }
  .prose-release :global(p) {
    margin: 0.375rem 0;
  }
  .prose-release :global(hr) {
    border: 0;
    border-top: 1px solid hsl(var(--border));
  }
  .prose-release :global(blockquote) {
    margin: 0.5rem 0;
  }
  .prose-release :global(strong) {
    color: hsl(var(--foreground));
  }
  .prose-release :global(code) {
    border: 1px solid hsl(var(--border));
  }
</style>
