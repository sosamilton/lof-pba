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
  import { getActiveBackend } from '$core/data/dataRepository'
  import { trackEvent } from '$core/analytics/plausible.js'
  import CodeXmlIcon from '@lucide/svelte/icons/code-xml'
  import ExternalLinkIcon from '@lucide/svelte/icons/external-link'
  import HeartHandshakeIcon from '@lucide/svelte/icons/heart-handshake'
  import ImageIcon from '@lucide/svelte/icons/image'
  import MapPinIcon from '@lucide/svelte/icons/map-pin'
  import CheckCircleIcon from '@lucide/svelte/icons/circle-check'
  import DownloadIcon from '@lucide/svelte/icons/download'
  import ArrowRightIcon from '@lucide/svelte/icons/arrow-right'
  import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left'
  import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw'
  import BookOpenIcon from '@lucide/svelte/icons/book-open'
  import FileTextIcon from '@lucide/svelte/icons/file-text'
  import WalletIcon from '@lucide/svelte/icons/wallet'
  import GristIcon from '$lib/components/GristIcon.svelte'
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte'
  import { useConfirmDialog } from '$lib/hooks/useConfirmDialog.svelte.js'
  import ReleasesDialog from './ReleasesDialog.svelte'
  import HistoryIcon from '@lucide/svelte/icons/history'
  import MonitorIcon from '@lucide/svelte/icons/monitor'
  import GlobeIcon from '@lucide/svelte/icons/globe'
  import HardDriveIcon from '@lucide/svelte/icons/hard-drive'
  import LaptopIcon from '@lucide/svelte/icons/laptop'
  import SaveIcon from '@lucide/svelte/icons/save'
  import UploadIcon from '@lucide/svelte/icons/upload'
  import SparklesIcon from '@lucide/svelte/icons/sparkles'
  import { identidad } from '$core/data/identidad'
  import data from './landing.json'

  let { installed = false } = $props()

  const { problemas, funciones, titulo_seccion, subtitulo_seccion, capturas, roadmap } = data
  const enlaces = identidad.enlaces
  const versionActual = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'
  const isPouchMode = getActiveBackend() === 'pouch'
  let showReleases = $state(false)
  let demoLoading = $state(false)
  let demoError = $state('')

  // Si la instalación actual vino de la card "Ver una demo", ofrecer salir
  // de la demo (limpiar y volver al wizard) desde la propia landing.
  const isDemo = isPouchMode && typeof localStorage !== 'undefined' && localStorage.getItem('lof-demo-mode') === '1'
  const confirmSalirDemo = useConfirmDialog()
  const handleSalirDemo = () => {
    confirmSalirDemo.openConfirm({
      title: '¿Terminar la demo?',
      description: 'Se borrarán todos los datos de ejemplo de este dispositivo y volverás a esta pantalla para instalar tu cooperadora real cuando quieras. Esta acción no se puede deshacer.',
      confirmLabel: 'Terminar demo',
      variant: 'destructive',
      onConfirm: async () => {
        // Marcar que vino del demo para trackear la conversión a instalación
        // real. sessionStorage sobrevive el reload de limpiarDispositivo.
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem('lof-from-demo', '1')
        }
        trackEvent('demo_terminated')
        const { limpiarDispositivo } = await import('$core/data/intercambio.js')
        await limpiarDispositivo()
      },
    })
  }

  // Carga una base de datos de ejemplo (ejercicios, movimientos, autoridades,
  // memorias, etc. ya cargados) para que se pueda navegar la app sin configurar
  // nada. Reutiliza el mismo importador que el restore de backups (.lof).
  const verDemo = async () => {
    demoLoading = true
    demoError = ''
    try {
      const res = await fetch('/demo/lof-demo.lof')
      if (!res.ok) throw new Error('No se pudo descargar la base de ejemplo.')
      const blob = await res.blob()
      const { importFromLof } = await import('$core/data/exportImport.js')
      await importFromLof(blob, { reemplazar: true })
      // Marcar modo demo (flag client-only, no viaja en el .lof) para que
      // AppShell pueda avisar y ofrecer "Salir de la demo".
      localStorage.setItem('lof-demo-mode', '1')
      trackEvent('demo_started')
      // reemplazar=true destruye y recrea la DB local: recargar para que
      // todas las referencias (router, stores, etc.) tomen los datos nuevos.
      // Forzamos la ruta 'inicio' para entrar directo a la app en vez de
      // quedar en esta misma landing (que seguiría en el hash actual).
      window.location.hash = 'inicio'
      window.location.reload()
    } catch (e) {
      demoError = e?.message || String(e)
      demoLoading = false
    }
  }
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
        {#if installed}
          <Button variant="default" size="sm" href="#inicio">
            <ArrowLeftIcon data-icon="inline-start" />
            <span class="hidden sm:inline">Volver a la app</span>
            <span class="sm:hidden">App</span>
          </Button>
        {/if}
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
        <Button variant="ghost" size="sm" href="#sobre-lof">
          Sobre LOF
        </Button>
        <Button variant="ghost" size="sm" href={enlaces.repo} target="_blank" rel="noopener noreferrer" aria-label="Ver repositorio en GitHub">
          <CodeXmlIcon data-icon="inline-start" />
          <span class="hidden sm:inline">GitHub</span>
        </Button>
        {#if !installed}
          <Button variant="outline" size="sm" href={enlaces.grist} target="_blank" rel="noopener noreferrer" aria-label="Abrir Grist">
            <span class="hidden sm:inline">Grist</span>
            <ExternalLinkIcon data-icon="inline-end" />
          </Button>
        {/if}
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
            Software libre para cooperadoras escolares de la Provincia de Buenos Aires
          </h1>
          <p class="max-w-2xl text-base text-muted-foreground sm:text-lg">
            {identidad.apertura}
          </p>
          <p class="max-w-2xl text-base text-muted-foreground sm:text-lg">
            {identidad.descripcion}
          </p>
        </div>
        {#if installed}
          <div class="flex flex-wrap gap-3">
            <Button variant="secondary" size="lg" href="#inicio">
              <ArrowLeftIcon data-icon="inline-start" />
              Abrir la app
            </Button>
            {#if isDemo}
              <Button variant="outline" size="lg" class="border-chart-2/40 text-chart-2 hover:bg-chart-2/10" onclick={handleSalirDemo}>
                <SparklesIcon data-icon="inline-start" />
                Terminar demo
              </Button>
            {/if}
            <Button variant="outline" size="lg" href="#instalacion">
              <DownloadIcon data-icon="inline-start" />
              Cómo instalarlo
            </Button>
          </div>
        {:else}
          <div class="grid gap-4 sm:grid-cols-2 {isPouchMode ? 'lg:grid-cols-3 max-w-4xl' : 'max-w-2xl'}">
            <!-- Instalar cooperadora -->
            <a
              href="#inicio"
              class="group flex flex-col gap-2 rounded-xl border-2 border-primary/40 bg-primary/5 p-5 text-left transition-all hover:border-primary hover:bg-primary/10 hover:shadow-md"
            >
              <div class="flex size-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <BuildingIcon class="size-5" />
              </div>
              <h3 class="text-base font-bold tracking-tight">Instalar mi cooperadora</h3>
              <p class="text-sm text-muted-foreground leading-relaxed">
                Configurá LOF para tu escuela por primera vez. Wizard guiado paso a paso, en 5 minutos.
              </p>
              <span class="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                Empezar
                <ArrowRightIcon class="size-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </a>

            <!-- Colaborar -->
            <a
              href="#inicio?modo=colaborador"
              class="group flex flex-col gap-2 rounded-xl border-2 border-amber-500/40 bg-amber-500/5 p-5 text-left transition-all hover:border-amber-500 hover:bg-amber-500/10 hover:shadow-md"
            >
              <div class="flex size-10 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600">
                <HeartHandshakeIcon class="size-5" />
              </div>
              <h3 class="text-base font-bold tracking-tight">Ayudar con la carga</h3>
              <p class="text-sm text-muted-foreground leading-relaxed">
                ¿Te enviaron un archivo <span class="font-mono">.lof</span>? Importalo y cargá movimientos desde tu dispositivo.
              </p>
              <span class="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-amber-600">
                Importar archivo
                <ArrowRightIcon class="size-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </a>

            {#if isPouchMode}
              <!-- Ver una demo -->
              <button
                type="button"
                onclick={verDemo}
                disabled={demoLoading}
                class="group flex flex-col gap-2 rounded-xl border-2 border-chart-2/40 bg-chart-2/5 p-5 text-left transition-all hover:border-chart-2 hover:bg-chart-2/10 hover:shadow-md disabled:cursor-wait disabled:opacity-70"
              >
                <div class="flex size-10 items-center justify-center rounded-lg bg-chart-2/15 text-chart-2">
                  <SparklesIcon class="size-5" />
                </div>
                <h3 class="text-base font-bold tracking-tight">Ver una demo</h3>
                <p class="text-sm text-muted-foreground leading-relaxed">
                  Navegá LOF ya cargado con datos de ejemplo (dos ejercicios, movimientos, autoridades y memorias) sin configurar nada.
                </p>
                <span class="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-chart-2">
                  {#if demoLoading}
                    Cargando datos de ejemplo…
                  {:else}
                    Probar ahora
                    <ArrowRightIcon class="size-4 transition-transform group-hover:translate-x-0.5" />
                  {/if}
                </span>
              </button>
            {/if}
          </div>
          {#if demoError}
            <p class="text-sm text-destructive max-w-2xl">{demoError}</p>
          {/if}
          <div class="flex flex-wrap gap-3">
            <Button variant="outline" size="sm" href="#instalacion">
              <DownloadIcon data-icon="inline-start" />
              Cómo instalarlo
            </Button>
            <Button variant="ghost" size="sm" href={enlaces.repo} target="_blank" rel="noopener noreferrer">
              <CodeXmlIcon data-icon="inline-start" />
              Ver repo / colaborar
            </Button>
          </div>
        {/if}
        <p class="text-sm text-muted-foreground">
          Software libre bajo {identidad.licencia}. Funciona en el navegador, en Grist o como app de escritorio.
          Tus datos siempre son tuyos.
        </p>
        <div class="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 max-w-2xl">
          <ShieldIcon class="size-5 shrink-0 text-primary mt-0.5" />
          <p class="text-sm text-muted-foreground">
            <strong class="text-foreground">Tus datos son tuyos y se guardan en tu dispositivo.</strong>
            No necesitás crear una cuenta ni subir nada a internet. Podés respaldarlos cuando quieras
            y llevarlos a otra computadora. Si ya usás Grist, también podés conectarlo.
          </p>
        </div>
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

  <!-- FORMAS DE USO: múltiples formas de usar LOF, sin jerga técnica -->
  <section class="mx-auto max-w-5xl px-4 py-12" aria-labelledby="formas-heading">
    <div class="flex flex-col gap-2 mb-6">
      <h2 id="formas-heading" class="text-2xl font-bold tracking-tight">Tres formas de usar LOF</h2>
      <p class="text-sm text-muted-foreground max-w-prose">
        Elegí la que mejor se adapte a tu escuela. Podés empezar con una y cambiar después —
        tus datos siempre los podés llevar con vos.
      </p>
    </div>
    <div class="grid gap-4 sm:grid-cols-3">
      <!-- Prueba rápida -->
      <Card.Root class="border-2 border-primary/30 bg-primary/5">
        <Card.Header>
          <div class="flex items-center gap-3">
            <div class="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <GlobeIcon class="size-5" />
            </div>
            <div class="flex flex-col">
              <Card.Title class="text-base">Probar en el navegador</Card.Title>
              <Badge variant="default" class="w-fit mt-1">Sin instalar nada</Badge>
            </div>
          </div>
        </Card.Header>
        <Card.Content>
          <p class="text-sm text-muted-foreground mb-3">
            Entrá a la página web y empezá a usar LOF directamente. Los datos se guardan en tu navegador,
            como cuando guardás una contraseña. No instalás nada.
          </p>
          <ul class="flex flex-col gap-1.5 text-xs text-muted-foreground">
            <li class="flex items-start gap-2">
              <CheckCircleIcon class="mt-0.5 size-3.5 shrink-0 text-primary" />
              Ideal para probar y para uso individual
            </li>
            <li class="flex items-start gap-2">
              <CheckCircleIcon class="mt-0.5 size-3.5 shrink-0 text-primary" />
              Funciona sin internet después de la primera carga
            </li>
            <li class="flex items-start gap-2">
              <CheckCircleIcon class="mt-0.5 size-3.5 shrink-0 text-primary" />
              Podés respaldar tus datos a un archivo cuando quieras
            </li>
          </ul>
        </Card.Content>
      </Card.Root>

      <!-- Con respaldo / servidor local -->
      <Card.Root>
        <Card.Header>
          <div class="flex items-center gap-3">
            <div class="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <HardDriveIcon class="size-5" />
            </div>
            <div class="flex flex-col">
              <Card.Title class="text-base">Con respaldo en tu compu</Card.Title>
              <Badge variant="secondary" class="w-fit mt-1">Recomendado</Badge>
            </div>
          </div>
        </Card.Header>
        <Card.Content>
          <p class="text-sm text-muted-foreground mb-3">
            Si alguien en la escuela tiene algo de conocimientos técnicos, podés instalar un respaldo
            local que sincroniza automáticamente. Así varios dispositivos comparten los mismos datos.
          </p>
          <ul class="flex flex-col gap-1.5 text-xs text-muted-foreground">
            <li class="flex items-start gap-2">
              <CheckCircleIcon class="mt-0.5 size-3.5 shrink-0 text-primary" />
              Varios dispositivos ven los mismos datos en tiempo real
            </li>
            <li class="flex items-start gap-2">
              <CheckCircleIcon class="mt-0.5 size-3.5 shrink-0 text-primary" />
              Respaldo automático: si una compu se rompe, los datos siguen
            </li>
            <li class="flex items-start gap-2">
              <CheckCircleIcon class="mt-0.5 size-3.5 shrink-0 text-primary" />
              Funciona 100% sin internet dentro de la escuela
            </li>
          </ul>
        </Card.Content>
      </Card.Root>

      <!-- Grist -->
      <Card.Root>
        <Card.Header>
          <div class="flex items-center gap-3">
            <div class="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <GristIcon class="size-5" />
            </div>
            <div class="flex flex-col">
              <Card.Title class="text-base">Dentro de Grist</Card.Title>
              <Badge variant="outline" class="w-fit mt-1">Para usuarios de Grist</Badge>
            </div>
          </div>
        </Card.Header>
        <Card.Content>
          <p class="text-sm text-muted-foreground mb-3">
            Si ya usás Grist (una planilla inteligente gratuita), podés agregar LOF como aplicación
            dentro de tu documento. Los datos viven en Grist y LOF les da pantallas amigables.
          </p>
          <ul class="flex flex-col gap-1.5 text-xs text-muted-foreground">
            <li class="flex items-start gap-2">
              <CheckCircleIcon class="mt-0.5 size-3.5 shrink-0 text-primary" />
              Aprovechás todo el poder de Grist para consultar datos
            </li>
            <li class="flex items-start gap-2">
              <CheckCircleIcon class="mt-0.5 size-3.5 shrink-0 text-primary" />
              Versionado y backups nativos de Grist
            </li>
            <li class="flex items-start gap-2">
              <CheckCircleIcon class="mt-0.5 size-3.5 shrink-0 text-primary" />
              Funciona en la nube o en tu propio servidor
            </li>
          </ul>
        </Card.Content>
      </Card.Root>
    </div>

    <!-- App de escritorio (mención breve) -->
    <div class="mt-4 flex items-start gap-3 rounded-lg border border-border bg-card/50 px-4 py-3">
      <LaptopIcon class="size-5 shrink-0 text-muted-foreground mt-0.5" />
      <p class="text-sm text-muted-foreground">
        <strong class="text-foreground">¿Preferís una app de escritorio?</strong>
        También hay versiones nativas para Windows, Linux y macOS que se descargan e instalan
        como cualquier programa. Los datos se guardan en tu compu, sin navegador.
        Disponibles en la <a href={enlaces.repo + '/releases'} target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">página de releases</a>.
      </p>
    </div>
  </section>

  <!-- CÓMO SE GUARDAN TUS DATOS -->
  <section class="mx-auto max-w-5xl px-4 py-12" aria-labelledby="datos-heading">
    <div class="flex flex-col gap-2 mb-6">
      <h2 id="datos-heading" class="text-2xl font-bold tracking-tight">Cómo se guardan tus datos</h2>
      <p class="text-sm text-muted-foreground max-w-prose">
        Tu información es tuya. Acá te explicamos en simple dónde queda guardada y cómo llevarla con vos.
      </p>
    </div>
    <div class="grid gap-4 sm:grid-cols-2">
      <Card.Root>
        <Card.Header>
          <div class="flex items-center gap-3">
            <div class="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <SaveIcon class="size-5" />
            </div>
            <Card.Title class="text-base">Respaldo a un archivo</Card.Title>
          </div>
        </Card.Header>
        <Card.Content>
          <p class="text-sm text-muted-foreground">
            Desde la configuración de la app podés exportar todos los datos a un archivo comprimido (.lof).
            Es como hacer una copia de seguridad. Guardalo en un pendrive o subilo a la nube.
            Si tu compu se rompe o querés migrar a otra, importás el archivo y seguís trabajando como si nada.
          </p>
        </Card.Content>
      </Card.Root>
      <Card.Root>
        <Card.Header>
          <div class="flex items-center gap-3">
            <div class="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <UploadIcon class="size-5" />
            </div>
            <Card.Title class="text-base">Migrar a otra computadora</Card.Title>
          </div>
        </Card.Header>
        <Card.Content>
          <p class="text-sm text-muted-foreground">
            Cuando cambia la comisión directiva o reemplazás la compu, no perdés nada.
            Exportás el respaldo en la compu vieja, lo pasás a la nueva (por pendrive, mail o como quieras)
            y lo importás desde la configuración. Todos los socios, movimientos y asambleas aparecen igual que antes.
          </p>
        </Card.Content>
      </Card.Root>
    </div>
    <div class="mt-4 flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 max-w-2xl">
      <ShieldIcon class="size-5 shrink-0 text-primary mt-0.5" />
      <p class="text-sm text-muted-foreground">
        <strong class="text-foreground">Sin cuentas, sin nube, telemetría respetuosa de tu privacidad.</strong>
        LOF no te pide que crees una cuenta ni que subas tus datos a ningún servidor.
        Todo queda en tu dispositivo o en tu servidor, bajo tu control. Si mañana dejás de usar LOF,
        los datos siguen siendo tuyos y los podés exportar cuando quieras.
      </p>
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
                    <img src={'./' + captura.imagen} alt={captura.titulo} width="1918" height="1067" class="w-full h-auto object-contain" loading="lazy" />
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

  <!-- FAQ: preguntas frecuentes sobre cooperadoras escolares y LOF -->
  <section class="mx-auto max-w-5xl px-4 py-12" aria-labelledby="faq-heading">
    <div class="flex flex-col gap-2 mb-6">
      <h2 id="faq-heading" class="text-2xl font-bold tracking-tight">Preguntas frecuentes</h2>
      <p class="text-sm text-muted-foreground max-w-prose">
        Lo que más consultan las cooperadoras escolares de la Provincia de Buenos Aires antes de empezar a usar LOF.
      </p>
    </div>
    <div class="grid gap-4 sm:grid-cols-2">
      <Card.Root>
        <Card.Header>
          <Card.Title class="text-base">¿LOF sirve para cooperadoras de la Provincia de Buenos Aires?</Card.Title>
        </Card.Header>
        <Card.Content>
          <p class="text-sm text-muted-foreground">
            Sí. LOF está diseñado específicamente para las cooperadoras escolares de PBA. Está alineado con el
            estatuto modelo y la Planilla de Ingresos y Aportes (PIA) de la DGCyE, y digitaliza los cuatro libros
            obligatorios que exige la normativa provincial: Actas, Socios, Tesorería e Inventario.
          </p>
        </Card.Content>
      </Card.Root>
      <Card.Root>
        <Card.Header>
          <Card.Title class="text-base">¿LOF es gratuito?</Card.Title>
        </Card.Header>
        <Card.Content>
          <p class="text-sm text-muted-foreground">
            Sí, LOF es software libre bajo licencia AGPL-3.0. No tiene costo, no requiere cuentas ni servicios
            en la nube. Funciona en el navegador, con respaldo local o dentro de Grist, y los datos se guardan
            en el dispositivo del usuario.
          </p>
        </Card.Content>
      </Card.Root>
      <Card.Root>
        <Card.Header>
          <Card.Title class="text-base">¿LOF genera la PIA y la Nómina automáticamente?</Card.Title>
        </Card.Header>
        <Card.Content>
          <p class="text-sm text-muted-foreground">
            Sí. LOF consolida los movimientos cargados durante el ejercicio y arma la PIA y la Nómina de
            autoridades (CD, CRC y Federación) en PDF, desde los datos registrados mes a mes. No hay que llenar
            formularios a mano.
          </p>
        </Card.Content>
      </Card.Root>
      <Card.Root>
        <Card.Header>
          <Card.Title class="text-base">¿Necesito internet para usar LOF?</Card.Title>
        </Card.Header>
        <Card.Content>
          <p class="text-sm text-muted-foreground">
            No. LOF funciona 100% offline. Los datos se guardan en el navegador, en una computadora de la escuela
            o dentro de Grist. No se envía nada a internet. Se puede respaldar a un archivo .lof y migrar a otra
            computadora cuando haga falta.
          </p>
        </Card.Content>
      </Card.Root>
      <Card.Root>
        <Card.Header>
          <Card.Title class="text-base">¿Qué pasa cuando cambia la comisión directiva?</Card.Title>
        </Card.Header>
        <Card.Content>
          <p class="text-sm text-muted-foreground">
            Los socios, las autoridades, las asambleas y los movimientos quedan registrados permanentemente.
            La nueva gestión retoma exactamente donde quedó la anterior. Además, el histórico de mandatos
            permite saber quién ocupó cada cargo en cada ejercicio.
          </p>
        </Card.Content>
      </Card.Root>
      <Card.Root>
        <Card.Header>
          <Card.Title class="text-base">¿LOF sirve para el control de la DIPREGEP?</Card.Title>
        </Card.Header>
        <Card.Content>
          <p class="text-sm text-muted-foreground">
            Sí. Todos los registros son trazables y exportables. La PIA, la Nómina, el padrón de socios y las
            actas de asambleas se generan en el formato oficial, listos para cualquier control o auditoría
            de la DIPREGEP.
          </p>
        </Card.Content>
      </Card.Root>
    </div>
  </section>

  <!-- INVITACIÓN A "SOBRE LOF" -->
  <section class="mx-auto max-w-5xl px-4 py-10">
    <div class="flex flex-col items-center gap-3 rounded-lg border border-border bg-card/50 px-6 py-8 text-center">
      <p class="text-base text-muted-foreground max-w-prose">
        ¿Te gustó la solución y querés saber <strong class="text-foreground">por qué existe LOF</strong>, qué significa el nombre y qué nos motiva?
      </p>
      <Button variant="outline" href="#sobre-lof">
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
            Funciona en el navegador, con respaldo local o dentro de Grist.
          </p>
        </div>
        <div class="flex flex-wrap gap-3">
          <Button variant="ghost" size="sm" href="#sobre-lof">
            Sobre LOF
          </Button>
          <Button variant="ghost" size="sm" href={enlaces.repo} target="_blank" rel="noopener noreferrer">
            <CodeXmlIcon data-icon="inline-start" />
            Contribuir
          </Button>
          <Button variant="ghost" size="sm" href="https://www.gnu.org/licenses/agpl-3.0.html" target="_blank" rel="noopener noreferrer">
            <ExternalLinkIcon data-icon="inline-start" />
            Licencia AGPL
          </Button>
          <Button variant="ghost" size="sm" href="https://www.getgrist.com/" target="_blank" rel="noopener noreferrer">
            <GristIcon class="size-4" data-icon="inline-start" />
            Grist
          </Button>
        </div>
      </div>
    </div>
  </footer>
</main>

<ReleasesDialog open={showReleases} onClose={() => (showReleases = false)} />

<ConfirmDialog
  bind:open={confirmSalirDemo.open}
  title={confirmSalirDemo.title}
  description={confirmSalirDemo.description}
  confirmLabel={confirmSalirDemo.confirmLabel}
  variant={confirmSalirDemo.variant}
  onConfirm={confirmSalirDemo.handleConfirm}
/>
