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
  import RocketIcon from '@lucide/svelte/icons/rocket'

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
    rocket: RocketIcon,
  }

  const ROADMAP_GROUPS = {
    proximo: { label: 'Próximo', variant: 'default' },
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
  import { navigate } from '$core/router.svelte'
  import CodeXmlIcon from '@lucide/svelte/icons/code-xml'
  import ExternalLinkIcon from '@lucide/svelte/icons/external-link'
  import HeartHandshakeIcon from '@lucide/svelte/icons/heart-handshake'
  import ImageIcon from '@lucide/svelte/icons/image'
  import MapPinIcon from '@lucide/svelte/icons/map-pin'
  import CheckCircleIcon from '@lucide/svelte/icons/circle-check'
  import DownloadIcon from '@lucide/svelte/icons/download'
  import GristIcon from '$lib/components/GristIcon.svelte'
  import data from './landing.json'

  const { identidad, principios, funciones, capturas, roadmap } = data
  const enlaces = identidad.enlaces

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
        <img src="./logo.svg" alt="{identidad.nombre}" class="size-7" />
        <span class="text-lg font-bold tracking-tight">{identidad.nombre}</span>
        <Badge variant="secondary" class="hidden sm:inline-flex">{identidad.ubicacion}</Badge>
      </div>
      <div class="flex items-center gap-2">
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
          <img src="./logo.svg" alt="{identidad.nombre}" class="size-16" />
          <Badge class="w-fit" variant="outline">
            <MapPinIcon data-icon="inline-start" />
            {identidad.ubicacion}
          </Badge>
          <h1 class="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            {identidad.slogan}
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
          Software libre bajo AGPL-3.0. Funciona con Grist, una plataforma de datos libre y autoinstalable.
        </p>
      </div>
    </div>
  </section>

  <!-- PRINCIPIOS -->
  <section class="mx-auto max-w-5xl px-4 py-12" aria-labelledby="principios-heading">
    <div class="flex flex-col gap-2 mb-6">
      <h2 id="principios-heading" class="text-2xl font-bold tracking-tight">Nuestros principios</h2>
      <p class="text-sm text-muted-foreground max-w-prose">
        Los que guían cada decisión de diseño y desarrollo de esta herramienta.
      </p>
    </div>
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {#each principios as p}
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

  <Separator />

  <!-- FUNCIONES -->
  <section class="mx-auto max-w-5xl px-4 py-12" aria-labelledby="funciones-heading">
    <div class="flex flex-col gap-2 mb-6">
      <h2 id="funciones-heading" class="text-2xl font-bold tracking-tight">Qué podés hacer hoy</h2>
      <p class="text-sm text-muted-foreground max-w-prose">
        Cuatro módulos pensados para la gestión diaria de tu cooperadora escolar.
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
        Menos planillas, más trazabilidad. Esto es lo que estamos construyendo.
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

  <!-- FOOTER -->
  <footer class="border-t border-border bg-card">
    <div class="mx-auto max-w-5xl px-4 py-8">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div class="flex flex-col gap-1">
        <div class="flex items-center gap-2">
            <HeartHandshakeIcon class="size-5 text-primary" />
            <span class="font-bold">{identidad.nombre}</span>
          </div>
          <p class="text-sm text-muted-foreground max-w-prose">
            Tecnología al servicio del pueblo organizado. {identidad.licencia}.
          </p>
        </div>
        <div class="flex flex-wrap gap-3">
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
