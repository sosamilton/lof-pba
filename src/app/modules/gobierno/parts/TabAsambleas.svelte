<script>
  import { Button } from '$lib/components/ui/button'
  import * as Card from '$lib/components/ui/card'
  import { Badge } from '$lib/components/ui/badge'
  import { Input } from '$lib/components/ui/input'
  import { Separator } from '$lib/components/ui/separator'
  import { Textarea } from '$lib/components/ui/textarea'
  import * as Select from '$lib/components/ui/select'
  import * as Field from '$lib/components/ui/field'
  import EmptyState from '$lib/components/EmptyState.svelte'
  import { TIPOS_ASAMBLEA, TIPOS_ASAMBLEA_CORTO, normalize } from '$core/utils'
  import { notifyAfter } from '$core/notify.svelte'
  import PlusIcon from '@lucide/svelte/icons/plus'
  import RefreshIcon from '@lucide/svelte/icons/refresh-cw'
  import TrashIcon from '@lucide/svelte/icons/trash-2'
  import UsersIcon from '@lucide/svelte/icons/users'
  import SearchIcon from '@lucide/svelte/icons/search'
  import GavelIcon from '@lucide/svelte/icons/gavel'

  let { store } = $props()

  let q = $state('')

  const tipoVariant = (t) => (t === 'AGO' ? 'default' : t === 'AGE' ? 'secondary' : 'outline')

  let filtered = $derived(
    store.asambleas.filter((a) => {
      const t = normalize(q)
      if (!t) return true
      const hay = [a.fecha, a.tipo_asamblea, a.acta_numero, TIPOS_ASAMBLEA_CORTO[a.tipo_asamblea]]
        .map((v) => normalize(v))
        .join(' ')
      return hay.includes(t)
    }),
  )

  const handleSave = () => notifyAfter(store, store.saveAsamblea)
</script>

<div class="mb-4 flex flex-wrap items-center gap-3">
  <div class="relative min-w-[200px] flex-1">
    <SearchIcon class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    <Input placeholder="Buscar (fecha, tipo, acta…)" bind:value={q} class="pl-9" />
  </div>
  <Button variant="outline" onclick={() => store.newAsamblea('AGO')}>
    <PlusIcon data-icon="inline-start" />
    Nueva asamblea
  </Button>
  <Button variant="ghost" onclick={() => store.newAsamblea('AGE')}>Extraordinaria</Button>
  <Button variant="ghost" onclick={() => store.newAsamblea('RCD')}>Reunión de CD</Button>
  <Button variant="outline" onclick={store.loadAsambleas}>
    <RefreshIcon data-icon="inline-start" />
    Recargar
  </Button>
  <span class="text-sm text-muted-foreground">{filtered.length} reunión(es)</span>
</div>

