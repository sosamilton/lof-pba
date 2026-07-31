<script>
  import { Button } from '$lib/components/ui/button'
  import * as Card from '$lib/components/ui/card'
  import { Badge } from '$lib/components/ui/badge'
  import { Separator } from '$lib/components/ui/separator'
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
  import CodeXmlIcon from '@lucide/svelte/icons/code-xml'
  import ExternalLinkIcon from '@lucide/svelte/icons/external-link'
  import HeartHandshakeIcon from '@lucide/svelte/icons/heart-handshake'
  import ImageIcon from '@lucide/svelte/icons/image'
  import MapPinIcon from '@lucide/svelte/icons/map-pin'
  import CheckCircleIcon from '@lucide/svelte/icons/circle-check'
  import data from './landing.json'

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

  let { identidad, principios, funciones, capturas, instalacion, roadmap } = data
  const enlaces = identidad.enlaces

  const roadmapGroups = {
    proximo: { label: 'Próximo', variant: 'default', items: [] },
    despues: { label: 'Después', variant: 'secondary', items: [] },
    futuro: { label: 'A futuro', variant: 'outline', items: [] },
  }

  for (const item of roadmap) {
    const key = item.estado
    if (roadmapGroups[key]) roadmapGroups[key].items.push(item)
  }
</script>

<main class="min-h-screen bg-background text-foreground">
  <!-- NAVBAR -->
  <nav class="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
    <div class="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
      <div class="flex items-center gap-2">
        <img src="./logo.svg" alt="{identidad.nombre}" class="size-7" />
        <span class="text-lg font-bold tracking-tight">{identidad.nombre}</span>
        <Badge variant="secondary" class="hidden sm:inline-flex">{identidad.ubicacion}</Badge>
      </div>
      <div class="flex items-center gap-2">
        <Button variant="ghost" size="sm" href={enlaces.repo} target="_blank" rel="noreferrer">
          <CodeXmlIcon data-icon="inline-start" />
          <span class="hidden sm:inline">GitHub</span>
        </Button>
        <Button variant="outline" size="sm" href={enlaces.grist} target="_blank" rel="noreferrer">
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
          <Button size="lg" href={enlaces.app} target="_blank" rel="noreferrer">
            <ExternalLinkIcon data-icon="inline-start" />
            Abrir {identidad.nombre}
          </Button>
          <Button variant="outline" size="lg" href={enlaces.repo} target="_blank" rel="noreferrer">
            <CodeXmlIcon data-icon="inline-start" />
            Ver repo / colaborar
          </Button>
          <Button variant="secondary" size="lg" href={enlaces.grist_docs} target="_blank" rel="noreferrer">
            Cómo instalar
          </Button>
        </div>
        <p class="text-sm text-muted-foreground">
          Corre como Custom Widget dentro de Grist. Acá ves el proyecto, la documentación y lo que viene.
        </p>
      </div>
    </div>
  </section>

  <!-- PRINCIPIOS -->
  <section class="mx-auto max-w-5xl px-4 py-12">
    <div class="flex flex-col gap-2 mb-6">
      <h2 class="text-2xl font-bold tracking-tight">Nuestros principios</h2>
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
              <div class="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {#if Icon}
                  <Icon class="size-5" />
                {/if}
              </div>
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
  <section class="mx-auto max-w-5xl px-4 py-12">
    <div class="flex flex-col gap-2 mb-6">
      <h2 class="text-2xl font-bold tracking-tight">Qué podés hacer hoy</h2>
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
              <div class="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {#if Icon}
                  <Icon class="size-5" />
                {/if}
              </div>
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
    <section class="mx-auto max-w-5xl px-4 py-12">
      <div class="flex flex-col gap-2 mb-6">
        <h2 class="text-2xl font-bold tracking-tight">{capturas.titulo}</h2>
        <p class="text-sm text-muted-foreground max-w-prose">{capturas.subtitulo}</p>
      </div>
      <div class="grid gap-4 sm:grid-cols-2">
        {#each capturas.items as captura}
          <Card.Root class="overflow-hidden">
            <div class="aspect-video bg-muted flex items-center justify-center">
              {#if captura.imagen}
                <img src={captura.imagen} alt={captura.titulo} class="w-full h-full object-cover" />
              {:else}
                <ImageIcon class="size-12 text-muted-foreground/40" />
              {/if}
            </div>
            <Card.Header>
              <Card.Title class="text-sm">{captura.titulo}</Card.Title>
              {#if captura.descripcion}
                <Card.Description>{captura.descripcion}</Card.Description>
              {/if}
            </Card.Header>
          </Card.Root>
        {/each}
      </div>
    </section>

    <Separator />
  {/if}

  <!-- INSTALACIÓN -->
  <section class="mx-auto max-w-5xl px-4 py-12">
    <div class="flex flex-col gap-2 mb-6">
      <h2 class="text-2xl font-bold tracking-tight">{instalacion.titulo}</h2>
      <p class="text-sm text-muted-foreground max-w-prose">{instalacion.subtitulo}</p>
    </div>
    <div class="flex flex-col gap-3">
      {#each instalacion.pasos as paso, i}
        <div class="flex items-start gap-4 rounded-lg border border-border bg-card p-4">
          <div class="flex size-8 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 font-bold text-primary text-sm">
            {i + 1}
          </div>
          <div class="flex flex-col gap-1">
            <div class="font-semibold text-sm">{paso.titulo}</div>
            <div class="text-sm text-muted-foreground">{paso.descripcion}</div>
          </div>
        </div>
      {/each}
    </div>
  </section>

  <Separator />

  <!-- ROADMAP -->
  <section class="mx-auto max-w-5xl px-4 py-12">
    <div class="flex flex-col gap-2 mb-8">
      <h2 class="text-2xl font-bold tracking-tight">Lo que viene</h2>
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
            {identidad.descripcion} Software libre bajo licencia {identidad.licencia}.
          </p>
        </div>
        <div class="flex flex-wrap gap-3">
          <Button variant="ghost" size="sm" href={enlaces.repo} target="_blank" rel="noreferrer">
            <CodeXmlIcon data-icon="inline-start" />
            Contribuir
          </Button>
          <Button variant="ghost" size="sm" href={enlaces.licencia} target="_blank" rel="noreferrer">
            Licencia
          </Button>
          <Button variant="ghost" size="sm" href={enlaces.grist_docs} target="_blank" rel="noreferrer">
            Custom Widgets
          </Button>
        </div>
      </div>
    </div>
  </footer>
</main>
