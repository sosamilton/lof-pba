<script module>
  import DatabaseIcon from '@lucide/svelte/icons/database'
  import AccessibilityIcon from '@lucide/svelte/icons/accessibility'
  import EyeIcon from '@lucide/svelte/icons/eye'
  import FlagIcon from '@lucide/svelte/icons/flag'
  import UsersIcon from '@lucide/svelte/icons/users'
  import ShieldIcon from '@lucide/svelte/icons/shield'
  import BuildingIcon from '@lucide/svelte/icons/building'
  import ArrowLeftRightIcon from '@lucide/svelte/icons/arrow-left-right'
  import GavelIcon from '@lucide/svelte/icons/gavel'

  const iconMap = {
    database: DatabaseIcon,
    accessibility: AccessibilityIcon,
    eye: EyeIcon,
    flag: FlagIcon,
    users: UsersIcon,
    shield: ShieldIcon,
    building: BuildingIcon,
    'arrow-left-right': ArrowLeftRightIcon,
    gavel: GavelIcon,
    'refresh-cw': RefreshCwIcon,
    'book-open': BookOpenIcon,
    'file-text': FileTextIcon,
    wallet: WalletIcon,
  }

  const ROADMAP_GROUPS = {
    hecho: { label: 'Listo', variant: 'default' },
    proximo: { label: 'Próximo', variant: 'secondary' },
    despues: { label: 'Después', variant: 'secondary' },
    futuro: { label: 'A futuro', variant: 'outline' },
  }
</script>

<script>
  import { Button } from '$lib/components/ui/button'
  import * as Card from '$lib/components/ui/card'
  import { Badge } from '$lib/components/ui/badge'
  import { Separator } from '$lib/components/ui/separator'
  import * as Carousel from '$lib/components/ui/carousel'
  import { navigate } from '$core/ui/router.svelte'
  import CodeXmlIcon from '@lucide/svelte/icons/code-xml'
  import ExternalLinkIcon from '@lucide/svelte/icons/external-link'
  import HeartHandshakeIcon from '@lucide/svelte/icons/heart-handshake'
  import ImageIcon from '@lucide/svelte/icons/image'
  import MapPinIcon from '@lucide/svelte/icons/map-pin'
  import CheckCircleIcon from '@lucide/svelte/icons/circle-check'
  import DownloadIcon from '@lucide/svelte/icons/download'
  import ArrowRightIcon from '@lucide/svelte/icons/arrow-right'
  import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw'
  import BookOpenIcon from '@lucide/svelte/icons/book-open'
  import FileTextIcon from '@lucide/svelte/icons/file-text'
  import WalletIcon from '@lucide/svelte/icons/wallet'
  import GristIcon from '$lib/components/GristIcon.svelte'
  import ReleasesDialog from './ReleasesDialog.svelte'
  import HistoryIcon from '@lucide/svelte/icons/history'
  import { identidad } from '$core/data/identidad'
  import data from './landing.json'

  const { problemas, funciones, titulo_seccion, subtitulo_seccion, capturas, roadmap } = data
  const enlaces = identidad.enlaces
  const versionActual = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'
  let showReleases = $state(false)
  const roadmapGroups = $derived(
    Object.fromEntries(
      Object.entries(ROADMAP_GROUPS).map(([key, group]) => [
        key,
        { ...group, items: roadmap.filter((item) => item.estado === key) },
      ])
    )
  )
</script>

