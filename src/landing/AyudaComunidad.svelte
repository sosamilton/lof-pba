<script lang="ts">
  import { Button } from '$lib/components/ui/button'
  import * as Card from '$lib/components/ui/card'
  import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left'
  import HeartHandshakeIcon from '@lucide/svelte/icons/heart-handshake'
  import LightbulbIcon from '@lucide/svelte/icons/lightbulb'
  import BugIcon from '@lucide/svelte/icons/bug'
  import HelpCircleIcon from '@lucide/svelte/icons/help-circle'
  import MailIcon from '@lucide/svelte/icons/mail'
  import CodeIcon from '@lucide/svelte/icons/code'
  import CopyIcon from '@lucide/svelte/icons/copy'
  import CheckIcon from '@lucide/svelte/icons/check'
  import ThumbsUpIcon from '@lucide/svelte/icons/thumbs-up'
  import { identidad } from '$core/data/identidad'

  const FIDER_URL = 'https://lof-pba.fider.io'

  // Fider no tiene ruta /posts/new. El botón "Nuevo" está en la home.
  // Con ?tags=slug se preselecciona el tag al crear un post (PR #1306).
  const fiderMejora = FIDER_URL + '/?tags=mejora'
  const fiderProblema = FIDER_URL + '/?tags=problema'
  const fiderAyuda = FIDER_URL + '/?tags=ayuda'

  let copiedMail = $state<string | null>(null)

  async function copiarEmail(email: string) {
    try {
      await navigator.clipboard.writeText(email)
      copiedMail = email
      setTimeout(() => { if (copiedMail === email) copiedMail = null }, 2000)
    } catch {
      // Fallback: seleccionar el texto
      const range = document.createRange()
      const el = document.getElementById('email-' + email.replace(/[@.]/g, '-'))
      if (el) {
        range.selectNodeContents(el)
        const sel = window.getSelection()
        sel?.removeAllRanges()
        sel?.addRange(range)
      }
    }
  }
</script>

