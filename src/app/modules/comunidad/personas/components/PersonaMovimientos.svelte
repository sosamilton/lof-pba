<script>
  import { onMount } from 'svelte'
  import { fetchRecords, resolveTableId } from '$core/grist/grist'
  import { TABLE_PREFERRED_IDS } from '$core/utils/utils'
  import { formatARS, dateToInput, buildMapById } from '$core/utils/utils'
  import { formatFecha } from '$core/format/format'
  import { navigate } from '$core/ui/router.svelte'
  import * as Card from '$lib/components/ui/card'
  import { Button } from '$lib/components/ui/button'
  import { Badge } from '$lib/components/ui/badge'
  import ArrowRightIcon from '@lucide/svelte/icons/arrow-right'
  import ReceiptIcon from '@lucide/svelte/icons/receipt'

  let { personaId, limit = 5 } = $props()

  let movimientos = $state([])
  let loading = $state(false)
  let rubroById = $state(new Map())

  async function loadMovimientos() {
    if (!personaId) return
    loading = true
    try {
      const tMov = await resolveTableId(TABLE_PREFERRED_IDS.movimientos)
      const tRubros = await resolveTableId(TABLE_PREFERRED_IDS.rubros_pia)
      if (!tMov) { movimientos = []; return }

      const recs = await fetchRecords(tMov, {
        filter: (m) => Number(m.persona_id) === Number(personaId),
      })
      // Ordenar por fecha descendente
      recs.sort((a, b) => {
        const fa = dateToInput(a.fecha) || ''
        const fb = dateToInput(b.fecha) || ''
        return fb.localeCompare(fa)
      })
      movimientos = recs

      if (tRubros) {
        const rubros = await fetchRecords(tRubros)
        rubroById = buildMapById(rubros)
      }
    } catch (e) {
      movimientos = []
    } finally {
      loading = false
    }
  }

  // Recargar cuando cambia la persona
  $effect(() => {
    if (personaId) loadMovimientos()
    else movimientos = []
  })

  const ultimos = $derived(movimientos.slice(0, limit))
  const total = $derived(movimientos.length)
</script>

{#if personaId}
  <Card.Root>
    <Card.Header>
      <Card.Title class="text-base flex items-center gap-2">
        <ReceiptIcon class="size-4 text-muted-foreground" />
        Movimientos de la persona
      </Card.Title>
      <Card.Description>
        {total > 0
          ? `${total} movimiento${total > 1 ? 's' : ''} registrado${total > 1 ? 's' : ''}`
          : 'Sin movimientos registrados'}
      </Card.Description>
    </Card.Header>
    <Card.Content>
      {#if loading}
        <p class="text-sm text-muted-foreground">Cargando…</p>
      {:else if ultimos.length === 0}
        <p class="text-sm text-muted-foreground py-2">
          Esta persona no tiene movimientos asociados.
        </p>
      {:else}
        <div class="flex flex-col gap-1.5">
          {#each ultimos as m (m.id)}
            <div class="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
              <div class="flex flex-col gap-0.5 min-w-0">
                <div class="flex items-center gap-2">
                  <Badge variant={m.tipo_movimiento === 'Entrada' ? 'default' : m.tipo_movimiento === 'Salida' ? 'destructive' : 'secondary'}>
                    {m.tipo_movimiento}
                  </Badge>
                  <span class="text-xs text-muted-foreground">{formatFecha(dateToInput(m.fecha))}</span>
                </div>
                <span class="truncate text-xs text-muted-foreground">
                  {m.detalle || rubroById.get(Number(m.rubro_id))?.nombre_oficial || '(sin detalle)'}
                </span>
              </div>
              <span class="font-medium tabular-nums shrink-0 {m.tipo_movimiento === 'Entrada' ? 'text-green-600' : m.tipo_movimiento === 'Salida' ? 'text-red-600' : ''}">
                {m.tipo_movimiento === 'Salida' ? '-' : ''}{formatARS(Number(m.importe) || 0)}
              </span>
            </div>
          {/each}
        </div>

        {#if total > limit}
          <div class="mt-3 flex justify-end">
            <Button variant="outline" size="sm" onclick={() => navigate('movimientos')}>
              Ver {total} movimientos
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
          </div>
        {/if}
      {/if}
    </Card.Content>
  </Card.Root>
{/if}
