<script>
  import { onMount } from 'svelte'
  import { cierreStore as store } from './cierreStore.svelte.js'
  import * as Card from '$lib/components/ui/card'
  import * as Tabs from '$lib/components/ui/tabs'
  import * as Alert from '$lib/components/ui/alert'
  import { Badge } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import { Label } from '$lib/components/ui/label'
  import * as Select from '$lib/components/ui/select'
  import EjercicioSelector from '$lib/components/EjercicioSelector.svelte'
  import PageScaffold from '$lib/components/PageScaffold.svelte'
  import CierreAlertas from './components/CierreAlertas.svelte'
  import TabMemoria from './components/TabMemoria.svelte'
  import { formatFechaGrist } from '../shared/tesoreriaCalc.js'
  import FileTextIcon from '@lucide/svelte/icons/file-text'
  import BookIcon from '@lucide/svelte/icons/book-open'
  import LockIcon from '@lucide/svelte/icons/lock'
  import UnlockIcon from '@lucide/svelte/icons/lock-open'
  import DownloadIcon from '@lucide/svelte/icons/download'
  import EyeIcon from '@lucide/svelte/icons/eye'
  import CheckCircleIcon from '@lucide/svelte/icons/circle-check'
  import AlertTriangleIcon from '@lucide/svelte/icons/triangle-alert'

  let tabActiva = $state('pia')

  onMount(() => {
    store.load()
  })

  const ejerciciosOptions = $derived(
    store.ejercicios
      .slice()
      .sort((a, b) => Number(b.anio_inicio || 0) - Number(a.anio_inicio || 0))
      .map((e) => ({
        value: String(e.id),
        label: `${e.anio_inicio || '?'}-${e.anio_fin || '?'}`,
        item: e,
      }))
  )

  const onEjercicioChange = (e) => {
    const id = Number(e)
    if (id) store.seleccionarEjercicio(id)
  }

  const handleCerrar = () => {
    if (!store.ejercicioSeleccionadoId) return
    store.cerrarEjercicio(store.ejercicioSeleccionadoId)
  }

  const handleReabrir = () => {
    if (!store.ejercicioSeleccionadoId) return
    store.reabrirEjercicio(store.ejercicioSeleccionadoId)
  }

  const handlePreviewPia = () => store.previsualizarPia()
  const handlePreviewNomina = () => store.previsualizarNomina()
  const handleDownloadPia = () => store.descargarPia()
  const handleDownloadNomina = () => store.descargarNomina()

  // Planillas generadas del ejercicio seleccionado
  const planillasDelEjercicio = $derived(
    store.ejercicioSeleccionadoId
      ? store.planillasGeneradas.filter(
          (p) => Number(p.ejercicio_id) === Number(store.ejercicioSeleccionadoId)
        )
      : []
  )
</script>

