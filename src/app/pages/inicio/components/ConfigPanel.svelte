<script>
  import * as Card from '$lib/components/ui/card'
  import { Badge } from '$lib/components/ui/badge'
  import { Separator } from '$lib/components/ui/separator'
  import { Switch } from '$lib/components/ui/switch'
  import { Button } from '$lib/components/ui/button'
  import CheckCircleIcon from '@lucide/svelte/icons/circle-check'
  import RefreshIcon from '@lucide/svelte/icons/refresh-cw'
  import WrenchIcon from '@lucide/svelte/icons/wrench'
  import CopyCheckIcon from '@lucide/svelte/icons/copy-check'
  import SettingsIcon from '@lucide/svelte/icons/settings'
  import TagIcon from '@lucide/svelte/icons/tag'
  import ArrowUpCircleIcon from '@lucide/svelte/icons/arrow-up-circle'

  let {
    store,
    identidadNombre = '',
  } = $props()
</script>

<Card.Root class="pt-2 border-0 shadow-none">
  <Card.Content class="flex flex-col gap-4 pt-4">
    <div class="flex items-center justify-between rounded-lg border border-border px-4 py-3">
      <div>
        <div class="text-sm font-medium">Modalidad de gestión</div>
        <div class="text-xs text-muted-foreground">Forma en que la cooperadora administra su información</div>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-sm">{store.modalidadGestion}</span>
        <Switch
          checked={store.moduloGestionIntegral}
          onCheckedChange={(v) => store.onModalidadChange(v ? 'gestion_integral' : 'carga_consolidada')}
          disabled={store.savingConfig}
        />
        <span class="text-sm text-muted-foreground">{store.moduloGestionIntegral ? 'Integral' : 'Consolidada'}</span>
      </div>
    </div>

    <Separator />

    <div class="flex items-center gap-2">
      <CheckCircleIcon class="size-5 text-primary" />
      <span class="text-sm font-semibold">Plantilla {identidadNombre} instalada y sincronizada</span>
    </div>

    <Separator />

    <div class="flex flex-wrap items-center gap-2 text-xs">
      <TagIcon class="size-4 text-muted-foreground" />
      <span class="text-muted-foreground">Versión actual:</span>
      <Badge variant="secondary" class="font-mono">v{store.versionActual}</Badge>
      {#if store.shaActual && store.shaActual !== 'dev'}
        <span class="text-muted-foreground font-mono">({store.shaActual})</span>
      {/if}
    </div>
    {#if store.versionInstalada}
      <div class="flex flex-wrap items-center gap-2 text-xs">
        <span class="text-muted-foreground">Instalada en este documento:</span>
        <Badge variant="secondary" class="font-mono">v{store.versionInstalada}</Badge>
        {#if store.shaInstalado && store.shaInstalado !== 'dev'}
          <span class="text-muted-foreground font-mono">({store.shaInstalado})</span>
        {/if}
        {#if store.versionActualizada}
          <Badge variant="default" class="ml-1"><CheckCircleIcon class="size-3" /> Actualizada</Badge>
        {:else}
          <Badge variant="destructive" class="ml-1"><ArrowUpCircleIcon class="size-3" /> Desactualizada</Badge>
          <span class="text-muted-foreground">Refrescá o reinstalá para actualizar a v{store.versionActual}</span>
        {/if}
      </div>
    {:else}
      <div class="text-xs text-muted-foreground">Sin versión instalada registrada (instalación previa al versionado).</div>
    {/if}

    <div class="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onclick={store.check} disabled={store.creating}>
        <RefreshIcon data-icon="inline-start" />
        Revalidar
      </Button>
      <Button variant="outline" size="sm" onclick={store.repairSchema} disabled={store.creating}>
        <WrenchIcon data-icon="inline-start" />
        Reparar Refs
      </Button>
      <Button variant="outline" size="sm" onclick={store.doDedup} disabled={store.migrating || store.creating}>
        <CopyCheckIcon data-icon="inline-start" />
        {store.migrating ? 'Procesando…' : 'Deduplicar personas'}
      </Button>
    </div>

    {#if store.dedupResult}
      <Separator />
      <div class="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
        <div class="text-sm font-semibold">Deduplicación completada</div>
        <ul class="mt-2 ml-4 list-disc text-sm text-muted-foreground">
          <li>Duplicados encontrados: <strong>{store.dedupResult.duplicatesFound}</strong></li>
          <li>Campos fusionados: <strong>{store.dedupResult.merged}</strong></li>
          <li>Personas eliminadas: <strong>{store.dedupResult.removed}</strong></li>
        </ul>
      </div>
    {/if}

    {#if store.repairResult}
      <Separator />
      <div class="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
        <div class="text-sm font-semibold">Schema reparado</div>
        <ul class="mt-2 ml-4 list-disc text-sm text-muted-foreground">
          <li>Tablas creadas: <strong>{store.repairResult.created}</strong></li>
          <li>Columnas agregadas: <strong>{store.repairResult.addedColumns}</strong></li>
          <li>Refs corregidas: <strong>{store.repairResult.repairedRefs}</strong></li>
          <li>Columnas migradas a fórmula: <strong>{store.repairResult.migratedFormulas}</strong></li>
        </ul>
      </div>
    {/if}
  </Card.Content>
</Card.Root>
