<script module>
	import { tv } from "tailwind-variants";

	export const tabsListVariants = tv({
		base: "rounded-lg p-[3px] group-data-horizontal/tabs:h-8 data-[variant=line]:rounded-none group/tabs-list inline-flex w-fit max-w-full items-center justify-start overflow-x-auto text-muted-foreground overscroll-x-contain scroll-fade-r md:scroll-fade-none group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col group-data-[orientation=vertical]/tabs:overflow-y-auto group-data-[orientation=vertical]/tabs:overflow-x-hidden [&::-webkit-scrollbar]:hidden [scrollbar-width:none]",
		variants: {
			variant: {
				default: "cn-tabs-list-variant-default bg-muted",
				line: "cn-tabs-list-variant-line gap-1 bg-transparent",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	});
</script>

<script>
	import { Tabs as TabsPrimitive } from "bits-ui";
	import { cn } from "$lib/utils.js";

	let {
		ref = $bindable(null),
		variant = "default",
		class: className,
		...restProps
	} = $props();
</script>

<TabsPrimitive.List
	bind:ref
	data-slot="tabs-list"
	data-variant={variant}
	class={cn(tabsListVariants({ variant }), className)}
	{...restProps}
/>