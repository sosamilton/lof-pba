<script>
  import * as Card from '$lib/components/ui/card'
  import { Button } from '$lib/components/ui/button'
  import { Separator } from '$lib/components/ui/separator'
  import AlertTriangleIcon from '@lucide/svelte/icons/triangle-alert'
  import CheckCircleIcon from '@lucide/svelte/icons/circle-check'

  let {
    status = null,
    creating = false,
    repairResult = null,
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
      {#if status?.schemaDiff?.formulaMigrations?.length}
        <div>
          <p class="text-sm font-medium mb-1">Columnas a migrar a fórmula:</p>
          <ul class="ml-4 list-disc text-sm text-muted-foreground">
            {#each status.schemaDiff.formulaMigrations as m (m.colId)}
              <li><span class="font-mono">{m.tableId}.{m.colId}</span></li>
            {/each}
          </ul>
        </div>
      {/if}
      {#if repairResult}
        <Separator />
        <div class="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
          <div class="flex items-center gap-2">
            <CheckCircleIcon class="size-4 text-primary" />
            <span class="text-sm font-semibold">Cambios aplicados</span>
          </div>
          <ul class="mt-2 ml-4 list-disc text-sm text-muted-foreground">
            <li>Tablas creadas: <strong>{repairResult.created}</strong></li>
            <li>Columnas agregadas: <strong>{repairResult.addedColumns}</strong></li>
            <li>Refs corregidas: <strong>{repairResult.repairedRefs}</strong></li>
            <li>Columnas migradas a fórmula: <strong>{repairResult.migratedFormulas}</strong></li>
          </ul>
          {#if repairResult.errors?.length}
            <ul class="mt-2 ml-4 list-disc text-sm text-destructive">
              {#each repairResult.errors as err (err)}
                <li>{err}</li>
              {/each}
            </ul>
          {/if}
        </div>
      {/if}
      <div class="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onclick={onCheck} disabled={creating}>Revalidar</Button>
        <Button size="sm" onclick={onRepair} disabled={creating}>Reparar schema</Button>
      </div>
    </Card.Content>
  </Card.Root>
{/if}
