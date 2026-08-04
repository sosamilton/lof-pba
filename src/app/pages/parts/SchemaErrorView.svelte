<script>
  import * as Card from '$lib/components/ui/card'
  import { Button } from '$lib/components/ui/button'
  import AlertTriangleIcon from '@lucide/svelte/icons/triangle-alert'

  let {
    status = null,
    creating = false,
    onCheck = () => {},
    onRepair = () => {},
  } = $props()
</script>

{#if status?.missing?.length > 0}
  <Card.Root class="border-destructive/40">
    <Card.Content class="flex flex-col gap-4 pt-6">
      <div class="flex items-center gap-2">
        <AlertTriangleIcon class="size-5 text-destructive" />
        <span class="text-sm font-semibold">Faltan tablas para que la app funcione</span>
      </div>
      <ul class="ml-4 list-disc text-sm text-muted-foreground">
        {#each status.missing as t (t.key)}
          <li>{t.label} (<span class="font-mono">{t.tableId}</span>)</li>
        {/each}
      </ul>
      <div class="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onclick={onCheck} disabled={creating}>Reintentar</Button>
      </div>
    </Card.Content>
  </Card.Root>
{:else}
  <Card.Root class="border-destructive/40">
    <Card.Content class="flex flex-col gap-4 pt-6">
      <div class="flex items-center gap-2">
        <AlertTriangleIcon class="size-5 text-destructive" />
        <span class="text-sm font-semibold">Hay diferencias con el schema</span>
      </div>
      {#if status?.schemaDiff?.missingTables?.length}
        <div>
          <p class="text-sm font-medium mb-1">Tablas faltantes:</p>
          <ul class="ml-4 list-disc text-sm text-muted-foreground">
            {#each status.schemaDiff.missingTables as t (t.id)}
              <li><span class="font-mono">{t.id}</span></li>
            {/each}
          </ul>
        </div>
      {/if}
      {#if status?.schemaDiff?.missingColumns?.length}
        <div>
          <p class="text-sm font-medium mb-1">Columnas faltantes:</p>
          <ul class="ml-4 list-disc text-sm text-muted-foreground">
            {#each status.schemaDiff.missingColumns as it (it.tableId)}
              <li><span class="font-mono">{it.tableId}</span>: {it.columns.map((c) => c.id).join(', ')}</li>
            {/each}
          </ul>
        </div>
      {/if}
      <div class="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onclick={onCheck} disabled={creating}>Revalidar</Button>
        <Button size="sm" onclick={onRepair} disabled={creating}>Reparar schema</Button>
      </div>
    </Card.Content>
  </Card.Root>
{/if}
