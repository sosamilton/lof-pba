<script>
  import { Button } from '$lib/components/ui/button'
  import { Badge } from '$lib/components/ui/badge'
  import * as Card from '$lib/components/ui/card'
  import { Separator } from '$lib/components/ui/separator'
  import { navigate } from '$core/ui/router.svelte'
  import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left'
  import ExternalLinkIcon from '@lucide/svelte/icons/external-link'
  import CodeXmlIcon from '@lucide/svelte/icons/code-xml'
  import LanguagesIcon from '@lucide/svelte/icons/languages'
  import SparklesIcon from '@lucide/svelte/icons/sparkles'
  import HeartHandshakeIcon from '@lucide/svelte/icons/heart-handshake'
  import DatabaseIcon from '@lucide/svelte/icons/database'
  import AccessibilityIcon from '@lucide/svelte/icons/accessibility'
  import EyeIcon from '@lucide/svelte/icons/eye'
  import FlagIcon from '@lucide/svelte/icons/flag'
  import UsersIcon from '@lucide/svelte/icons/users'
  import ShieldIcon from '@lucide/svelte/icons/shield'
  import BuildingIcon from '@lucide/svelte/icons/building'
  import GraduationCapIcon from '@lucide/svelte/icons/graduation-cap'
  import HandHeartIcon from '@lucide/svelte/icons/hand-heart'
  import LightbulbIcon from '@lucide/svelte/icons/lightbulb'
  import { identidad } from '$core/data/identidad'
  import data from './landing.json'

  const { principios } = data
  const enlaces = identidad.enlaces

  const iconMap = {
    database: DatabaseIcon,
    accessibility: AccessibilityIcon,
    eye: EyeIcon,
    flag: FlagIcon,
    users: UsersIcon,
    shield: ShieldIcon,
    building: BuildingIcon,
  }
</script>

