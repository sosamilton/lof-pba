<script>
	import { mode } from "mode-watcher";
	import { Toaster as Sonner } from "svelte-sonner";
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
	import OctagonXIcon from '@lucide/svelte/icons/octagon-x';
	import InfoIcon from '@lucide/svelte/icons/info';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';

	let { ...restProps } = $props();
</script>

<Sonner
	theme={mode.current}
	class="toaster group"
	style="--normal-bg: var(--color-popover); --normal-text: var(--color-popover-foreground); --normal-border: var(--color-border);"
	{...restProps}
>
	{#snippet loadingIcon()}
		<Loader2Icon class="size-4 animate-spin" />
	{/snippet}
	{#snippet successIcon()}
		<CircleCheckIcon class="size-4" />
	{/snippet}
	{#snippet errorIcon()}
		<OctagonXIcon class="size-4" />
	{/snippet}
	{#snippet infoIcon()}
		<InfoIcon class="size-4" />
	{/snippet}
	{#snippet warningIcon()}
		<TriangleAlertIcon class="size-4" />
	{/snippet}
</Sonner>

<!--
	Sobreescribe los colores de los toasts richColors para alinearlos con el
	tema de la app:
	  - success y warning → color primario de la cooperadora (--primary)
	  - error → rojo semántico fijo (--destructive), no varía con la marca
	  - info → neutro del popover

	Los fondos suaves se logran con color-mix sobre --primary a baja opacidad.
-->
<style>
	:global([data-sonner-toaster][data-sonner-theme='light']) {
		--success-bg: color-mix(in oklch, var(--primary) 12%, var(--popover));
		--success-border: color-mix(in oklch, var(--primary) 30%, transparent);
		--success-text: var(--primary);

		--warning-bg: color-mix(in oklch, var(--primary) 12%, var(--popover));
		--warning-border: color-mix(in oklch, var(--primary) 30%, transparent);
		--warning-text: var(--primary);

		--error-bg: color-mix(in oklch, var(--destructive) 12%, var(--popover));
		--error-border: color-mix(in oklch, var(--destructive) 30%, transparent);
		--error-text: var(--destructive);

		--info-bg: var(--popover);
		--info-border: var(--border);
		--info-text: var(--popover-foreground);
	}

	:global([data-sonner-toaster][data-sonner-theme='dark']) {
		--success-bg: color-mix(in oklch, var(--primary) 18%, var(--popover));
		--success-border: color-mix(in oklch, var(--primary) 35%, transparent);
		--success-text: var(--primary);

		--warning-bg: color-mix(in oklch, var(--primary) 18%, var(--popover));
		--warning-border: color-mix(in oklch, var(--primary) 35%, transparent);
		--warning-text: var(--primary);

		--error-bg: color-mix(in oklch, var(--destructive) 18%, var(--popover));
		--error-border: color-mix(in oklch, var(--destructive) 35%, transparent);
		--error-text: var(--destructive);

		--info-bg: var(--popover);
		--info-border: var(--border);
		--info-text: var(--popover-foreground);
	}
</style>
