<script>
  import { Checkbox } from '$lib/components/ui/checkbox'
  import * as Card from '$lib/components/ui/card'
  import { Badge } from '$lib/components/ui/badge'
  import { MODULES } from '../setupStore.svelte'

  let { store } = $props()

  const modeKeys = Object.entries(MODULES).filter(([, m]) => !m.optional)
  const optionalKeys = Object.entries(MODULES).filter(([, m]) => m.optional)
</script>

<Card.Root class="mb-4">
  <Card.Content class="pt-6">
    <h2 class="text-[17px] font-bold mb-1.5">¿Cómo vas a usar AppCoop?</h2>
    <p class="text-[13px] text-muted-foreground mb-4">Elegí el tipo de gestión. Podés cambiarlo más adelante.</p>

    <div class="flex flex-col gap-2.5">
      {#each modeKeys as [key, mod]}
        <button
          type="button"
          disabled={!mod.implemented}
          onclick={() => store.toggleModule(key)}
          class="flex items-start gap-3 p-3.5 rounded-xl border text-left transition-colors {store.selectedModules[key] ? 'border-primary/50 bg-primary/5' : 'border-border bg-muted/5'} {!mod.implemented ? 'opacity-55 cursor-not-allowed' : 'cursor-pointer hover:border-primary/30'}"
        >
          <div class="mt-0.5 size-5 rounded-full border-2 shrink-0 flex items-center justify-center {store.selectedModules[key] ? 'border-primary' : 'border-muted-foreground/30'}">
            {#if store.selectedModules[key]}
              <div class="size-2.5 rounded-full bg-primary"></div>
            {/if}
          </div>
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <span class="font-extrabold text-sm">{mod.label}</span>
              {#if !mod.implemented}
                <Badge variant="secondary" class="text-[10px] py-0 px-1.5">Próximamente</Badge>
              {/if}
            </div>
            <div class="text-[13px] text-muted-foreground mt-0.5 leading-relaxed">{mod.description}</div>
          </div>
        </button>
      {/each}
    </div>

    {#if optionalKeys.length > 0}
      <div class="mt-4 pt-4 border-t border-border">
        <div class="text-[13px] font-bold mb-2.5 text-muted-foreground">Complementos opcionales</div>
        <div class="flex flex-col gap-2.5">
          {#each optionalKeys as [key, mod]}
            <label class="flex items-start gap-2.5 p-3 rounded-xl border bg-muted/5 cursor-pointer transition-colors hover:border-primary/30 {store.selectedModules[key] ? 'border-primary/40 bg-primary/5' : 'border-border'}">
              <Checkbox checked={store.selectedModules[key]} onchange={() => store.toggleModule(key)} class="mt-0.5" />
              <div>
                <div class="font-extrabold text-sm">{mod.label}</div>
                <div class="text-[13px] text-muted-foreground mt-0.5">{mod.description}</div>
              </div>
            </label>
          {/each}
        </div>
      </div>
    {/if}
  </Card.Content>
</Card.Root>
