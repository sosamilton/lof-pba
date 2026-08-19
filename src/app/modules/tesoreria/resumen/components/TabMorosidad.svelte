<script>
  import * as Card from '$lib/components/ui/card'
  import * as Table from '$lib/components/ui/table'
  import { Badge } from '$lib/components/ui/badge'
  import { formatARS } from '$core/utils/utils'
  import AlertTriangleIcon from '@lucide/svelte/icons/triangle-alert'
  import UsersIcon from '@lucide/svelte/icons/users'
  import CheckCircleIcon from '@lucide/svelte/icons/circle-check'
  import PercentIcon from '@lucide/svelte/icons/percent'

  let { store } = $props()
  let m = $derived(store.morosidad)
  let v = $derived(m.vinculacion || {})

  let porcentajeCobrado = $derived(m.esperado > 0 ? (m.cobrado / m.esperado) * 100 : 0)
  let porcentajeMorosidad = $derived(m.morosidad * 100)
  // Hay datos vinculados a socios si hay movimientos con socio_id
  let esIntegral = $derived(store.modoGestion === 'gestion_integral')
  // Modo mixto: hay vinculados Y no vinculados (cambio de gestión a mitad)
  let esMixto = $derived(v.tieneVinculados && v.tieneNoVinculados)
</script>

