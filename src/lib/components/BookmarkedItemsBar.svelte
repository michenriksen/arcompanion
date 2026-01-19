<script lang="ts">
	import { db } from '$lib/stores/database.svelte';
	import { settings } from '$lib/stores/settings.svelte';
	import { selectedItem } from '$lib/stores/selected-item.svelte';
	import { searchDialog } from '$lib/stores/search-dialog.svelte';
	import { hoverStore } from '$lib/stores/hover.svelte';
	import ItemIcon from './ItemIcon.svelte';
	import type { Item } from '$lib/types/database';
	import Plus from '@lucide/svelte/icons/plus';
	import Pause from 'lucide-svelte/icons/pause';
	import Play from 'lucide-svelte/icons/play';

	// Derived data: query bookmarked items from database
	const bookmarkedItemsData = $derived.by(() => {
		if (db.status !== 'ready') return [];

		const bookmarkedIds = settings.bookmarkedItems;
		return Array.from(bookmarkedIds)
			.map((id) => db.queryOne<Item>('SELECT * FROM items WHERE id = ?', [id]))
			.filter((item): item is Item => item !== undefined)
			.sort((a, b) => a.name.localeCompare(b.name));
	});

	const count = $derived(bookmarkedItemsData.length);

	function handleItemClick(item: Item) {
		selectedItem.selectItem(item.id);
	}

	function handlePauseClick(event: MouseEvent | KeyboardEvent, itemId: string) {
		event.stopPropagation();
		settings.togglePause(itemId);
	}

	function handleAddItem() {
		searchDialog.openDialog();
	}
</script>

<div class="mb-6" data-test-id="bookmarked-items-bar">
	<div class="mb-2 flex items-center gap-2">
		<h2 class="section-header text-[var(--arc-amber)]">Bookmarked Items</h2>
		<span class="text-xs text-muted-foreground" data-test-id="bookmarked-items-count">({count})</span>
	</div>

	<div class="flex gap-2 overflow-x-auto py-1">
		{#each bookmarkedItemsData as item (item.id)}
			{@const isPaused = settings.isPaused(item.id)}
			<div class="shrink-0 w-[90px]">
				<button
					class="group relative flex w-full flex-col items-center gap-1 rounded border border-border bg-card p-2 hover:border-[var(--arc-amber)] hover:bg-[var(--arc-amber)]/5 transition-all {isPaused ? 'opacity-70 grayscale' : ''}"
					onclick={() => handleItemClick(item)}
					onmouseenter={() => hoverStore.setHoveredBookmark(item.id)}
					onmouseleave={() => hoverStore.setHoveredBookmark(null)}
					type="button"
					title={item.name}
					data-test-id="bookmarked-item-{item.id}"
					data-paused={isPaused}
				>
					<!-- Pause overlay button -->
					<div
						class="absolute top-1 right-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity {isPaused ? '!opacity-100' : ''}"
						role="button"
						tabindex="0"
						onclick={(e) => handlePauseClick(e, item.id)}
						onkeydown={(e) => e.key === 'Enter' && handlePauseClick(e, item.id)}
						title={isPaused ? 'Unpause item' : 'Pause item'}
					>
						<div class="flex items-center justify-center size-5 rounded-full {isPaused ? 'bg-black/70 ring-2 ring-[var(--arc-amber)]' : 'bg-[var(--arc-amber)]/80 hover:bg-[var(--arc-amber)]'}">
							{#if isPaused}
								<Play class="size-3 text-white" fill="currentColor" />
							{:else}
								<Pause class="size-3 text-white" fill="currentColor" />
							{/if}
						</div>
					</div>

					<ItemIcon
						itemId={item.id}
						imageName={item.image_name}
						size="size-12"
						alt={item.name}
					/>

					<span class="text-[10px] text-center leading-tight w-full truncate">
						{item.name}
					</span>
				</button>
			</div>
		{/each}

		<!-- Add item placeholder -->
		<div class="shrink-0 w-[90px]">
			<button
				class="flex w-full flex-col items-center justify-center gap-1 rounded border-2 border-dashed border-[var(--arc-cyan)]/40 bg-card/50 p-2 h-full min-h-[76px] hover:border-[var(--arc-cyan)] hover:bg-[var(--arc-cyan)]/10 transition-colors"
				onclick={handleAddItem}
				type="button"
				title="Add item"
				aria-label="Search and add items"
				data-test-id="add-item-button"
			>
				<Plus class="size-8 text-[var(--arc-cyan)]" />
				<span class="text-[10px] text-center leading-tight text-[var(--arc-cyan)] font-medium">
					Add Item
				</span>
			</button>
		</div>
	</div>
</div>