<PageScaffold title="Cierre de Ciclo" loading={store.loading} error={store.error} notice={store.notice}>
  <div class="flex items-center gap-2 mb-4">
    <FileTextIcon class="size-5 text-muted-foreground" />
    <h1 class="text-lg font-bold">Cierre de Ciclo / Presentación</h1>
  </div>

  <div class="flex flex-col gap-4">
    <!-- Selector de ejercicio -->
    <Card.Root>
      <Card.Header>
        <Card.Title>Seleccionar ejercicio</Card.Title>
        <Card.Description>
          Elegí el ejercicio para previsualizar, generar y cerrar los formularios oficiales (PIA y Nómina).
        </Card.Description>
      </Card.Header>
      <Card.Content class="flex flex-col gap-4">
        <div class="flex flex-wrap items-end gap-4">
          <div class="flex flex-col gap-2 min-w-48">
            <Label for="ejercicio">Ejercicio</Label>
            <EjercicioSelector
              id="ejercicio"
              ejercicios={store.ejercicios}
              value={store.ejercicioSeleccionadoId}
              onValueChange={onEjercicioChange}
              placeholder="Seleccionar…"
              class="w-full h-9 text-sm"
              showBadges={true}
              showEnCurso={false}
              showMesInicio={true}
            />
          </div>

          {#if store.ejercicioSeleccionado?.cerrado}
            <Badge variant="secondary" class="gap-1">
              <LockIcon class="size-3.5" />
              Cerrado el {formatFechaGrist(store.ejercicioSeleccionado?.fecha_cierre)}
            </Badge>
          {:else if store.ejercicioSeleccionado?.en_curso}
            <Badge variant="outline">En curso</Badge>
          {/if}
        </div>

        {#if store.ejercicioSeleccionado && !store.cierreData && !store.loading}
          <p class="text-sm text-muted-foreground">Cargando datos del ejercicio…</p>
        {/if}
      </Card.Content>
    </Card.Root>

    {#if store.cierreData}
      <!-- Resumen de datos cargados -->
      <Card.Root>
        <Card.Header>
          <Card.Title class="text-base">Resumen del ejercicio</Card.Title>
        </Card.Header>
        <Card.Content>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p class="text-muted-foreground">Total socios</p>
              <p class="font-medium">{store.cierreData.totalSocios}</p>
            </div>
            <div>
              <p class="text-muted-foreground">Autoridades CD</p>
              <p class="font-medium">{store.cierreData.autoridadesCD.length}</p>
            </div>
            <div>
              <p class="text-muted-foreground">Total entradas</p>
              <p class="font-medium">${store.cierreData.totalEntradas.toLocaleString('es-AR')}</p>
            </div>
            <div>
              <p class="text-muted-foreground">Total salidas</p>
              <p class="font-medium">${store.cierreData.totalSalidas.toLocaleString('es-AR')}</p>
            </div>
          </div>
          <CierreAlertas data={store.cierreData} />
        </Card.Content>
      </Card.Root>

      <!-- Tabs: PIA / Nómina / Historial -->
      <Tabs.Root value={tabActiva} onValueChange={(e) => (tabActiva = e)}>
        <Tabs.List>
          <Tabs.Trigger value="pia">PIA</Tabs.Trigger>
          <Tabs.Trigger value="nomina">Nómina</Tabs.Trigger>
          <Tabs.Trigger value="memoria">
            <BookIcon data-icon="inline-start" />
            Memoria
          </Tabs.Trigger>
          <Tabs.Trigger value="historial">Historial</Tabs.Trigger>
        </Tabs.List>

        <!-- Tab PIA -->
        <Tabs.Content value="pia">
          <Card.Root>
            <Card.Header>
              <Card.Title class="text-base">Planilla de Información Anual (PIA)</Card.Title>
              <Card.Description>
                Previsualizá el PIA con los datos del ejercicio. Cuando esté correcto, descargá el PDF.
              </Card.Description>
            </Card.Header>
            <Card.Content class="flex flex-col gap-4">
              <div class="flex flex-wrap gap-2">
                <Button onclick={handlePreviewPia} disabled={store.generandoPia}>
                  <EyeIcon data-icon="inline-start" />
                  {store.generandoPia ? 'Generando…' : 'Previsualizar'}
                </Button>
                <Button variant="outline" onclick={handleDownloadPia} disabled={store.generandoPia}>
                  <DownloadIcon data-icon="inline-start" />
                  Descargar PDF
                </Button>
              </div>

              {#if store.previewPiaUrl}
                <div class="border rounded-md overflow-hidden bg-muted/30">
                  <iframe
                    src={store.previewPiaUrl}
                    title="Previsualización PIA"
                    class="w-full"
                    style="height: 70vh"
                  ></iframe>
                </div>
              {/if}
            </Card.Content>
          </Card.Root>
        </Tabs.Content>

        <!-- Tab Nómina -->
        <Tabs.Content value="nomina">
          <Card.Root>
            <Card.Header>
              <Card.Title class="text-base">Nómina de Comisión Directiva</Card.Title>
              <Card.Description>
                Previsualizá la nómina de autoridades con los datos del ejercicio.
              </Card.Description>
            </Card.Header>
            <Card.Content class="flex flex-col gap-4">
              <div class="flex flex-wrap gap-2">
                <Button onclick={handlePreviewNomina} disabled={store.generandoNomina}>
                  <EyeIcon data-icon="inline-start" />
                  {store.generandoNomina ? 'Generando…' : 'Previsualizar'}
                </Button>
                <Button variant="outline" onclick={handleDownloadNomina} disabled={store.generandoNomina}>
                  <DownloadIcon data-icon="inline-start" />
                  Descargar PDF
                </Button>
              </div>

              {#if store.previewNominaUrl}
                <div class="border rounded-md overflow-hidden bg-muted/30">
                  <iframe
                    src={store.previewNominaUrl}
                    title="Previsualización Nómina"
                    class="w-full"
                    style="height: 70vh"
                  ></iframe>
                </div>
              {/if}
            </Card.Content>
          </Card.Root>
        </Tabs.Content>

        <!-- Tab Memoria -->
        <Tabs.Content value="memoria">
          <Card.Root>
            <Card.Header>
              <Card.Title class="text-base">Memoria anual del ejercicio</Card.Title>
              <Card.Description>
                Generá, editá y exportá la Memoria anual. Se compila automáticamente desde los hechos relevantes
                registrados en el módulo de Asambleas y Memorias.
              </Card.Description>
            </Card.Header>
            <Card.Content>
              <TabMemoria {store} />
            </Card.Content>
          </Card.Root>
        </Tabs.Content>

        <!-- Tab Historial -->
        <Tabs.Content value="historial">
          <Card.Root>
            <Card.Header>
              <Card.Title class="text-base">Planillas generadas</Card.Title>
              <Card.Description>
                Registro de planillas generadas para este ejercicio.
              </Card.Description>
            </Card.Header>
            <Card.Content>
              {#if planillasDelEjercicio.length === 0}
                <p class="text-sm text-muted-foreground">No hay planillas registradas para este ejercicio.</p>
              {:else}
                <div class="flex flex-col gap-2">
                  {#each planillasDelEjercicio as p (p.id)}
                    <div class="flex items-center justify-between border rounded-md px-3 py-2">
                      <div class="flex items-center gap-2">
                        <FileTextIcon class="size-4 text-muted-foreground" />
                        <span class="text-sm font-medium">{p.tipo_planilla}</span>
                        <span class="text-xs text-muted-foreground">
                          {p.fecha_generacion ? new Date(p.fecha_generacion).toLocaleString('es-AR') : ''}
                        </span>
                      </div>
                      <Badge variant="outline">v{p.version_formulario || '?'}</Badge>
                    </div>
                  {/each}
                </div>
              {/if}
            </Card.Content>
          </Card.Root>
        </Tabs.Content>
      </Tabs.Root>

      <!-- Acciones de cierre -->
      <Card.Root>
        <Card.Header>
          <Card.Title class="text-base">Cerrar ejercicio</Card.Title>
          <Card.Description>
            Al cerrar el ejercicio se registra la fecha de cierre y se guardan las planillas generadas.
            El ejercicio cerrado queda como referencia histórica.
          </Card.Description>
        </Card.Header>
        <Card.Content class="flex flex-col gap-4">
          {#if store.estaCerrado}
            <Alert.Root>
              <CheckCircleIcon data-icon="inline-start" />
              <Alert.Title>Ejercicio cerrado</Alert.Title>
              <Alert.Description>
                Este ejercicio fue cerrado el {formatFechaGrist(store.ejercicioSeleccionado?.fecha_cierre)}.
                Podés reabrirlo si necesitás hacer correcciones.
              </Alert.Description>
            </Alert.Root>
            <Button variant="outline" onclick={handleReabrir} disabled={store.busy}>
              <UnlockIcon data-icon="inline-start" />
              Reabrir ejercicio
            </Button>
          {:else}
            <Alert.Root variant="default">
              <AlertTriangleIcon data-icon="inline-start" />
              <Alert.Title>Confirmar cierre</Alert.Title>
              <Alert.Description>
                Asegurate de haber previsualizado el PIA y la Nómina antes de cerrar.
                El cierre registra la fecha actual y las planillas generadas.
              </Alert.Description>
            </Alert.Root>
            <Button onclick={handleCerrar} disabled={store.busy}>
              <LockIcon data-icon="inline-start" />
              {store.busy ? 'Cerrando…' : 'Cerrar ejercicio'}
            </Button>
          {/if}
        </Card.Content>
      </Card.Root>
    {/if}
  </div>
</PageScaffold>
