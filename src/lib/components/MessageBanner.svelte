<script>
  import { Alert, AlertDescription } from '$lib/components/ui/alert'
  import CircleAlertIcon from '@lucide/svelte/icons/circle-alert'
  import CheckCircle2Icon from '@lucide/svelte/icons/circle-check-big'

  let { error = '', notice = '' } = $props()
</script>

{#if error}
  <Alert variant="destructive" class="mt-4">
    <CircleAlertIcon class="size-4" />
    <AlertDescription>{error}</AlertDescription>
  </Alert>
{/if}
{#if notice}
  <Alert class="mt-4 border-primary/45 bg-primary/10 text-primary">
    <CheckCircle2Icon class="size-4" />
    <AlertDescription>{notice}</AlertDescription>
  </Alert>
{/if}