{#if !m.tieneDatos}
  <Card.Root>
    <Card.Content class="pt-6">
      <div class="flex items-center gap-2 text-sm text-muted-foreground">
        <AlertTriangleIcon class="size-4" />
        No hay datos suficientes para calcular la morosidad. Se necesita:
      </div>
      <ul class="ml-6 mt-2 list-disc text-sm text-muted-foreground">
        {#if !m.rubroCuotaId}<li>Un rubro de "cuota social" en Rubros oficiales (nombre que contenga "cuota", "socio" o "societaria").</li>{/if}
        {#if m.importeCuota === 0}<li>Una asamblea AGO del ejercicio con el importe de cuota social cargado.</li>{/if}
        {#if m.sociosActivos === 0}<li>Socios activos cargados en el módulo Comunidad.</li>{/if}
      </ul>
    </Card.Content>
  </Card.Root>
{:else}
  <!-- KPIs de morosidad -->
  <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-4">
    <Card.Root>
      <Card.Content class="pt-4 pb-4">
        <div class="flex items-center gap-2 text-xs text-muted-foreground">
          <UsersIcon class="size-3.5" />
          Socios activos
        </div>
        <div class="text-xl font-bold">{m.sociosActivos}</div>
      </Card.Content>
    </Card.Root>

    <Card.Root>
      <Card.Content class="pt-4 pb-4">
        <div class="text-xs text-muted-foreground">Cuota social</div>
        <div class="text-xl font-bold">{formatARS(m.importeCuota)}</div>
        <div class="text-xs text-muted-foreground">{m.modalidad} · {m.mesesTranscurridos} meses</div>
      </Card.Content>
    </Card.Root>

    <Card.Root>
      <Card.Content class="pt-4 pb-4">
        <div class="flex items-center gap-2 text-xs text-muted-foreground">
          <CheckCircleIcon class="size-3.5 text-primary" />
          Cobrado vs. esperado
        </div>
        <div class="text-lg font-bold text-primary">{formatARS(m.cobrado)}</div>
        <div class="text-xs text-muted-foreground">de {formatARS(m.esperado)} ({porcentajeCobrado.toFixed(1)}%)</div>
      </Card.Content>
    </Card.Root>

    <Card.Root class={porcentajeMorosidad > 30 ? 'border-destructive/40' : ''}>
      <Card.Content class="pt-4 pb-4">
        <div class="flex items-center gap-2 text-xs text-muted-foreground">
          <PercentIcon class="size-3.5" />
          Morosidad
        </div>
        <div class="text-xl font-bold {porcentajeMorosidad > 30 ? 'text-destructive' : ''}">
          {porcentajeMorosidad.toFixed(1)}%
        </div>
        <div class="text-xs text-muted-foreground">{m.deudores.length} socios sin pago registrado</div>
      </Card.Content>
    </Card.Root>
  </div>

  <!-- Cálculo explicativo -->
  <Card.Root class="mb-4">
    <Card.Content class="pt-4 text-sm text-muted-foreground">
      <strong>Cómo se calcula:</strong>
      esperado = cuota social ({formatARS(m.importeCuota)}) × socios activos ({m.sociosActivos})
      × meses transcurridos ({m.mesesTranscurridos}{m.modalidad === 'Anual' ? ', modalidad anual' : ''})
      = <strong>{formatARS(m.esperado)}</strong>.
      Cobrado = suma de movimientos del rubro "cuota social" del ejercicio
      = <strong>{formatARS(m.cobrado)}</strong>.
    </Card.Content>
  </Card.Root>

  <!-- Aviso de modo mixto (cambio de gestión a mitad del ejercicio) -->
  {#if esMixto}
    <Card.Root class="mb-4 border-warning/30">
      <Card.Content class="pt-4 text-sm">
        <div class="flex items-start gap-2">
          <AlertTriangleIcon class="size-4 text-warning shrink-0 mt-0.5" />
          <div>
            <strong>Datos parcialmente vinculados.</strong> Hay movimientos de cuota social
            sin socio_id (carga consolidada) y otros con socio_id (gestión integral)
            desde <span class="font-mono">{v.fechaCorte || 'fecha desconocida'}</span>.
            <br>
            Cobrado vinculado: <strong>{formatARS(v.cobradoVinculado)}</strong> sobre
            esperado <strong>{formatARS(v.esperadoVinculado)}</strong>
            ({v.mesesVinculados} meses con datos identificables).
            Cobrado no vinculado (consolidado): <strong>{formatARS(v.cobradoNoVinculado)}</strong>.
            <br>
            <span class="text-muted-foreground">
              La morosidad general usa el total cobrado. Los deudores se calculan
              solo sobre el tramo vinculado ({v.mesesVinculados} meses).
            </span>
          </div>
        </div>
      </Card.Content>
    </Card.Root>
  {/if}

  <!-- Lista de deudores (solo si hay datos vinculados a socios) -->
  {#if v.tieneVinculados}
    <Card.Root>
      <Card.Header>
        <Card.Title class="text-sm flex items-center gap-2">
          Socios sin pago registrado
          <Badge variant="secondary">{m.deudores.length}</Badge>
          {#if esMixto}
            <span class="text-xs text-muted-foreground font-normal">
              (solo desde {v.fechaCorte})
            </span>
          {/if}
        </Card.Title>
      </Card.Header>
      <Card.Content class="pt-4">
        {#if m.deudores.length === 0}
          <p class="text-sm text-muted-foreground text-center py-6">
            Todos los socios activos tienen al menos un pago de cuota social registrado
            {#if esMixto}en el tramo vinculado{/if}.
          </p>
        {:else}
          <Table.Root>
            <Table.Header>
              <Table.Row>
                <Table.Head>Apellido</Table.Head>
                <Table.Head>Nombre</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {#each m.deudores.slice(0, 50) as d (d.id)}
                <Table.Row>
                  <Table.Cell class="text-sm">{d.apellido || '(sin apellido)'}</Table.Cell>
                  <Table.Cell class="text-sm">{d.nombre || '(sin nombre)'}</Table.Cell>
                </Table.Row>
              {/each}
            </Table.Body>
          </Table.Root>
          {#if m.deudores.length > 50}
            <p class="text-xs text-muted-foreground mt-2 text-center">
              Mostrando 50 de {m.deudores.length} socios sin pago.
            </p>
          {/if}
        {/if}
      </Card.Content>
    </Card.Root>
  {:else}
    <Card.Root>
      <Card.Header>
        <Card.Title class="text-sm">Identificación de deudores</Card.Title>
      </Card.Header>
      <Card.Content class="pt-4">
        <div class="flex items-center gap-2 text-sm text-muted-foreground">
          <AlertTriangleIcon class="size-4 shrink-0" />
          {#if esIntegral}
            No hay movimientos de cuota social con socio_id en este ejercicio.
            Para identificar deudores, cargá pagos vinculando el socio en el
            formulario de movimientos.
          {:else}
            En modo <strong>carga consolidada</strong> los movimientos no están vinculados
            a socios individuales, por lo que no es posible identificar deudores.
            La estimación de morosidad (esperado vs. cobrado) sigue disponible arriba.
            Para identificar deudores, cambiá a <strong>gestión integral</strong> en
            Inicio → Configuración.
          {/if}
        </div>
      </Card.Content>
    </Card.Root>
  {/if}
{/if}
