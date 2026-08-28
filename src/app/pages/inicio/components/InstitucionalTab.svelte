<script>
  import * as Card from '$lib/components/ui/card'
  import { Badge } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import { Skeleton } from '$lib/components/ui/skeleton'
  import CheckCircleIcon from '@lucide/svelte/icons/circle-check'
  import BuildingIcon from '@lucide/svelte/icons/building'
  import CalendarIcon from '@lucide/svelte/icons/calendar'
  import PencilIcon from '@lucide/svelte/icons/pencil'
  import { navigate } from '$core/ui/router.svelte'
  import { formatFecha } from '$core/format/format'
  import InfoField from './InfoField.svelte'

  let {
    loading = false,
    escuela = null,
    banco = null,
    kiosco = null,
    moduloKiosco = false,
    ejercicioEnCurso = null,
  } = $props()
</script>

{#if loading}
  <div class="flex flex-col gap-4">
    <Skeleton class="h-64 w-full" />
  </div>
{:else}
  <Card.Root>
    <Card.Header>
      <Card.Title class="text-base flex items-center gap-2">
        <CalendarIcon class="size-4" />
        Ejercicio en curso
      </Card.Title>
    </Card.Header>
    <Card.Content class="flex flex-col gap-3">
      {#if ejercicioEnCurso}
        <div class="grid gap-3 sm:grid-cols-2">
          <InfoField label="Período" value={`${ejercicioEnCurso.anio_inicio}-${ejercicioEnCurso.anio_fin}`} />
          <InfoField label="Mes de inicio" value={ejercicioEnCurso.mes_inicio} />
          <InfoField label="Fecha desde" value={formatFecha(ejercicioEnCurso.fecha_inicio)} />
          <InfoField label="Fecha hasta" value={formatFecha(ejercicioEnCurso.fecha_fin)} />
          {#if ejercicioEnCurso.saldo_inicial_total != null}
            <InfoField label="Saldo inicial total" value={`$${Number(ejercicioEnCurso.saldo_inicial_total).toLocaleString('es-AR')}`} />
          {/if}
          {#if ejercicioEnCurso.observaciones}
            <InfoField label="Observaciones" value={ejercicioEnCurso.observaciones} />
          {/if}
        </div>
        <Badge variant="default" class="w-fit">En curso</Badge>
      {:else}
        <p class="text-sm text-muted-foreground">No hay un ejercicio activo. Creá uno desde la sección de ejercicios.</p>
      {/if}
    </Card.Content>
  </Card.Root>

  <Card.Root>
    <Card.Header>
      <Card.Title class="text-base flex items-center gap-2">
        <BuildingIcon class="size-4" />
        Escuela y cooperadora
      </Card.Title>
    </Card.Header>
    <Card.Content class="flex flex-col gap-4">
      <div class="grid gap-3 sm:grid-cols-2">
        <InfoField label="Distrito" value={escuela?.distrito} />
        <InfoField label="Escuela" value={escuela?.escuela_nombre} />
        <InfoField label="Número" value={escuela?.escuela_numero} />
        <InfoField label="CUE" value={escuela?.cue} />
        <InfoField label="CUIT" value={escuela?.cuit} />
        <InfoField label="Cooperadora" value={escuela?.cooperadora_nombre} />
        <InfoField label="Domicilio" value={escuela?.domicilio} />
        <InfoField label="Localidad" value={escuela?.localidad} />
        <InfoField label="Email cooperadora" value={escuela?.email_cooperadora} />
        <InfoField label="Teléfono cooperadora" value={escuela?.telefono_cooperadora} />
      </div>
      {#if escuela?.datos_validados}
        <Badge variant="secondary" class="w-fit"><CheckCircleIcon class="size-3" /> Datos validados</Badge>
      {/if}
    </Card.Content>
  </Card.Root>

  {#if banco?.entidad || banco?.tipo_cuenta}
    <Card.Root>
      <Card.Header>
        <Card.Title class="text-base">Datos bancarios</Card.Title>
      </Card.Header>
      <Card.Content class="flex flex-col gap-3">
        <div class="grid gap-3 sm:grid-cols-2">
          <InfoField label="Entidad" value={banco?.entidad} />
          <InfoField label="Tipo de cuenta" value={banco?.tipo_cuenta} />
        </div>
        {#if banco?.banco_validado}
          <Badge variant="secondary" class="w-fit"><CheckCircleIcon class="size-3" /> Datos validados</Badge>
        {/if}
      </Card.Content>
    </Card.Root>
  {/if}

  {#if moduloKiosco}
    <Card.Root>
      <Card.Header>
        <Card.Title class="text-base">Kiosco / Librería</Card.Title>
      </Card.Header>
      <Card.Content class="flex flex-col gap-3">
        <div class="grid gap-3 sm:grid-cols-2">
          <InfoField label="Posee" value={kiosco?.posee ? 'Sí' : 'No'} />
          {#if kiosco?.posee}
            <InfoField label="Modalidad" value={kiosco?.modalidad} />
          {/if}
        </div>
      </Card.Content>
    </Card.Root>
  {/if}

  <div class="flex justify-end">
    <Button variant="outline" size="sm" onclick={() => navigate('cooperadora')}>
      <PencilIcon data-icon="inline-start" />
      Ver más / Editar / Gestionar ejercicios
    </Button>
  </div>
{/if}
