<script>
	import { Accordion as AccordionPrimitive } from "bits-ui";
	import { cn } from "$lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	} = $props();
</script>

<AccordionPrimitive.Content
	bind:ref
	data-slot="accordion-content"
	class="text-sm data-open:animate-accordion-down data-closed:animate-accordion-up overflow-hidden"
	{...restProps}
>
	<div
		class={cn(
			"pt-2 pb-4 px-4 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4",
			className
		)}
	>
		{@render children?.()}
	</div>
</AccordionPrimitive.Content>