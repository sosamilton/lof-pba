<script>
  import * as Card from '$lib/components/ui/card'
  import { Badge } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import { Skeleton } from '$lib/components/ui/skeleton'
  import CheckCircleIcon from '@lucide/svelte/icons/circle-check'
  import BuildingIcon from '@lucide/svelte/icons/building'
  import PencilIcon from '@lucide/svelte/icons/pencil'
  import { navigate } from '$core/router.svelte'

  let {
    loading = false,
    escuela = null,
    banco = null,
    kiosco = null,
    moduloKiosco = false,
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
        <BuildingIcon class="size-4" />
        Escuela y cooperadora
      </Card.Title>
    </Card.Header>
    <Card.Content class="flex flex-col gap-4">
      <div class="grid gap-3 sm:grid-cols-2">
        <div>
          <div class="text-xs text-muted-foreground">Distrito</div>
          <div class="text-sm font-medium">{escuela?.distrito || '—'}</div>
        </div>
        <div>
          <div class="text-xs text-muted-foreground">Escuela</div>
          <div class="text-sm font-medium">{escuela?.escuela_nombre || '—'}</div>
        </div>
        <div>
          <div class="text-xs text-muted-foreground">Número</div>
          <div class="text-sm font-medium">{escuela?.escuela_numero || '—'}</div>
        </div>
        <div>
          <div class="text-xs text-muted-foreground">CUE</div>
          <div class="text-sm font-medium">{escuela?.cue || '—'}</div>
        </div>
        <div>
          <div class="text-xs text-muted-foreground">CUIT</div>
          <div class="text-sm font-medium">{escuela?.cuit || '—'}</div>
        </div>
        <div>
          <div class="text-xs text-muted-foreground">Cooperadora</div>
          <div class="text-sm font-medium">{escuela?.cooperadora_nombre || '—'}</div>
        </div>
        <div>
          <div class="text-xs text-muted-foreground">Domicilio</div>
          <div class="text-sm font-medium">{escuela?.domicilio || '—'}</div>
        </div>
        <div>
          <div class="text-xs text-muted-foreground">Localidad</div>
          <div class="text-sm font-medium">{escuela?.localidad || '—'}</div>
        </div>
        <div>
          <div class="text-xs text-muted-foreground">Email cooperadora</div>
          <div class="text-sm font-medium">{escuela?.email_cooperadora || '—'}</div>
        </div>
        <div>
          <div class="text-xs text-muted-foreground">Teléfono cooperadora</div>
          <div class="text-sm font-medium">{escuela?.telefono_cooperadora || '—'}</div>
        </div>
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
          <div>
            <div class="text-xs text-muted-foreground">Entidad</div>
            <div class="text-sm font-medium">{banco?.entidad || '—'}</div>
          </div>
          <div>
            <div class="text-xs text-muted-foreground">Tipo de cuenta</div>
            <div class="text-sm font-medium">{banco?.tipo_cuenta || '—'}</div>
          </div>
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
          <div>
            <div class="text-xs text-muted-foreground">Posee</div>
            <div class="text-sm font-medium">{kiosco?.posee ? 'Sí' : 'No'}</div>
          </div>
          {#if kiosco?.posee}
            <div>
              <div class="text-xs text-muted-foreground">Modalidad</div>
              <div class="text-sm font-medium">{kiosco?.modalidad || '—'}</div>
            </div>
          {/if}
        </div>
      </Card.Content>
    </Card.Root>
  {/if}

  <div class="flex justify-end">
    <Button variant="outline" size="sm" onclick={() => navigate('cooperadora')}>
      <PencilIcon data-icon="inline-start" />
      Ver más / Editar
    </Button>
  </div>
{/if}
