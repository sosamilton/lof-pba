<script>
  import { Badge } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import PencilIcon from '@lucide/svelte/icons/pencil'

  let {
    ejercicios = [],
    onEditarSaldos = () => {},
  } = $props()
</script>

<div class="flex flex-col gap-2">
  {#each ejercicios as e (e.id)}
    <div class="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
      <div class="flex flex-col gap-0.5">
        <div class="text-sm font-semibold">{e.anio_inicio}-{e.anio_fin} · {e.mes_inicio}</div>
        <div class="text-xs text-muted-foreground">
          {e.en_curso ? 'En curso' : 'Inactivo'}
          {#if e.saldo_inicial_total != null}
            · Saldo inicial: <span class="font-semibold text-foreground">${Number(e.saldo_inicial_total).toLocaleString('es-AR')}</span>
          {/if}
        </div>
      </div>
      <div class="flex items-center gap-2">
        {#if e.en_curso}
          <Badge variant="default">En curso</Badge>
          <Button variant="outline" size="sm" onclick={() => onEditarSaldos(e)}>
            <PencilIcon data-icon="inline-start" />
            Editar saldos
          </Button>
        {/if}
      </div>
    </div>
  {/each}
</div>
