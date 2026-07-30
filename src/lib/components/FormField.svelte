<script>
  import { Label } from '$lib/components/ui/label'

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
    <textarea
      {id}
      {placeholder}
      {disabled}
      bind:value
      onchange
      oninput
      class="flex min-h-[64px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y {className}"
    ></textarea>
  {:else}
    <input
      {id}
      {type}
      {placeholder}
      {disabled}
      bind:value
      onchange
      oninput
      class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 {className}"
    />
  {/if}
  {#if error}
    <p class="text-xs text-destructive">{error}</p>
  {:else if hint}
    <p class="text-xs text-muted-foreground">{hint}</p>
  {/if}
</div>
