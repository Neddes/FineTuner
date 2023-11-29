<script lang="ts">
	import { Button as ButtonPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils';
	import { buttonVariants, type Props, type Events } from '.';
	import type { SvelteComponent } from 'svelte';

	type $$Props = Props;
	type $$Events = Events;

	let className: $$Props['class'] = undefined;
	export let variant: $$Props['variant'] = 'default';
	export let size: $$Props['size'] = 'default';
	export let builders: $$Props['builders'] = [];
	export let TrailingIcon: typeof SvelteComponent | null = null;
	export let LeadingIcon: typeof SvelteComponent | null = null;
	export let iconSize: string = 'h-6 w-6';

	export { className as class };
</script>

<ButtonPrimitive.Root
	{builders}
	class={cn(
		buttonVariants({ variant, size, className }),
		'flex items-center justify-center gap-x-2'
	)}
	type="button"
	{...$$restProps}
	on:click
	on:keydown
>
	{#if LeadingIcon}
		<span class={`flex items-center justify-center ${iconSize} `}>
			<svelte:component this={LeadingIcon} />
		</span>
	{/if}
	<slot />
	{#if TrailingIcon}
		<span class={`flex items-center justify-center ${iconSize} `}>
			<svelte:component this={TrailingIcon} />
		</span>
	{/if}
</ButtonPrimitive.Root>
