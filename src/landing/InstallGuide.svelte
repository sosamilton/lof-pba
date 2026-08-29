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
  import CloudIcon from '@lucide/svelte/icons/cloud'
  import PlugIcon from '@lucide/svelte/icons/plug'
  import ServerIcon from '@lucide/svelte/icons/server'
  import CircleQuestionMarkIcon from '@lucide/svelte/icons/circle-question-mark'
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

  // Selector de modalidad: guía la decisión sin exponer jerga técnica de entrada.
  const CAMINOS = [
    {
      id: 'navegador',
      icon: WifiIcon,
      titulo: 'Probar en el navegador',
      descripcion: 'Sin instalar nada. Los datos se guardan en tu navegador y podés respaldarlos cuando quieras.',
      cta: 'Empezar a usar ahora',
      recomendado: true,
    },
    {
      id: 'respaldo',
      icon: ServerIcon,
      titulo: 'Con respaldo local (CouchDB)',
      descripcion: 'Varios dispositivos comparten los mismos datos con sincronización automática. Ideal para escuelas.',
      cta: 'Cómo configurar el respaldo',
    },
    {
      id: 'grist',
      icon: PlugIcon,
      titulo: 'Dentro de Grist',
      descripcion: 'Si ya usás Grist o querés aprovechar su potencia. Los datos viven en tu documento de Grist.',
      cta: 'Agregar LOF a Grist',
    },
    {
      id: 'desktop',
      icon: DownloadIcon,
      titulo: 'App de escritorio',
      descripcion: 'Descargá la app nativa para Windows, Linux o macOS. Se instala como cualquier programa.',
      cta: 'Descargar binarios',
    },
    {
      id: 'no-se',
      icon: CircleQuestionMarkIcon,
      titulo: 'No sé qué necesito',
      descripcion: 'Ayudame a elegir con un par de preguntas simples.',
      cta: 'Ayudarme a elegir',
    },
  ]

  let camino = $state(null)

  const elegirCamino = (id) => {
    camino = id
  }

  const volverAlSelector = () => {
    camino = null
  }

  // Pasos de "agregar LOF" reutilizados según el punto de partida del usuario.
  // Excluye "Crear un documento nuevo" (ya tienen Grist) y los pasos detallados del setup wizard.
  const setupTitulos = ['Elegir modalidad', 'Datos de la escuela y cooperadora', 'Datos bancarios', 'Ejercicios y cargos', 'Instalación completa']
  const pasosAgregarWidget = $derived(guia_instalacion.pasos.filter((p) => p.titulo !== 'Crear un documento nuevo' && !setupTitulos.includes(p.titulo)))
  const metodoServidor = $derived(guia_instalacion.metodos_instalacion.find((m) => m.comandos?.length > 0))
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
      <Button variant="ghost" size="sm" onclick={() => navigate('landing')}>
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

  <!-- ¿QUÉ NECESITO? -->
  <section class="mx-auto max-w-5xl px-4 pt-10 sm:pt-14">
    <div class="rounded-xl border border-border bg-card/50 p-5 sm:p-6">
      <h2 class="text-lg font-bold tracking-tight mb-3">Para usar LOF necesitás</h2>
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mínimo (probar en navegador)</span>
          <ul class="mt-2 flex flex-col gap-1.5">
            <li class="flex items-center gap-2 text-sm"><CheckIcon class="size-4 text-primary shrink-0" /> Un navegador moderno (Chrome, Firefox, Edge)</li>
            <li class="flex items-center gap-2 text-sm"><CheckIcon class="size-4 text-primary shrink-0" /> Conexión a internet la primera vez</li>
          </ul>
        </div>
        <div>
          <span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Opcional (según el modo que elijas)</span>
          <ul class="mt-2 flex flex-col gap-1.5">
            <li class="flex items-center gap-2 text-sm text-muted-foreground"><span class="size-4 shrink-0"></span> Grist (si querés usarlo dentro de Grist)</li>
            <li class="flex items-center gap-2 text-sm text-muted-foreground"><span class="size-4 shrink-0"></span> Docker (para respaldo local con CouchDB)</li>
            <li class="flex items-center gap-2 text-sm text-muted-foreground"><span class="size-4 shrink-0"></span> App de escritorio (descargable desde GitHub)</li>
          </ul>
        </div>
      </div>
      <p class="mt-4 text-sm text-muted-foreground border-t border-border pt-3">
        <strong class="text-foreground">No necesitás instalar nada para empezar.</strong>
        Podés probar LOF directamente en el navegador y decidir después si querés agregar respaldo o usar Grist.
      </p>
    </div>
  </section>

  <!-- SELECTOR DE MODALIDAD -->
  <section class="mx-auto max-w-5xl px-4 py-10 sm:py-14">
    <div class="flex flex-col gap-2 mb-6">
      <h2 class="text-2xl font-bold tracking-tight">¿Cómo querés empezar?</h2>
      <p class="text-sm text-muted-foreground max-w-prose">
        Elegí la opción que describe tu situación. Te mostramos solo lo que necesitás para ese caso.
      </p>
    </div>

    {#if !camino}
      <div class="grid gap-4 sm:grid-cols-2">
        {#each CAMINOS as c}
          <button
            type="button"
            onclick={() => elegirCamino(c.id)}
            class="text-left rounded-lg border p-4 transition-colors hover:border-primary/50 hover:bg-primary/5 {c.recomendado ? 'border-2 border-primary/40 bg-primary/5' : 'border-border'}"
          >
            <div class="flex items-center gap-2 mb-2">
              <div class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <c.icon class="size-5" />
              </div>
              <span class="text-sm font-bold">{c.titulo}</span>
              {#if c.recomendado}
                <Badge variant="default" class="gap-1">
                  <StarIcon class="size-3" />
                  Recomendado
                </Badge>
              {/if}
            </div>
            <p class="text-xs text-muted-foreground mb-3">{c.descripcion}</p>
            <span class="text-sm font-medium text-primary inline-flex items-center gap-1">
              {c.cta}
              <ExternalLinkIcon class="size-3.5" />
            </span>
          </button>
        {/each}
      </div>
    {:else}
      <Button variant="ghost" size="sm" onclick={volverAlSelector} class="mb-4">
        <ArrowLeftIcon data-icon="inline-start" />
        Elegir otra opción
      </Button>

      {#if camino === 'navegador'}
        <div class="flex flex-col gap-4">
          <div class="rounded-lg border-2 border-primary/30 bg-primary/5 p-4">
            <p class="text-sm">
              <strong>La forma más simple.</strong> Entrá a la página de LOF y empezá a usarla.
              Los datos se guardan en tu navegador (como cuando una página recuerda tu sesión).
              No instalás nada, no creás cuenta, no subís nada a internet.
            </p>
          </div>
          <ol class="flex flex-col gap-3">
            <li class="flex gap-3 rounded-lg border border-border p-3">
              <div class="flex size-7 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-xs font-bold text-primary">1</div>
              <div>
                <div class="text-sm font-semibold">Entrar a la app</div>
                <p class="text-xs text-muted-foreground mt-0.5">Hacé clic en "Probar en el navegador" en la página principal. Se abre la app directamente.</p>
              </div>
            </li>
            <li class="flex gap-3 rounded-lg border border-border p-3">
              <div class="flex size-7 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-xs font-bold text-primary">2</div>
              <div>
                <div class="text-sm font-semibold">Completar la configuración inicial</div>
                <p class="text-xs text-muted-foreground mt-0.5">Una guía paso a paso te pregunta los datos de tu escuela, cooperadora, banco y cargos. Lo completás en 5 minutos.</p>
              </div>
            </li>
            <li class="flex gap-3 rounded-lg border border-border p-3">
              <div class="flex size-7 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-xs font-bold text-primary">3</div>
              <div>
                <div class="text-sm font-semibold">¡Listo! Empezá a usar LOF</div>
                <p class="text-xs text-muted-foreground mt-0.5">La app queda lista para cargar socios, movimientos, asambleas y todo lo que necesitás.</p>
              </div>
            </li>
          </ol>
          <div class="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
            <ShieldCheckIcon class="size-5 shrink-0 text-primary mt-0.5" />
            <p class="text-sm text-muted-foreground">
              <strong class="text-foreground">Respaldoá tus datos regularmente.</strong>
              Desde Configuración → General podés exportar todos los datos a un archivo (.lof).
              Si limpiás el navegador o cambiás de compu, importás el archivo y seguís como si nada.
            </p>
          </div>
          <Button variant="default" onclick={() => navigate('inicio')}>
            <WifiIcon data-icon="inline-start" />
            Abrir la app ahora
          </Button>
        </div>
      {:else if camino === 'respaldo'}
        <div class="flex flex-col gap-4">
          <div class="rounded-lg border-2 border-primary/30 bg-primary/5 p-4">
            <p class="text-sm">
              <strong>Respaldo local con sincronización.</strong>
              Si alguien en la escuela tiene conocimientos técnicos, podés instalar CouchDB
              (un programa gratuito) en una compu del establecimiento. Todos los dispositivos
              que se conecten a esa compu verán los mismos datos y se sincronizarán automáticamente.
            </p>
          </div>
          <div class="rounded-lg border border-border bg-muted/5 p-4">
            <p class="text-sm text-muted-foreground mb-3">
              Necesitás <strong>Docker</strong> instalado en la compu que va a hacer de servidor.
              Después es un solo comando:
            </p>
            <div class="relative rounded-lg border border-border bg-card overflow-hidden">
              <div class="flex items-center justify-between px-4 py-2 border-b border-border bg-muted">
                <span class="text-xs font-mono text-muted-foreground">Terminal</span>
                <Button
                  variant="ghost"
                  size="sm"
                  class="h-6 px-2"
                  onclick={() => copyToClipboard('docker compose up -d', 'couchdb-cmd')}
                >
                  {#if copied === 'couchdb-cmd'}
                    <CheckIcon data-icon="inline-start" class="text-primary" />
                    Copiado
                  {:else}
                    <CopyIcon data-icon="inline-start" />
                    Copiar
                  {/if}
                </Button>
              </div>
              <pre class="px-4 py-3 text-sm font-mono overflow-x-auto"><code>docker compose up -d</code></pre>
            </div>
            <p class="text-xs text-muted-foreground mt-2">
              Esto levanta la app + CouchDB. La app queda en <code class="text-xs">http://localhost:5173</code>
              y CouchDB en <code class="text-xs">http://localhost:5984</code>.
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" href="https://docs.docker.com/desktop/setup/install/windows-install/" target="_blank" rel="noreferrer">
              <DownloadIcon data-icon="inline-start" />
              Docker para Windows
              <ExternalLinkIcon data-icon="inline-end" />
            </Button>
            <Button variant="outline" size="sm" href="https://docs.docker.com/desktop/setup/install/linux/" target="_blank" rel="noreferrer">
              <DownloadIcon data-icon="inline-start" />
              Docker para Linux
              <ExternalLinkIcon data-icon="inline-end" />
            </Button>
          </div>
          <ol class="flex flex-col gap-3">
            <li class="flex gap-3 rounded-lg border border-border p-3">
              <div class="flex size-7 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-xs font-bold text-primary">1</div>
              <div>
                <div class="text-sm font-semibold">Levantar el servidor local</div>
                <p class="text-xs text-muted-foreground mt-0.5">Corré el comando de arriba en la compu que va a hacer de servidor. Tiene que quedar prendida mientras se usa.</p>
              </div>
            </li>
            <li class="flex gap-3 rounded-lg border border-border p-3">
              <div class="flex size-7 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-xs font-bold text-primary">2</div>
              <div>
                <div class="text-sm font-semibold">Abrir la app desde cualquier dispositivo</div>
                <p class="text-xs text-muted-foreground mt-0.5">Desde otra compu o tablet de la misma red, entrá a la IP del servidor (ej: http://192.168.1.100:5173).</p>
              </div>
            </li>
            <li class="flex gap-3 rounded-lg border border-border p-3">
              <div class="flex size-7 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-xs font-bold text-primary">3</div>
              <div>
                <div class="text-sm font-semibold">Activar la sincronización</div>
                <p class="text-xs text-muted-foreground mt-0.5">Desde Configuración → Sincronización, activá el sync con CouchDB. Todos los cambios se replican automáticamente.</p>
              </div>
            </li>
          </ol>
          <div class="flex items-start gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
            <ShieldCheckIcon class="size-5 shrink-0 text-emerald-600 mt-0.5" />
            <p class="text-sm text-muted-foreground">
              <strong class="text-foreground">Respaldo automático.</strong>
              CouchDB guarda cada cambio. Si una compu se rompe, los datos siguen en el servidor.
              Y si el servidor se cae, cada dispositivo tiene su copia local y sigue funcionando.
            </p>
          </div>
        </div>
      {:else if camino === 'grist'}
        <div class="flex flex-col gap-4">
          <div class="rounded-lg border-2 border-primary/30 bg-primary/5 p-4">
            <p class="text-sm">
              <strong>Grist es una planilla inteligente gratuita.</strong>
              Si ya lo usás o querés aprovechar su potencia para consultar datos, podés agregar LOF
              como aplicación dentro de tu documento. Los datos viven en Grist y LOF les da pantallas amigables.
            </p>
          </div>
          <div class="flex flex-col gap-3">
            <div class="rounded-lg border border-border p-4">
              <div class="flex items-center gap-2 mb-2">
                <GristIcon class="size-5 text-primary" />
                <span class="text-sm font-bold">¿No tenés Grist?</span>
              </div>
              <p class="text-xs text-muted-foreground mb-3">
                Podés usarlo gratis en la nube (getgrist.com) o instalarlo en tu compu.
                El plan gratuito alcanza para la mayoría de las cooperadoras (hasta 5000 filas por tabla).
              </p>
              <Button href="https://www.getgrist.com/" target="_blank" rel="noreferrer" size="sm">
                <GristIcon class="size-4" data-icon="inline-start" />
                Crear cuenta gratis
                <ExternalLinkIcon data-icon="inline-end" />
              </Button>
            </div>
          </div>
          <p class="text-sm text-muted-foreground">Una vez que tengas Grist, agregá LOF a tu documento:</p>
          <ol class="flex flex-col gap-3">
            {#each pasosAgregarWidget as paso, i}
              <li class="flex gap-3 rounded-lg border border-border p-3">
                <div class="flex size-7 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-xs font-bold text-primary">{i + 1}</div>
                <div>
                  <div class="text-sm font-semibold">{paso.titulo}</div>
                  <p class="text-xs text-muted-foreground mt-0.5">{paso.descripcion}</p>
                </div>
              </li>
            {/each}
          </ol>
        </div>
      {:else if camino === 'desktop'}
        <div class="flex flex-col gap-4">
          <div class="rounded-lg border-2 border-primary/30 bg-primary/5 p-4">
            <p class="text-sm">
              <strong>App nativa para tu sistema operativo.</strong>
              Se descarga e instala como cualquier programa. Los datos se guardan en tu compu,
              sin navegador. Disponible para Windows, Linux y macOS.
            </p>
          </div>
          <div class="grid gap-3 sm:grid-cols-3">
            <a
              href={enlaces.repo + '/releases/latest'}
              target="_blank"
              rel="noopener noreferrer"
              class="rounded-lg border border-border p-4 hover:border-primary/50 hover:bg-primary/5 transition-colors text-center"
            >
              <div class="flex size-10 mx-auto items-center justify-center rounded-lg bg-primary/10 text-primary mb-2">
                <DownloadIcon class="size-5" />
              </div>
              <div class="text-sm font-semibold">Windows</div>
              <p class="text-xs text-muted-foreground mt-1">.exe o .msi (x64)</p>
            </a>
            <a
              href={enlaces.repo + '/releases/latest'}
              target="_blank"
              rel="noopener noreferrer"
              class="rounded-lg border border-border p-4 hover:border-primary/50 hover:bg-primary/5 transition-colors text-center"
            >
              <div class="flex size-10 mx-auto items-center justify-center rounded-lg bg-primary/10 text-primary mb-2">
                <DownloadIcon class="size-5" />
              </div>
              <div class="text-sm font-semibold">Linux</div>
              <p class="text-xs text-muted-foreground mt-1">.AppImage o .deb</p>
            </a>
            <a
              href={enlaces.repo + '/releases/latest'}
              target="_blank"
              rel="noopener noreferrer"
              class="rounded-lg border border-border p-4 hover:border-primary/50 hover:bg-primary/5 transition-colors text-center"
            >
              <div class="flex size-10 mx-auto items-center justify-center rounded-lg bg-primary/10 text-primary mb-2">
                <DownloadIcon class="size-5" />
              </div>
              <div class="text-sm font-semibold">macOS</div>
              <p class="text-xs text-muted-foreground mt-1">.dmg (Arm/Intel)</p>
            </a>
          </div>
          <div class="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3">
            <ShieldCheckIcon class="size-5 shrink-0 text-warning mt-0.5" />
            <p class="text-sm text-muted-foreground">
              <strong class="text-foreground">Aviso de seguridad del sistema operativo.</strong>
              Los binarios no están firmados digitalmente (es un proyecto libre sin presupuesto para certificados).
              Al abrirlos por primera vez, el SO advertirá que son de un "desarrollador no identificado".
              En Windows: click en "Más información" → "Ejecutar de todas formas". En macOS: click derecho → Abrir.
            </p>
          </div>
          <p class="text-sm text-muted-foreground">
            Después de instalar, abrí la app y completá la configuración inicial (datos de la escuela, cooperadora, etc.).
            Los datos se guardan en tu compu. Podés respaldarlos desde Configuración → General.
          </p>
        </div>
      {:else if camino === 'no-se'}
        <div class="flex flex-col gap-3">
          <p class="text-sm text-muted-foreground mb-2">No hay problema, te ayudamos a elegir:</p>
          <button type="button" onclick={() => elegirCamino('navegador')} class="text-left rounded-lg border border-border p-4 hover:border-primary/50 hover:bg-primary/5">
            <span class="text-sm font-semibold">¿Querés probar sin instalar nada?</span>
            <p class="text-xs text-muted-foreground mt-1">Usá LOF en el navegador. Los datos se guardan en tu dispositivo y podés respaldarlos cuando quieras.</p>
          </button>
          <button type="button" onclick={() => elegirCamino('respaldo')} class="text-left rounded-lg border border-border p-4 hover:border-primary/50 hover:bg-primary/5">
            <span class="text-sm font-semibold">¿Varios dispositivos necesitan ver los mismos datos?</span>
            <p class="text-xs text-muted-foreground mt-1">Configurá un respaldo local con CouchDB. Todos se sincronizan automáticamente.</p>
          </button>
          <button type="button" onclick={() => elegirCamino('grist')} class="text-left rounded-lg border border-border p-4 hover:border-primary/50 hover:bg-primary/5">
            <span class="text-sm font-semibold">¿Ya usás Grist o querés aprovechar su potencia?</span>
            <p class="text-xs text-muted-foreground mt-1">Agregá LOF como aplicación dentro de tu documento de Grist.</p>
          </button>
          <button type="button" onclick={() => elegirCamino('desktop')} class="text-left rounded-lg border border-border p-4 hover:border-primary/50 hover:bg-primary/5">
            <span class="text-sm font-semibold">¿Preferís una app instalada como cualquier programa?</span>
            <p class="text-xs text-muted-foreground mt-1">Descargá la app nativa para Windows, Linux o macOS.</p>
          </button>
        </div>
      {/if}
    {/if}
  </section>

  <Separator />

  <!-- ¿QUÉ ES GRIST? -->
  <section class="mx-auto max-w-5xl px-4 py-10 sm:py-14">
    <div class="flex flex-col gap-2 mb-6">
      <h2 class="text-2xl font-bold tracking-tight">¿Qué es Grist y por qué podría interesarme?</h2>
      <p class="text-sm text-muted-foreground max-w-prose">
        Grist es una de las formas de usar LOF. No es obligatorio, pero tiene ventajas. Acá te explicamos en simple:
      </p>
    </div>

    <div class="grid gap-4 sm:grid-cols-3">
      <div class="rounded-lg border border-border p-4">
        <div class="flex items-center gap-2 mb-2">
          <DatabaseIcon class="size-5 text-primary" />
          <span class="text-sm font-bold">Grist es como un Excel potente</span>
        </div>
        <p class="text-xs text-muted-foreground">
          Grist es un programa gratuito y de código abierto, como una planilla de cálculo pero más organizada.
          Si ya lo usás, podés guardar los datos de tu cooperadora ahí y aprovechar todas sus funciones de consulta.
        </p>
      </div>
      <div class="rounded-lg border border-border p-4">
        <div class="flex items-center gap-2 mb-2">
          <GristIcon class="size-5 text-primary" />
          <span class="text-sm font-bold">LOF le da pantallas amigables</span>
        </div>
        <p class="text-xs text-muted-foreground">
          LOF funciona dentro de Grist como una aplicación que te da pantallas cómodas para cargar y consultar datos,
          sin que tengas que mirar las tablas a mano. Es como tener una app dedicada sobre tu planilla.
        </p>
      </div>
      <div class="rounded-lg border border-border p-4">
        <div class="flex items-center gap-2 mb-2">
          <ArrowRightLeftIcon class="size-5 text-primary" />
          <span class="text-sm font-bold">Tus datos son tuyos y son portables</span>
        </div>
        <p class="text-xs text-muted-foreground">
          Sea en Grist o en tu navegador, todo lo que cargues es tuyo. Podés exportarlo, hacer copias de seguridad
          o pasarlos a otra compu. No hay lock-in: la información siempre es tuya y la podés llevar con vos.
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

  <!-- MÉTODOS DE INSTALACIÓN (detalle técnico completo, opcional) -->
  <section class="mx-auto max-w-5xl px-4 py-10 sm:py-14">
    <div class="flex flex-col gap-2 mb-6">
      <h2 class="text-2xl font-bold tracking-tight">Ver todas las opciones en detalle</h2>
      <p class="text-sm text-muted-foreground max-w-prose">
        Si preferís revisar vos mismo todas las modalidades técnicas disponibles, desplegá cada una acá.
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
                  Para escuelas
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
        Así se ve el proceso de instalar LOF dentro de Grist. Una vez instalado, un asistente guiado te ayuda a configurar tu cooperadora. Navegá con las flechas para ver cada paso.
      </p>
    </div>

    <Carousel.Root class="w-full">
      <Carousel.Content>
        {#each guia_instalacion.pasos.slice(0, 7) as paso, i}
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
              {#if paso.imagenes}
                {#each paso.imagenes as img}
                  <div class="flex flex-col gap-1.5">
                    <div class="rounded-xl border border-border overflow-hidden bg-muted">
                      <img
                        src={'./' + img.src}
                        alt={img.caption || paso.titulo}
                        class="w-full h-auto object-contain"
                        loading="lazy"
                      />
                    </div>
                    {#if img.caption}
                      <p class="text-xs text-muted-foreground px-1">{img.caption}</p>
                    {/if}
                  </div>
                {/each}
              {:else}
                <div class="rounded-xl border border-border overflow-hidden bg-muted">
                  <img
                    src={'./' + paso.imagen}
                    alt={paso.titulo}
                    class="w-full h-auto object-contain"
                    loading="lazy"
                  />
                </div>
              {/if}
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
        <Button variant="outline" onclick={() => navigate('landing')}>
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
