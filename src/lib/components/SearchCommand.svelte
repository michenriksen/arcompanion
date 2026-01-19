<script lang="ts">
	import { search } from '$lib/stores/search.svelte';
	import { selectedItem } from '$lib/stores/selected-item.svelte';
	import { settings } from '$lib/stores/settings.svelte';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as ScrollArea from '$lib/components/ui/scroll-area';
	import ItemIcon from './ItemIcon.svelte';
	import Bookmark from '@lucide/svelte/icons/bookmark';
	import SearchIcon from '@lucide/svelte/icons/search';
	import { cn } from '$lib/utils';

	let { open = $bindable(false) } = $props();

	let searchValue = $state('');
	let activeIndex = $state(-1);
	let inputRef: HTMLInputElement | null = $state(null);
	let resultsContainerRef: HTMLDivElement | null = $state(null);

	// Reset search when dialog closes
	$effect(() => {
		if (!open) {
			searchValue = '';
			activeIndex = -1;
		}
	});

	// Auto-focus input when dialog opens
	$effect(() => {
		if (open && inputRef) {
			setTimeout(() => inputRef?.focus(), 50);
		}
	});

	// Sync activeIndex when results change
	$effect(() => {
		if (activeIndex >= filteredItems.length) {
			activeIndex = filteredItems.length - 1;
		}
	});

	// Handle item selection
	function handleItemSelect(itemId: string) {
		selectedItem.selectItem(itemId);
		open = false; // Close search dialog to give drawer focus
	}

	// Handle bookmark toggle
	function handleBookmarkToggle(itemId: string, event: MouseEvent) {
		event.stopPropagation();
		settings.toggle(itemId);
	}

	// Scroll active item into view
	function scrollActiveIntoView() {
		if (activeIndex >= 0 && resultsContainerRef) {
			const activeElement = resultsContainerRef.querySelector(`[data-index="${activeIndex}"]`);
			activeElement?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
		}
	}

	// Handle keyboard navigation
	function handleKeydown(event: KeyboardEvent) {
		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault();
				if (activeIndex < filteredItems.length - 1) {
					activeIndex++;
					scrollActiveIntoView();
				}
				break;
			case 'ArrowUp':
				event.preventDefault();
				if (activeIndex > -1) {
					activeIndex--;
					scrollActiveIntoView();
				}
				break;
			case 'Enter':
				event.preventDefault();
				if (activeIndex >= 0 && filteredItems[activeIndex]) {
					handleItemSelect(filteredItems[activeIndex].id);
				}
				break;
			case 'Escape':
				event.preventDefault();
				open = false;
				break;
		}
	}

	const filteredItems = $derived.by(() => {
		if (search.status !== 'ready') return [];

		const trimmed = searchValue.trim();
		if (!trimmed) return [];

		return search.search(trimmed, { limit: 20 });
	});
</script>

<Dialog.Root bind:open>
	<Dialog.Content
		class="overflow-hidden p-0 border-[var(--arc-cyan)]/40"
		showCloseButton={false}
		data-test-id="search-dialog"
		aria-label="Search Items"
	>
		<!-- Custom search input -->
		<div class="flex h-9 items-center gap-2 border-b px-3">
			<SearchIcon class="size-4 shrink-0 opacity-50" />
			<input
				bind:this={inputRef}
				bind:value={searchValue}
				onkeydown={handleKeydown}
				placeholder="Search items..."
				autofocus
				class="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-hidden placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
				data-test-id="search-input"
			/>
		</div>

		<!-- Custom results container -->
		<ScrollArea.Root class="max-h-[300px]">
			{#if search.status === 'loading'}
				<div class="flex items-center justify-center min-h-[200px] text-sm text-muted-foreground">Loading search index...</div>
			{:else if search.status === 'error'}
				<div class="flex flex-col items-center justify-center min-h-[200px]">
					<p class="text-sm text-destructive mb-2">Failed to load search</p>
					<p class="text-xs text-muted-foreground">{search.error?.message}</p>
				</div>
			{:else if filteredItems.length === 0}
				<div class="flex items-center justify-center min-h-[200px] text-sm">
					{#if searchValue.trim()}
						No items found
					{:else}
						Type to search items...
					{/if}
				</div>
			{:else}
				<div bind:this={resultsContainerRef} class="overflow-hidden p-1">
					<div class="text-xs font-medium text-muted-foreground px-2 py-1.5">Items</div>
					{#each filteredItems as item, index (item.id)}
						{@const isBookmarked = settings.isBookmarked(item.id)}
						{@const isActive = index === activeIndex}
						<div
							role="button"
							tabindex="-1"
							data-index={index}
							onmouseenter={() => (activeIndex = index)}
							onclick={() => handleItemSelect(item.id)}
							onkeydown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									handleItemSelect(item.id);
								}
							}}
							class={cn(
								'relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none w-full',
								isActive ? 'bg-accent text-accent-foreground' : ''
							)}
							data-test-id="search-item"
							data-item-id={item.id}
						>
							<div class="flex items-center gap-2 flex-1 min-w-0">
								<ItemIcon
									itemId={item.id}
									imageName={item.image_name}
									alt={item.name}
									size="size-8"
									loading="lazy"
								/>
								<div class="flex flex-col gap-0.5 overflow-hidden">
									<span class="font-medium truncate">{item.name}</span>
									<div class="flex gap-2 text-xs text-muted-foreground">
										<span class="rarity-{item.rarity.toLowerCase()}">{item.rarity}</span>
										<span class="truncate">{item.type}</span>
									</div>
								</div>
							</div>
							{#if item.is_craftable}
								<button
									onclick={(e) => handleBookmarkToggle(item.id, e)}
									class="p-1.5 rounded hover:bg-accent transition-colors shrink-0"
									aria-label={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}
									data-test-id="search-item-bookmark-btn-{item.id}"
								>
									<Bookmark
										class="size-5 {isBookmarked
											? 'fill-[var(--arc-amber)] stroke-[var(--arc-amber)]'
											: 'fill-none stroke-current'}"
									/>
								</button>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</ScrollArea.Root>
	</Dialog.Content>
</Dialog.Root>