<main class="min-h-screen bg-background text-foreground">
  {#snippet iconBadge(/** @type {any} */ Icon)}
    <div class="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
      {#if Icon}
        <Icon class="size-5" />
      {/if}
    </div>
  {/snippet}

  <!-- NAVBAR -->
  <nav class="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm" aria-label="Navegación principal">
    <div class="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
      <div class="flex items-center gap-2">
        <HeartHandshakeIcon class="size-7 text-primary" />
        <span class="text-lg font-bold tracking-tight">{identidad.nombre}</span>
        <Badge variant="secondary" class="hidden sm:inline-flex">{identidad.ubicacion}</Badge>
      </div>
      <div class="flex items-center gap-2">
        {#if versionActual !== 'dev'}
          <button
            type="button"
            onclick={() => (showReleases = true)}
            class="cursor-pointer transition-opacity hover:opacity-80"
            title="Ver historial de versiones"
            aria-label="Ver historial de versiones"
          >
            <Badge variant="secondary" class="font-mono text-[10px]">v{versionActual}</Badge>
          </button>
        {/if}
        <Button variant="ghost" size="sm" onclick={() => (showReleases = true)}>
          <HistoryIcon data-icon="inline-start" />
          <span class="hidden sm:inline">Novedades</span>
        </Button>
        <Button variant="ghost" size="sm" onclick={() => navigate('sobre-lof')}>
          Sobre LOF
        </Button>
        <Button variant="ghost" size="sm" href={enlaces.repo} target="_blank" rel="noopener noreferrer" aria-label="Ver repositorio en GitHub">
          <CodeXmlIcon data-icon="inline-start" />
          <span class="hidden sm:inline">GitHub</span>
        </Button>
        <Button variant="outline" size="sm" href={enlaces.grist} target="_blank" rel="noopener noreferrer" aria-label="Abrir Grist">
          <span class="hidden sm:inline">Grist</span>
          <ExternalLinkIcon data-icon="inline-end" />
        </Button>
      </div>
    </div>
  </nav>

  <!-- HERO -->
  <section class="relative overflow-hidden border-b border-border">
    <div class="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-chart-2/5"></div>
    <div class="relative mx-auto max-w-5xl px-4 py-12 sm:py-16">
      <div class="flex flex-col gap-6">
        <div class="flex flex-col gap-3">
          <div class="flex items-center gap-3">
            <HeartHandshakeIcon class="size-14 text-primary" />
            <div class="flex flex-col">
              <span class="text-2xl font-bold leading-none tracking-tight sm:text-3xl">{identidad.nombre}</span>
              <span class="text-sm font-medium text-primary sm:text-base">{identidad.lema}</span>
            </div>
          </div>
          <Badge class="w-fit" variant="outline">
            <MapPinIcon data-icon="inline-start" />
            {identidad.ubicacion}
          </Badge>
          <h1 class="text-2xl font-bold leading-tight tracking-tight sm:text-3xl md:text-4xl">
            {identidad.apertura}
          </h1>
          <p class="max-w-2xl text-base text-muted-foreground sm:text-lg">
            {identidad.descripcion}
          </p>
        </div>
        <div class="flex flex-wrap gap-3">
          <Button variant="secondary" size="lg" onclick={() => navigate('instalacion')}>
            <DownloadIcon data-icon="inline-start" />
            Guía de instalación
          </Button>
          <Button variant="outline" size="lg" href={enlaces.repo} target="_blank" rel="noopener noreferrer">
            <CodeXmlIcon data-icon="inline-start" />
            Ver repo / colaborar
          </Button>
        </div>
        <p class="text-sm text-muted-foreground">
          Software libre bajo {identidad.licencia}. Funciona con Grist, una plataforma de datos libre y autoinstalable.
        </p>
      </div>
    </div>
  </section>

  <!-- QUÉ RESUELVE: problemas cotidianos de las cooperadoras -->
  <section class="mx-auto max-w-5xl px-4 py-12" aria-labelledby="problemas-heading">
    <div class="flex flex-col gap-2 mb-6">
      <h2 id="problemas-heading" class="text-2xl font-bold tracking-tight">¿Te pasa esto?</h2>
      <p class="text-sm text-muted-foreground max-w-prose">
        Situaciones cotidianas de las cooperadoras escolares que LOF ayuda a resolver.
      </p>
    </div>
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {#each problemas as p}
        {@const Icon = iconMap[p.icono]}
        <Card.Root>
          <Card.Header>
            <div class="flex items-center gap-3">
              {@render iconBadge(Icon)}
              <Card.Title class="text-base">{p.titulo}</Card.Title>
            </div>
          </Card.Header>
          <Card.Content>
            <p class="text-sm text-muted-foreground">{p.descripcion}</p>
          </Card.Content>
        </Card.Root>
      {/each}
    </div>
  </section>

  <!-- FUNCIONES -->
  <section class="mx-auto max-w-5xl px-4 py-12" aria-labelledby="funciones-heading">
    <div class="flex flex-col gap-2 mb-6">
      <h2 id="funciones-heading" class="text-2xl font-bold tracking-tight">{titulo_seccion || 'Cómo te ayuda todos los días'}</h2>
      <p class="text-sm text-muted-foreground max-w-prose">
        {subtitulo_seccion || 'Áreas para la gestión diaria de tu cooperadora, alineadas con el estatuto modelo y la PIA.'}
      </p>
    </div>
    <div class="grid gap-4 sm:grid-cols-2">
      {#each funciones as f}
        {@const Icon = iconMap[f.icono]}
        <Card.Root>
          <Card.Header>
            <div class="flex items-center gap-3">
              {@render iconBadge(Icon)}
              <div class="flex flex-col">
                <Card.Title class="text-base">{f.titulo}</Card.Title>
                <Card.Description>{f.descripcion}</Card.Description>
              </div>
            </div>
          </Card.Header>
          <Card.Content>
            <ul class="flex flex-col gap-2">
              {#each f.items as item}
                <li class="flex items-start gap-2 text-sm text-muted-foreground">
                  <CheckCircleIcon class="mt-0.5 size-4 shrink-0 text-primary" />
                  {item}
                </li>
              {/each}
            </ul>
          </Card.Content>
        </Card.Root>
      {/each}
    </div>
  </section>

  <Separator />

  <!-- CAPTURAS -->
  {#if capturas?.items?.length > 0}
    <section class="mx-auto max-w-5xl px-4 py-12" aria-labelledby="capturas-heading">
      <div class="flex flex-col gap-2 mb-6">
        <h2 id="capturas-heading" class="text-2xl font-bold tracking-tight">{capturas.titulo}</h2>
        <p class="text-sm text-muted-foreground max-w-prose">{capturas.subtitulo}</p>
      </div>
      <Carousel.Root class="w-full" aria-labelledby="capturas-heading">
        <Carousel.Content>
          {#each capturas.items as captura}
            <Carousel.Item>
              <div class="flex flex-col gap-3 p-1">
                <div class="rounded-xl border border-border overflow-hidden bg-muted">
                  {#if captura.imagen}
                    <img src={'./' + captura.imagen} alt={captura.titulo} class="w-full h-auto object-contain" loading="lazy" />
                  {:else}
                    <div class="aspect-video flex items-center justify-center">
                      <ImageIcon class="size-12 text-muted-foreground/40" />
                    </div>
                  {/if}
                </div>
                <div class="flex flex-col gap-1 px-1">
                  <h3 class="text-base font-semibold tracking-tight">{captura.titulo}</h3>
                  {#if captura.descripcion}
                    <p class="text-sm text-muted-foreground">{captura.descripcion}</p>
                  {/if}
                </div>
              </div>
            </Carousel.Item>
          {/each}
        </Carousel.Content>
        <Carousel.Previous />
        <Carousel.Next />
      </Carousel.Root>
    </section>

    <Separator />
  {/if}

  <!-- ROADMAP -->
  <section class="mx-auto max-w-5xl px-4 py-12" aria-labelledby="roadmap-heading">
    <div class="flex flex-col gap-2 mb-8">
      <h2 id="roadmap-heading" class="text-2xl font-bold tracking-tight">Lo que viene</h2>
      <p class="text-sm text-muted-foreground max-w-prose">
        Lo que ya está listo y lo que estamos construyendo. Menos planillas, más trazabilidad.
      </p>
    </div>
    <div class="flex flex-col gap-8">
      {#each Object.entries(roadmapGroups) as [key, group]}
        {#if group.items.length > 0}
          <div class="flex flex-col gap-3">
            <div class="flex items-center gap-2">
              <Badge variant={group.variant}>{group.label}</Badge>
              <div class="h-px flex-1 bg-border"></div>
            </div>
            <div class="grid gap-3 sm:grid-cols-2">
              {#each group.items as item}
                <Card.Root class="gap-2">
                  <Card.Header class="gap-1">
                    <Card.Title class="text-sm">{item.titulo}</Card.Title>
                  </Card.Header>
                  <Card.Content>
                    <p class="text-sm text-muted-foreground">{item.descripcion}</p>
                  </Card.Content>
                </Card.Root>
              {/each}
            </div>
          </div>
        {/if}
      {/each}
    </div>
  </section>

  <!-- INVITACIÓN A "SOBRE LOF" -->
  <section class="mx-auto max-w-5xl px-4 py-10">
    <div class="flex flex-col items-center gap-3 rounded-lg border border-border bg-card/50 px-6 py-8 text-center">
      <p class="text-base text-muted-foreground max-w-prose">
        ¿Te gustó la solución y querés saber <strong class="text-foreground">por qué existe LOF</strong>, qué significa el nombre y qué nos motiva?
      </p>
      <Button variant="outline" onclick={() => navigate('sobre-lof')}>
        Conocer la historia
        <ArrowRightIcon data-icon="inline-end" />
      </Button>
    </div>
  </section>

  <!-- FOOTER -->
  <footer class="border-t border-border bg-card">
    <div class="mx-auto max-w-5xl px-4 py-8">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div class="flex flex-col gap-1">
        <div class="flex items-center gap-2">
            <HeartHandshakeIcon class="size-5 text-primary" />
            <span class="font-bold">{identidad.nombre}</span>
            {#if versionActual !== 'dev'}
              <button
                type="button"
                onclick={() => (showReleases = true)}
                class="cursor-pointer transition-opacity hover:opacity-80"
                title="Ver historial de versiones"
                aria-label="Ver historial de versiones"
              >
                <Badge variant="secondary" class="font-mono text-[10px]">v{versionActual}</Badge>
              </button>
            {/if}
          </div>
          <p class="text-sm text-muted-foreground max-w-prose">
            {identidad.lema}. Software libre bajo {identidad.licencia}.
          </p>
        </div>
        <div class="flex flex-wrap gap-3">
          <Button variant="ghost" size="sm" onclick={() => navigate('sobre-lof')}>
            Sobre LOF
          </Button>
          <Button variant="ghost" size="sm" href={enlaces.repo} target="_blank" rel="noopener noreferrer">
            <CodeXmlIcon data-icon="inline-start" />
            Contribuir
          </Button>
          <Button variant="ghost" size="sm" href={enlaces.licencia} target="_blank" rel="noopener noreferrer">
            Licencia
          </Button>
          <Button variant="ghost" size="sm" href={enlaces.grist_docs} target="_blank" rel="noopener noreferrer">
            <GristIcon class="size-4" data-icon="inline-start" />
            Documentación oficial de widgets
          </Button>
        </div>
      </div>
    </div>
  </footer>
</main>

<ReleasesDialog open={showReleases} onClose={() => (showReleases = false)} />
