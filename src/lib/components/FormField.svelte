<script>
  import { Label } from '$lib/components/ui/label'
  import { Input } from '$lib/components/ui/input'
  import { Textarea } from '$lib/components/ui/textarea'

  let {
    label,
    id,
    type = 'text',
    value = $bindable(),
    placeholder = '',
    disabled = false,
    error = '',
    hint = '',
    class: className = '',
    onchange = null,
    oninput = null,
  } = $props()
</script>

<div class="flex flex-col gap-1">
  <Label for={id} class="text-xs font-medium text-muted-foreground">{label}</Label>
  {#if type === 'textarea'}
    <Textarea
      {id}
      {placeholder}
      {disabled}
      bind:value
      onchange
      oninput
      class={className}
    />
  {:else}
    <Input
      {id}
      {type}
      {placeholder}
      {disabled}
      bind:value
      onchange
      oninput
      class={className}
    />
  {/if}
  {#if error}
    <p class="text-xs text-destructive">{error}</p>
  {:else if hint}
    <p class="text-xs text-muted-foreground">{hint}</p>
  {/if}
</div>