<main class="min-h-screen bg-background text-foreground">
  <a
    href="#contenido"
    class="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[100] focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:shadow-md"
  >
    Saltar al contenido
  </a>

  <!-- NAVBAR -->
  <nav class="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
    <div class="mx-auto max-w-5xl px-4 h-14 flex items-center justify-between">
      <a href="#landing" class="flex items-center gap-2">
        <HeartHandshakeIcon class="size-6 text-primary" />
        <span class="font-bold">{identidad.nombre}</span>
      </a>
      <Button variant="ghost" size="sm" href="#landing">
        <ArrowLeftIcon data-icon="inline-start" />
        Volver al inicio
      </Button>
    </div>
  </nav>

  <!-- HEADER -->
  <section id="contenido" class="border-b border-border bg-gradient-to-br from-primary/10 via-transparent to-chart-2/5">
    <div class="mx-auto max-w-3xl px-4 py-12">
      <div class="flex items-center gap-3 mb-4">
        <div class="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <HeartHandshakeIcon class="size-6" />
        </div>
        <h1 class="text-3xl font-bold tracking-tight">Ayuda y comunidad</h1>
      </div>
      <p class="text-base text-muted-foreground max-w-prose">
        Para usar y mejorar LOF. Sugerí mejoras, reportá problemas, pedí ayuda y votá las ideas de otras cooperadoras.
      </p>
    </div>
  </section>

  <!-- AYUDAR A MEJORAR LOF (Fider) -->
  <section class="mx-auto max-w-3xl px-4 py-12">
    <h2 class="text-lg font-bold tracking-tight mb-4">Ayudanos a mejorar LOF</h2>
    <div class="grid gap-4 sm:grid-cols-2">
      <Card.Root>
        <Card.Header>
          <div class="flex items-center gap-3">
            <div class="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <LightbulbIcon class="size-5" />
            </div>
            <Card.Title class="text-base">Tengo una idea</Card.Title>
          </div>
        </Card.Header>
        <Card.Content class="flex flex-col gap-3">
          <p class="text-sm text-muted-foreground">
            Algo que te gustaría que LOF pudiera hacer. Tu propuesta puede ayudar a otras cooperadoras.
          </p>
          <Button variant="default" size="sm" class="w-fit" href={fiderMejora} target="_blank" rel="noopener noreferrer">
            Proponer una mejora
          </Button>
        </Card.Content>
      </Card.Root>
      <Card.Root>
        <Card.Header>
          <div class="flex items-center gap-3">
            <div class="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <BugIcon class="size-5" />
            </div>
            <Card.Title class="text-base">Encontré un problema</Card.Title>
          </div>
        </Card.Header>
        <Card.Content class="flex flex-col gap-3">
          <p class="text-sm text-muted-foreground">
            Algo que no funciona como esperabas. Contanos con tus palabras, no hace falta saber términos técnicos.
          </p>
          <Button variant="default" size="sm" class="w-fit" href={fiderProblema} target="_blank" rel="noopener noreferrer">
            Reportar un problema
          </Button>
        </Card.Content>
      </Card.Root>
      <Card.Root>
        <Card.Header>
          <div class="flex items-center gap-3">
            <div class="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <HelpCircleIcon class="size-5" />
            </div>
            <Card.Title class="text-base">Necesito ayuda</Card.Title>
          </div>
        </Card.Header>
        <Card.Content class="flex flex-col gap-3">
          <p class="text-sm text-muted-foreground">
            No sabés cómo hacer algo o no entendés cómo funciona. Mirá si alguien ya preguntó lo mismo.
          </p>
          <Button variant="default" size="sm" class="w-fit" href={fiderAyuda} target="_blank" rel="noopener noreferrer">
            Buscar ayuda
          </Button>
        </Card.Content>
      </Card.Root>
      <Card.Root>
        <Card.Header>
          <div class="flex items-center gap-3">
            <div class="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ThumbsUpIcon class="size-5" />
            </div>
            <Card.Title class="text-base">Votar una propuesta</Card.Title>
          </div>
        </Card.Header>
        <Card.Content class="flex flex-col gap-3">
          <p class="text-sm text-muted-foreground">
            Votá o comentá una idea que ya propuso otra cooperadora. Las más votadas se priorizan.
          </p>
          <Button variant="default" size="sm" class="w-fit" href={FIDER_URL} target="_blank" rel="noopener noreferrer">
            Ver y votar ideas
          </Button>
        </Card.Content>
      </Card.Root>
    </div>
  </section>

  <!-- CONVERSEMOS (mails) -->
  <section class="mx-auto max-w-3xl px-4 pb-12">
    <h2 class="text-lg font-bold tracking-tight mb-4">¿Querés conversar con el proyecto?</h2>
    <p class="text-sm text-muted-foreground max-w-prose mb-4">
      Para articulaciones, colaboraciones, implementación y propuestas institucionales.
    </p>
    <div class="grid gap-4 sm:grid-cols-2">
      <Card.Root>
        <Card.Header>
          <div class="flex items-center gap-3">
            <div class="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <MailIcon class="size-5" />
            </div>
            <Card.Title class="text-base">Hablemos</Card.Title>
          </div>
        </Card.Header>
        <Card.Content class="flex flex-col gap-2">
          <p class="text-sm text-muted-foreground">
            Si representás una escuela, cooperadora, federación, municipio u organización.
          </p>
          <div class="flex items-center gap-2">
            <span id="email-hola-lof-mdsoluciones-ar" class="text-sm font-semibold text-primary">hola@lof.mdsoluciones.ar</span>
            <button
              type="button"
              onclick={() => copiarEmail('hola@lof.mdsoluciones.ar')}
              class="inline-flex items-center justify-center size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Copiar email"
              title="Copiar email"
            >
              {#if copiedMail === 'hola@lof.mdsoluciones.ar'}
                <CheckIcon class="size-4 text-green-600" />
              {:else}
                <CopyIcon class="size-4" />
              {/if}
            </button>
          </div>
          <a href="mailto:hola@lof.mdsoluciones.ar" class="text-xs text-muted-foreground hover:text-primary hover:underline">Abrir en mi cliente de mail</a>
        </Card.Content>
      </Card.Root>
      <Card.Root>
        <Card.Header>
          <div class="flex items-center gap-3">
            <div class="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CodeIcon class="size-5" />
            </div>
            <Card.Title class="text-base">Colaborar con el código</Card.Title>
          </div>
        </Card.Header>
        <Card.Content class="flex flex-col gap-2">
          <p class="text-sm text-muted-foreground">
            El código es abierto. Reportá bugs técnicos o contribuí desde GitHub.
          </p>
          <a href="https://github.com/sosamilton/lof-pba" target="_blank" rel="noopener noreferrer" class="text-sm font-semibold text-primary hover:underline">Repositorio en GitHub</a>
        </Card.Content>
      </Card.Root>
    </div>
  </section>

  <!-- FOOTER -->
  <footer class="border-t border-border">
    <div class="mx-auto max-w-5xl px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
      <div class="flex items-center gap-2">
        <HeartHandshakeIcon class="size-6 text-primary" />
        <span class="text-sm font-medium">{identidad.nombre} · {identidad.lema}</span>
      </div>
      <Button variant="outline" size="sm" href="#landing">
        <ArrowLeftIcon data-icon="inline-start" />
        Volver al inicio
      </Button>
    </div>
  </footer>
</main>
