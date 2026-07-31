<script>
  import { Checkbox } from '$lib/components/ui/checkbox'
  import * as Card from '$lib/components/ui/card'
  import { MODULES } from '../setupStore.svelte'

  let { store } = $props()
</script>

<Card.Root class="mb-4">
  <Card.Content class="pt-6">
    <h2 class="text-[17px] font-bold mb-1.5">¿Qué módulos necesitás?</h2>
    <p class="text-[13px] text-muted-foreground mb-4">Seleccioná los módulos a instalar. Cada módulo crea las tablas necesarias.</p>

    <div class="flex flex-col gap-2.5">
      {#each Object.entries(MODULES) as [key, mod]}
        <label class="flex items-start gap-2.5 p-3 rounded-xl border bg-muted/5 cursor-pointer transition-colors hover:border-primary/30 {store.selectedModules[key] ? 'border-primary/40 bg-primary/5' : 'border-border'}">
          <Checkbox checked={store.selectedModules[key]} onchange={() => store.toggleModule(key)} class="mt-0.5" />
          <div>
            <div class="font-extrabold text-sm">{mod.label}</div>
            <div class="text-[13px] text-muted-foreground mt-0.5">{mod.description}</div>
            <div class="text-xs text-muted-foreground/70 mt-1">{mod.tables.length} tabla(s)</div>
          </div>
        </label>
      {/each}
    </div>
  </Card.Content>
</Card.Root>