<main class="min-h-screen bg-background text-foreground">
  <!-- NAVBAR -->
  <nav class="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
    <div class="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
      <div class="flex items-center gap-2">
        <HeartHandshakeIcon class="size-7 text-primary" />
        <span class="text-lg font-bold tracking-tight">{identidad.nombre}</span>
        <Badge variant="secondary" class="hidden sm:inline-flex">{identidad.ubicacion}</Badge>
      </div>
      <Button variant="ghost" size="sm" onclick={() => navigate('inicio')}>
        <ArrowLeftIcon data-icon="inline-start" />
        Volver
      </Button>
    </div>
  </nav>

  <!-- HEADER -->
  <section class="border-b border-border bg-gradient-to-br from-primary/10 via-transparent to-chart-2/5">
    <div class="mx-auto max-w-5xl px-4 py-12">
      <div class="flex flex-col gap-3">
        <div class="flex items-center gap-3">
          <HeartHandshakeIcon class="size-14 text-primary" />
          <div class="flex flex-col">
            <span class="text-2xl font-bold leading-none tracking-tight sm:text-3xl">{identidad.nombre}</span>
            <span class="text-sm font-medium text-primary sm:text-base">{identidad.lema}</span>
          </div>
        </div>
        <h1 class="text-2xl font-bold leading-tight tracking-tight sm:text-3xl md:text-4xl">
          Sobre LOF
        </h1>
        <p class="max-w-2xl text-base text-muted-foreground sm:text-lg">
          Por qué existe esta herramienta, qué significa su nombre y quién la construye.
        </p>
      </div>
    </div>
  </section>

  <!-- POR QUÉ EXISTE: la historia -->
  <section class="mx-auto max-w-5xl px-4 py-12" aria-labelledby="historia-heading">
    <div class="flex flex-col gap-2 mb-6">
      <h2 id="historia-heading" class="text-2xl font-bold tracking-tight">Por qué existe LOF</h2>
      <p class="text-sm text-muted-foreground max-w-prose">
        La historia detrás de una herramienta que nació en el maternal.
      </p>
    </div>

    <div class="flex flex-col gap-5">
      <!-- El origen -->
      <div class="flex items-start gap-4 p-5 rounded-xl border border-border bg-muted/5">
        <div class="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
          <GraduationCapIcon class="size-5" />
        </div>
        <div class="flex flex-col gap-2">
          <h3 class="text-base font-bold">El punto de partida</h3>
          <p class="text-sm text-muted-foreground leading-relaxed">
            Todo empezó cuando fui padre. En el maternal vi de cerca lo difícil que es construir y sostener la participación de la comunidad, atravesada por una carga administrativa que abruma. La educación pública —sobre todo cuando gobiernos que la desfinancian y la postergan— necesita del apoyo y el sostén comunitario como forma de resistencia, para garantizar un mejor futuro.
          </p>
        </div>
      </div>

      <!-- La construcción colectiva -->
      <div class="flex items-start gap-4 p-5 rounded-xl border border-border bg-muted/5">
        <div class="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
          <HandHeartIcon class="size-5" />
        </div>
        <div class="flex flex-col gap-2">
          <h3 class="text-base font-bold">No es de una sola persona</h3>
          <p class="text-sm text-muted-foreground leading-relaxed">
            Esa motivación fue el origen, pero la herramienta no existiría sin los docentes, directivos y familias que pusieron tiempo, compromiso y visión para pensarla, mejorarla y hacerla útil. Se construye desde el territorio, con una lógica colaborativa, soberana y autogestiva.
          </p>
        </div>
      </div>

      <!-- La visión a futuro -->
      <div class="flex items-start gap-4 p-5 rounded-xl border border-border bg-muted/5">
        <div class="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
          <LightbulbIcon class="size-5" />
        </div>
        <div class="flex flex-col gap-2">
          <h3 class="text-base font-bold">La visión</h3>
          <p class="text-sm text-muted-foreground leading-relaxed">
            Ojalá esta herramienta siga creciendo hasta simplificar todo lo administrativo, para que la gestión pase a un segundo plano y la participación comunitaria ocupe el primero. Tecnología al servicio de las personas: para complementar, asistir y aliviar los procesos más tediosos que impiden construir lazos y reorientan las prioridades.
          </p>
          <blockquote class="border-l-2 border-primary/40 pl-3 text-sm font-medium text-foreground italic mt-1">
            Si la tecnología no sirve para tener más tiempo en construir lazos humanos, simplificando los procesos administrativos y burocráticos, no sirve para nada.
          </blockquote>
        </div>
      </div>
    </div>
  </section>

  <!-- IDENTIDAD: el nombre y su origen -->
  <section class="mx-auto max-w-5xl px-4 py-12" aria-labelledby="identidad-heading">
    <div class="flex flex-col gap-2 mb-6">
      <h2 id="identidad-heading" class="text-2xl font-bold tracking-tight">El nombre y su origen</h2>
      <p class="text-sm text-muted-foreground max-w-prose">
        Una palabra del mapudungun que designa una comunidad organizada.
      </p>
    </div>

    <div class="grid gap-4 sm:grid-cols-3">
      <!-- Origen del nombre -->
      <Card.Root>
        <Card.Header>
          <div class="flex items-center gap-3">
            <div class="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <LanguagesIcon class="size-5" />
            </div>
            <Card.Title class="text-base">Origen del nombre</Card.Title>
          </div>
        </Card.Header>
        <Card.Content class="flex flex-col gap-2">
          <p class="text-sm text-muted-foreground">
            <strong class="text-foreground">LOF</strong> es una palabra del <strong class="text-foreground">mapudungun</strong> que designa una <em>comunidad organizada</em>: la unidad social y territorial formada por familias que comparten responsabilidades, decisiones y un proyecto común.
          </p>
          <p class="text-sm text-muted-foreground">
            Una cooperadora escolar no es solo una asociación que administra recursos: es una comunidad que sostiene colectivamente la escuela pública.
          </p>
        </Card.Content>
      </Card.Root>

      <!-- La interpretación como identidad del sistema -->
      <Card.Root>
        <Card.Header>
          <div class="flex items-center gap-3">
            <div class="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <SparklesIcon class="size-5" />
            </div>
            <Card.Title class="text-base">La interpretación</Card.Title>
          </div>
        </Card.Header>
        <Card.Content class="flex flex-col gap-2">
          <blockquote class="border-l-2 border-primary/40 pl-3 text-sm font-medium text-foreground">
            {identidad.lema}
          </blockquote>
          <p class="text-sm text-muted-foreground">
            No es un acrónimo oficial, sino una interpretación: la forma en que una comunidad <strong class="text-foreground">defiende y cuida la educación pública</strong> — organizándose, fortaleciendo sus vínculos y conservando su memoria institucional.
          </p>
        </Card.Content>
      </Card.Root>

      <!-- Quién lo genera -->
      <Card.Root>
        <Card.Header>
          <div class="flex items-center gap-3">
            <div class="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <HeartHandshakeIcon class="size-5" />
            </div>
            <Card.Title class="text-base">Quién lo genera</Card.Title>
          </div>
        </Card.Header>
        <Card.Content class="flex flex-col gap-2">
          <p class="text-sm text-muted-foreground">
            LOF es software libre (<strong class="text-foreground">{identidad.licencia}</strong>) desarrollado por <strong class="text-foreground">Milton Sosa</strong> y abierto a la comunidad: auditable, modificable y ejecutable en infraestructura propia.
          </p>
          <Button variant="outline" size="sm" class="w-fit" href={enlaces.repo} target="_blank" rel="noopener noreferrer">
            <CodeXmlIcon data-icon="inline-start" />
            Ver repositorio
            <ExternalLinkIcon data-icon="inline-end" />
          </Button>
        </Card.Content>
      </Card.Root>
    </div>
  </section>

  <Separator />

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

  <!-- FOOTER -->
  <footer class="border-t border-border">
    <div class="mx-auto max-w-5xl px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
      <div class="flex items-center gap-2">
        <HeartHandshakeIcon class="size-6 text-primary" />
        <span class="text-sm font-medium">{identidad.nombre} · {identidad.lema}</span>
      </div>
      <Button variant="outline" size="sm" onclick={() => navigate('inicio')}>
        <ArrowLeftIcon data-icon="inline-start" />
        Volver al inicio
      </Button>
    </div>
  </footer>
</main>
