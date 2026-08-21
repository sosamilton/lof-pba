<script>
  import { Button } from '$lib/components/ui/button'
  import { Badge } from '$lib/components/ui/badge'
  import * as Carousel from '$lib/components/ui/carousel'
  import * as Accordion from '$lib/components/ui/accordion'
  import { Separator } from '$lib/components/ui/separator'
  import { navigate } from '$core/ui/router.svelte'
  import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left'
  import ExternalLinkIcon from '@lucide/svelte/icons/external-link'
  import CopyIcon from '@lucide/svelte/icons/copy'
  import CheckIcon from '@lucide/svelte/icons/check'
  import DownloadIcon from '@lucide/svelte/icons/download'
  import GristIcon from '$lib/components/GristIcon.svelte'
  import WifiOffIcon from '@lucide/svelte/icons/wifi-off'
  import WifiIcon from '@lucide/svelte/icons/wifi'
  import FileTextIcon from '@lucide/svelte/icons/file-text'
  import HeartHandshakeIcon from '@lucide/svelte/icons/heart-handshake'
  import StarIcon from '@lucide/svelte/icons/star'
  import DatabaseIcon from '@lucide/svelte/icons/database'
  import ShieldCheckIcon from '@lucide/svelte/icons/shield-check'
  import ArrowRightLeftIcon from '@lucide/svelte/icons/arrow-right-left'
  import { identidad } from '$core/data/identidad'
  import data from './landing.json'

  let { guia_instalacion } = data
  const enlaces = identidad.enlaces

  const modoConfig = {
    offline: { label: 'Offline', icon: WifiOffIcon, class: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600' },
    online: { label: 'Online', icon: WifiIcon, class: 'border-blue-500/30 bg-blue-500/10 text-blue-600' }
  }

  const offlineDocUrl = 'https://github.com/sosamilton/spa-cooperadora/blob/main/docs/OFFLINE.md'

  let copied = $state(null)

  const copyToClipboard = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text)
      copied = id
      setTimeout(() => { copied = null }, 2000)
    } catch {
      // fallback
    }
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
    <div class="mx-auto max-w-5xl px-4 py-10 sm:py-14">
      <div class="flex flex-col gap-3">
        <h1 class="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
          {guia_instalacion.titulo}
        </h1>
        <p class="max-w-2xl text-base text-muted-foreground sm:text-lg">
          {guia_instalacion.subtitulo}
        </p>
      </div>
    </div>
  </section>

  <!-- ¿QUÉ ES GRIST? -->
  <section class="mx-auto max-w-5xl px-4 py-10 sm:py-14">
    <div class="flex flex-col gap-2 mb-6">
      <h2 class="text-2xl font-bold tracking-tight">¿Qué es Grist y por qué lo necesito?</h2>
      <p class="text-sm text-muted-foreground max-w-prose">
        LOF no funciona solo: necesita Grist para guardar los datos. Es como una app de celular que necesita el sistema operativo. Acá te explicamos en simple:
      </p>
    </div>

    <div class="grid gap-4 sm:grid-cols-3">
      <div class="rounded-lg border border-border p-4">
        <div class="flex items-center gap-2 mb-2">
          <DatabaseIcon class="size-5 text-primary" />
          <span class="text-sm font-bold">Grist es donde viven los datos</span>
        </div>
        <p class="text-xs text-muted-foreground">
          Grist es un programa gratuito y de código abierto, como una planilla de cálculo pero más organizada. Tu cooperadora guarda ahí todos sus datos: socios, movimientos, asambleas, autoridades, todo.
        </p>
      </div>
      <div class="rounded-lg border border-border p-4">
        <div class="flex items-center gap-2 mb-2">
          <GristIcon class="size-5 text-primary" />
          <span class="text-sm font-bold">LOF es la interfaz</span>
        </div>
        <p class="text-xs text-muted-foreground">
          LOF funciona dentro de Grist como un componente personalizado. Es como un "aplicación" que se instala dentro del documento y te da pantallas amigables para cargar y consultar los datos, sin que tengas que mirar las tablas a mano.
        </p>
      </div>
      <div class="rounded-lg border border-border p-4">
        <div class="flex items-center gap-2 mb-2">
          <ArrowRightLeftIcon class="size-5 text-primary" />
          <span class="text-sm font-bold">Tus datos son tuyos y son portables</span>
        </div>
        <p class="text-xs text-muted-foreground">
          Todo lo que cargues queda guardado en el documento de Grist. Si mañana dejás de usar LOF, los datos siguen ahí, accesibles. Podés exportarlos, hacer copias de seguridad o pasarlos a otra compu. No hay lock-in: la información siempre es tuya.
        </p>
      </div>
    </div>

    <div class="mt-6 flex flex-wrap items-center gap-3">
      <Button variant="outline" href="https://www.getgrist.com/product/" target="_blank" rel="noreferrer">
        <GristIcon class="size-4" data-icon="inline-start" />
        Conocer Grist (página oficial)
        <ExternalLinkIcon data-icon="inline-end" />
      </Button>
      <Button variant="ghost" href="https://support.getgrist.com/" target="_blank" rel="noreferrer">
        <FileTextIcon class="size-4" data-icon="inline-start" />
        Documentación y tutoriales de Grist
        <ExternalLinkIcon data-icon="inline-end" />
      </Button>
    </div>
  </section>

  <Separator />

  <!-- ¿CUÁL ELIJO? -->
  <section class="mx-auto max-w-5xl px-4 py-10 sm:py-14">
    <div class="flex flex-col gap-2 mb-6">
      <h2 class="text-2xl font-bold tracking-tight">¿Cuál elijo?</h2>
      <p class="text-sm text-muted-foreground max-w-prose">
        Depende de tu situación. Acá te ayudamos a decidir:
      </p>
    </div>

    <div class="grid gap-4 sm:grid-cols-3">
      <div class="rounded-lg border-2 border-primary/30 bg-primary/5 p-4">
        <div class="flex items-center gap-2 mb-2">
          <StarIcon class="size-4 text-primary" />
          <span class="text-sm font-bold">Si recién empezás</span>
        </div>
        <p class="text-xs text-muted-foreground">
          Descargá <strong>Grist Desktop</strong>. Es como instalar cualquier programa. No necesitás internet ni saber de computación.
        </p>
      </div>
      <div class="rounded-lg border border-border p-4">
        <div class="flex items-center gap-2 mb-2">
          <WifiIcon class="size-4 text-blue-600" />
          <span class="text-sm font-bold">Si tenés buen internet</span>
        </div>
        <p class="text-xs text-muted-foreground">
          Usá la <strong>nube de Grist</strong> (getgrist.com). Sin instalar nada, entrás desde el navegador. Es gratis.
        </p>
      </div>
      <div class="rounded-lg border border-border p-4">
        <div class="flex items-center gap-2 mb-2">
          <WifiOffIcon class="size-4 text-emerald-600" />
          <span class="text-sm font-bold">Si no hay internet en la escuela</span>
        </div>
        <p class="text-xs text-muted-foreground">
          Alguien con conocimientos técnicos puede instalar <strong>Docker</strong>. Todo funciona offline, sin depender de internet.
        </p>
      </div>
    </div>
  </section>

  <Separator />

  <!-- MÉTODOS DE INSTALACIÓN -->
  <section class="mx-auto max-w-5xl px-4 py-10 sm:py-14">
    <div class="flex flex-col gap-2 mb-6">
      <h2 class="text-2xl font-bold tracking-tight">Formas de instalar</h2>
      <p class="text-sm text-muted-foreground max-w-prose">
        Elegí la opción que mejor se adapte a tu situación. Desplegá cada una para ver los detalles.
      </p>
      <a href={offlineDocUrl} target="_blank" rel="noreferrer" class="inline-flex items-center gap-1.5 text-sm text-primary hover:underline w-fit">
        <FileTextIcon class="size-4" />
        Ver guía detallada de uso offline
      </a>
    </div>

    <Accordion.Root type="single" collapsible class="w-full">
      {#each guia_instalacion.metodos_instalacion as metodo, i}
        <Accordion.Item value="item-{i}" class={metodo.recomendado ? 'border-2 border-primary/30 rounded-lg' : ''}>
          <Accordion.Trigger class="text-base font-semibold">
            <div class="flex items-center gap-2">
              {#if metodo.titulo.includes('Docker')}
                <img src="./img/docker.svg" alt="Docker" class="size-5 shrink-0" />
              {:else if metodo.titulo.includes('Grist')}
                <GristIcon class="size-5 shrink-0" />
              {:else if metodo.titulo.includes('Nube')}
                <WifiIcon class="size-5 shrink-0" />
              {/if}
              {metodo.titulo}
              {#if metodo.recomendado}
                <Badge variant="default" class="gap-1">
                  <StarIcon class="size-3" />
                  Recomendado
                </Badge>
              {/if}
              {#if metodo.modo && modoConfig[metodo.modo]}
                {@const modo = modoConfig[metodo.modo]}
                <Badge variant="outline" class={modo.class}>
                  <modo.icon class="size-3" />
                  {modo.label}
                </Badge>
              {/if}
            </div>
          </Accordion.Trigger>
          <Accordion.Content>
            <div class="flex flex-col gap-4 pb-2">
              <p class="text-sm text-muted-foreground">{metodo.descripcion}</p>

              {#if metodo.nota}
                <p class="text-sm text-muted-foreground rounded-lg bg-muted p-3 border border-border">
                  {metodo.nota}
                </p>
              {/if}

              {#if metodo.comandos?.length > 0}
                {#each metodo.comandos as cmd, j}
                  <div class="relative rounded-lg border border-border bg-card overflow-hidden">
                    <div class="flex items-center justify-between px-4 py-2 border-b border-border bg-muted">
                      <span class="text-xs font-mono text-muted-foreground">Paso {j + 1}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        class="h-6 px-2"
                        onclick={() => copyToClipboard(cmd, 'cmd-' + i + '-' + j)}
                      >
                        {#if copied === 'cmd-' + i + '-' + j}
                          <CheckIcon data-icon="inline-start" class="text-primary" />
                          Copiado
                        {:else}
                          <CopyIcon data-icon="inline-start" />
                          Copiar
                        {/if}
                      </Button>
                    </div>
                    <pre class="px-4 py-3 text-sm font-mono overflow-x-auto"><code>{cmd}</code></pre>
                  </div>
                {/each}
              {:else if metodo.comando}
                <div class="relative rounded-lg border border-border bg-card overflow-hidden">
                  <div class="flex items-center justify-between px-4 py-2 border-b border-border bg-muted">
                    <span class="text-xs font-mono text-muted-foreground">Terminal</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      class="h-6 px-2"
                      onclick={() => copyToClipboard(metodo.comando, 'cmd-' + i)}
                    >
                      {#if copied === 'cmd-' + i}
                        <CheckIcon data-icon="inline-start" class="text-primary" />
                        Copiado
                      {:else}
                        <CopyIcon data-icon="inline-start" />
                        Copiar
                      {/if}
                    </Button>
                  </div>
                  <pre class="px-4 py-3 text-sm font-mono overflow-x-auto"><code>{metodo.comando}</code></pre>
                </div>
              {/if}

              {#if metodo.requisitos?.length > 0}
                <div class="flex flex-col gap-2">
                  <span class="text-sm font-medium">Requisitos previos:</span>
                  <div class="flex flex-wrap gap-2">
                    {#each metodo.requisitos as req}
                      <Button variant="outline" size="sm" href={req.enlace} target="_blank" rel="noreferrer">
                        <DownloadIcon data-icon="inline-start" />
                        {req.texto}
                        <ExternalLinkIcon data-icon="inline-end" />
                      </Button>
                    {/each}
                  </div>
                </div>
              {/if}

              {#if metodo.enlace}
                <Button variant="outline" href={metodo.enlace} target="_blank" rel="noreferrer">
                  <ExternalLinkIcon data-icon="inline-end" />
                  {metodo.enlace_texto}
                </Button>
              {/if}
            </div>
          </Accordion.Content>
        </Accordion.Item>
      {/each}
    </Accordion.Root>
  </section>

  <Separator />

  <!-- CARRUSEL DE PASOS -->
  <section class="mx-auto max-w-5xl px-4 py-10 sm:py-14">
    <div class="flex flex-col gap-2 mb-6">
      <h2 class="text-2xl font-bold tracking-tight">Paso a paso con imágenes</h2>
      <p class="text-sm text-muted-foreground max-w-prose">
        Así se ve el proceso dentro de Grist. Navegá con las flechas para ver cada paso.
      </p>
    </div>

    <Carousel.Root class="w-full">
      <Carousel.Content>
        {#each guia_instalacion.pasos as paso, i}
          <Carousel.Item>
            <div class="flex flex-col gap-4 p-1">
              <div class="flex items-start gap-3">
                <div class="flex size-9 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 font-bold text-primary">
                  {i + 1}
                </div>
                <div class="flex flex-col gap-1">
                  <h3 class="text-lg font-semibold tracking-tight">{paso.titulo}</h3>
                  <p class="text-sm text-muted-foreground">{paso.descripcion}</p>
                </div>
              </div>
              <div class="rounded-xl border border-border overflow-hidden bg-muted">
                <img
                  src={'./' + paso.imagen}
                  alt={paso.titulo}
                  class="w-full h-auto object-contain"
                  loading="lazy"
                />
              </div>
            </div>
          </Carousel.Item>
        {/each}
      </Carousel.Content>
      <Carousel.Previous />
      <Carousel.Next />
    </Carousel.Root>
  </section>

  <!-- FOOTER -->
  <footer class="border-t border-border bg-card">
    <div class="mx-auto max-w-5xl px-4 py-8">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="outline" onclick={() => navigate('inicio')}>
          <ArrowLeftIcon data-icon="inline-start" />
          Volver al inicio
        </Button>
        <Button href={enlaces.grist_docs} target="_blank" rel="noreferrer">
          <GristIcon class="size-4" data-icon="inline-start" />
          Documentación oficial de widgets
          <ExternalLinkIcon data-icon="inline-end" />
        </Button>
      </div>
    </div>
  </footer>
</main>