<div class="grid gap-4" style="grid-template-columns: {filtered.length > 0 ? 'minmax(280px, 380px) 1fr' : '1fr'}">
  {#if filtered.length > 0}
    <div class="max-h-[calc(100vh-220px)] overflow-y-auto rounded-lg border border-border bg-card">
      {#each filtered as a (a.id)}
        <button
          type="button"
          class="w-full border-b border-border px-4 py-3 text-left transition-colors hover:bg-accent {a.id === store.selectedAsambleaId ? 'bg-primary/10' : ''}"
          onclick={() => store.editAsamblea(a)}
        >
          <div class="flex items-center gap-2">
            <Badge variant={tipoVariant(a.tipo_asamblea)} class="text-[10px]">{a.tipo_asamblea}</Badge>
            <span class="text-sm font-semibold">{a.fecha || '(sin fecha)'}</span>
          </div>
          <div class="mt-1 text-xs text-muted-foreground">
            {TIPOS_ASAMBLEA_CORTO[a.tipo_asamblea] || a.tipo_asamblea}
            · Acta {a.acta_numero || '-'}
            {#if a.socios_presentes_cantidad != null && a.socios_presentes_cantidad !== ''}· {a.socios_presentes_cantidad} presentes{/if}
          </div>
        </button>
      {/each}
    </div>
  {/if}

  <div>
    {#if store.asambleaForm}
      <Card.Root>
        <Card.Header>
          <Card.Title class="text-base">
            {store.asambleaForm.id ? 'Editar reunión' : 'Nueva reunión'}
          </Card.Title>
          <Card.Description class="text-xs">
            {TIPOS_ASAMBLEA_CORTO[store.asambleaForm.tipo_asamblea] || store.asambleaForm.tipo_asamblea}
          </Card.Description>
        </Card.Header>
        <Card.Content class="flex flex-col gap-4">
          <Field.FieldGroup class="grid gap-4 sm:grid-cols-2">
            <Field.Field>
              <Field.FieldLabel for="as-fecha">Fecha</Field.FieldLabel>
              <Input id="as-fecha" type="date" bind:value={store.asambleaForm.fecha} />
            </Field.Field>
            <Field.Field>
              <Field.FieldLabel for="as-tipo">Tipo</Field.FieldLabel>
              <Select.Root type="single" bind:value={store.asambleaForm.tipo_asamblea}>
                <Select.Trigger id="as-tipo" class="w-full">
                  <Select.Value placeholder="Elegir…" />
                </Select.Trigger>
                <Select.Content>
                  {#each TIPOS_ASAMBLEA as t}
                    <Select.Item value={t}>{TIPOS_ASAMBLEA_CORTO[t]}</Select.Item>
                  {/each}
                </Select.Content>
              </Select.Root>
            </Field.Field>
            <Field.Field>
              <Field.FieldLabel for="as-acta">Acta N°</Field.FieldLabel>
              <Input id="as-acta" bind:value={store.asambleaForm.acta_numero} />
            </Field.Field>
            <Field.Field>
              <Field.FieldLabel for="as-fojas">Fojas</Field.FieldLabel>
              <Input id="as-fojas" bind:value={store.asambleaForm.acta_fojas} />
            </Field.Field>

            {#if store.asambleaForm.tipo_asamblea !== 'RCD'}
              <Field.Field>
                <Field.FieldLabel for="as-presentes">Socios presentes</Field.FieldLabel>
                <Input id="as-presentes" type="number" bind:value={store.asambleaForm.socios_presentes_cantidad} />
              </Field.Field>
              <Field.Field>
                <Field.FieldLabel for="as-cuota">Cuota social ($)</Field.FieldLabel>
                <Input id="as-cuota" type="number" bind:value={store.asambleaForm.cuota_social_importe} />
              </Field.Field>
              <Field.Field>
                <Field.FieldLabel for="as-modalidad">Cuota modalidad</Field.FieldLabel>
                <Select.Root type="single" bind:value={store.asambleaForm.cuota_social_modalidad}>
                  <Select.Trigger id="as-modalidad" class="w-full">
                    <Select.Value placeholder="Elegir…" />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="Mensual">Mensual</Select.Item>
                    <Select.Item value="Anual">Anual</Select.Item>
                  </Select.Content>
                </Select.Root>
              </Field.Field>
              <Field.Field>
                <Field.FieldLabel for="as-caja">Caja chica ($)</Field.FieldLabel>
                <Input id="as-caja" type="number" bind:value={store.asambleaForm.caja_chica_importe} />
              </Field.Field>
            {/if}
          </Field.FieldGroup>

          {#if store.asambleaForm.tipo_asamblea === 'RCD'}
            <Field.FieldDescription>
              Las reuniones de Comisión Directiva no eligen autoridades ni fijan cuota social. Se usan para registrar renuncias, reemplazos y decisiones internas (ver tab "Autoridades vigentes").
            </Field.FieldDescription>
          {/if}

          <Separator />

          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <span class="text-sm font-semibold">Resoluciones</span>
              <Button variant="outline" size="sm" onclick={store.addResolucion}>
                <PlusIcon data-icon="inline-start" />
                Agregar
              </Button>
            </div>
            {#each store.resoluciones as res, idx (idx)}
              <div class="flex items-start gap-2">
                <div class="flex-1">
                  <Field.FieldLabel class="text-xs text-muted-foreground">Punto {idx + 1}</Field.FieldLabel>
                  <Textarea bind:value={res.texto} placeholder="Texto de la resolución…" class="mt-1" />
                </div>
                <Button variant="ghost" size="sm" class="mt-6" onclick={() => store.removeResolucion(idx)} aria-label="Eliminar resolución">
                  <TrashIcon class="size-4" />
                </Button>
              </div>
            {/each}
          </div>

          <div class="flex flex-wrap items-center justify-between gap-2">
            {#if store.asambleaForm.id && (store.asambleaForm.tipo_asamblea === 'AGO' || store.asambleaForm.tipo_asamblea === 'AGE')}
              <Button variant="outline" size="sm" onclick={() => store.openCargarAutoridades(store.asambleaForm.id)}>
                <UsersIcon data-icon="inline-start" />
                Cargar autoridades electas
              </Button>
            {/if}
            <Button onclick={handleSave} disabled={store.busy}>Guardar</Button>
          </div>
        </Card.Content>
      </Card.Root>
    {:else if filtered.length === 0 && q.trim()}
      <EmptyState
        title="Sin coincidencias"
        sub="No se encontraron reuniones con ese criterio."
        actionLabel="Nueva asamblea"
        onaction={() => store.newAsamblea('AGO')}
      >
        {#snippet actionIcon()}
          <PlusIcon data-icon="inline-start" />
        {/snippet}
      </EmptyState>
    {:else if filtered.length === 0}
      <EmptyState
        title="Todavía no hay reuniones"
        sub="Creá la primera asamblea ordinaria para cargar las autoridades de la cooperadora."
        actionLabel="Nueva asamblea"
        onaction={() => store.newAsamblea('AGO')}
      >
        {#snippet actionIcon()}
          <GavelIcon data-icon="inline-start" />
        {/snippet}
      </EmptyState>
    {:else}
      <div class="flex flex-col items-center gap-2 py-12 text-center">
        <GavelIcon class="size-8 text-muted-foreground" />
        <p class="text-sm text-muted-foreground">Seleccioná una reunión o creá una nueva.</p>
      </div>
    {/if}
  </div>
</div>
