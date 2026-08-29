<script lang="ts">
  import { Button } from '$lib/components/ui/button'
  import * as Card from '$lib/components/ui/card'
  import LockIcon from '@lucide/svelte/icons/lock'
  import MailIcon from '@lucide/svelte/icons/mail'
  import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left'
  import ShieldIcon from '@lucide/svelte/icons/shield'
  import HeartHandshakeIcon from '@lucide/svelte/icons/heart-handshake'
  import { identidad } from '$core/data/identidad'
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
          <ShieldIcon class="size-6" />
        </div>
        <h1 class="text-3xl font-bold tracking-tight">Seguridad</h1>
      </div>
      <p class="text-base text-muted-foreground max-w-prose">
        Si encontraste una vulnerabilidad en LOF, agradecemos que la reportes de manera privada para que podamos abordarla con cuidado.
      </p>
    </div>
  </section>

  <!-- CONTENIDO -->
  <section class="mx-auto max-w-3xl px-4 py-12">
    <Card.Root>
      <Card.Header>
        <div class="flex items-center gap-3">
          <div class="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <LockIcon class="size-5" />
          </div>
          <Card.Title>Reportar una vulnerabilidad</Card.Title>
        </div>
      </Card.Header>
      <Card.Content class="flex flex-col gap-4">
        <p class="text-sm text-muted-foreground">
          <strong class="text-foreground">No publiques información sobre vulnerabilidades en foros públicos</strong>, issues de GitHub o redes sociales. Eso expone a otras cooperadoras mientras trabajamos en la solución.
        </p>
        <p class="text-sm text-muted-foreground">
          Escribinos en privado a:
        </p>
        <a href="mailto:seguridad@lof.mdsoluciones.ar" class="inline-flex items-center gap-2 text-base font-semibold text-primary hover:underline">
          <MailIcon class="size-5" />
          seguridad@lof.mdsoluciones.ar
        </a>
        <p class="text-sm text-muted-foreground">
          En el mail, por favor incluí:
        </p>
        <ul class="ml-5 list-disc text-sm text-muted-foreground flex flex-col gap-1">
          <li>Descripción del problema y su impacto.</li>
          <li>Pasos para reproducirlo.</li>
          <li>Versión de LOF y entorno (navegador, sistema operativo).</li>
          <li>Cualquier fix o mitigación que hayas considerado.</li>
        </ul>
        <p class="text-sm text-muted-foreground">
          Nos comprometemos a responder a la brevedad y a reconocer tu aporte cuando se publique la solución.
        </p>
      </Card.Content>
    </Card.Root>

    <div class="mt-6 rounded-lg border border-border bg-muted/30 px-4 py-3">
      <p class="text-sm text-muted-foreground">
        LOF es software libre bajo AGPL-3.0. El código es público y auditable en el <a href="https://github.com/sosamilton/lof-pba" target="_blank" rel="noopener noreferrer" class="font-semibold text-primary hover:underline">repositorio de GitHub</a>.
      </p>
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
