<script lang="ts">
	import { base } from '$app/paths';
	import type { HTMLAttributes } from 'svelte/elements';
	import ImageOff from '@lucide/svelte/icons/image-off';

	type Props = HTMLAttributes<HTMLDivElement> & {
		itemId: string;
		imageName?: string;
		size?: string;
		alt?: string;
		loading?: 'eager' | 'lazy';
	};

	let {
		itemId,
		imageName,
		size = 'size-8',
		alt = '',
		loading = 'lazy',
		class: className = '',
		...restProps
	}: Props = $props();

	let imageError = $state(false);

	// Use imageName if provided, otherwise fall back to itemId.png
	let imageSrc = $derived(imageError ? '' : `${base}/images/items/${imageName || itemId + '.png'}`);

	// Reset error state when itemId or imageName changes
	$effect(() => {
		imageError = false;
	});

	function handleImageError() {
		imageError = true;
	}
</script>

<div class="inline-flex items-center justify-center shrink-0 rounded-xs {size} {className}" {...restProps}>
	{#if imageError}
		<!-- Fallback icon for missing images -->
		<div class="w-full h-full flex items-center justify-center">
			<ImageOff
				class="text-gray-400"
				size="70%"
				aria-label={alt || 'Missing item icon'}
			/>
		</div>
	{:else}
		<img
			src={imageSrc}
			{alt}
			{loading}
			class="w-full h-full object-contain rounded-xs"
			onerror={handleImageError}
		/>
	{/if}
</div>
