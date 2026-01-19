<script lang="ts">
	import { db } from '$lib/stores/database.svelte';
	import { settings } from '$lib/stores/settings.svelte';
	import type { MaterialRarity } from '$lib/stores/settings.svelte';
	import { selectedItem } from '$lib/stores/selected-item.svelte';
	import { hoverStore } from '$lib/stores/hover.svelte';
	import { aggregateMaterials } from '$lib/utils/materials-aggregator';
	import BubbleChart from '$lib/components/BubbleChart.svelte';
	import BookmarkedItemsBar from '$lib/components/BookmarkedItemsBar.svelte';
	import Bookmark from '@lucide/svelte/icons/bookmark';

	// Reactive aggregated data with filter options
	const aggregatedData = $derived.by(() => {
		if (db.status !== 'ready') {
			return null;
		}
		const bookmarkedIds = settings.bookmarkedItems;
		if (bookmarkedIds.size === 0) {
			return null;
		}
		const method = settings.scoringMethod; // Access to make reactive
		const filterOptions = {
			hideScrappyCollected: settings.hideScrappyCollected,
			rarityFilters: settings.rarityFilters,
			hiddenSourceItems: settings.hiddenSourceItems,
			pausedBookmarks: settings.pausedItems
		};
		return aggregateMaterials(bookmarkedIds, db, method, filterOptions);
	});

	// Update settings store with aggregated data
	$effect(() => {
		settings.setAggregatedData(aggregatedData);
	});

	// Category cache for performance
	const itemCategoriesCache = $state(new Map<string, string[]>());

	// Helper to get item categories with caching
	function getItemCategories(itemId: string): string[] {
		if (!itemCategoriesCache.has(itemId)) {
			const categories = db.query<{ display_name: string }>(
				`SELECT ic.display_name
				 FROM item_category_links icl
				 JOIN item_categories ic ON icl.category_id = ic.id
				 WHERE icl.item_id = ?`,
				[itemId]
			);
			itemCategoriesCache.set(itemId, categories.map(c => c.display_name));
		}
		const cached = itemCategoriesCache.get(itemId);
		if (!cached) {
			throw new Error(`Category cache miss for item: ${itemId}`);
		}
		return cached;
	}

	// Clear cache when aggregatedData changes
	$effect(() => {
		if (aggregatedData) {
			itemCategoriesCache.clear();
		}
	});

	// Filter by rarity (source items themselves)
	const rarityFilteredSalvageSources = $derived.by(() => {
		if (!aggregatedData) return [];
		return aggregatedData.salvageSources.filter(source => {
			return settings.rarityFilters.has(source.item.rarity as MaterialRarity);
		});
	});

	const rarityFilteredRecycleSources = $derived.by(() => {
		if (!aggregatedData) return [];
		return aggregatedData.recycleSources.filter(source => {
			return settings.rarityFilters.has(source.item.rarity as MaterialRarity);
		});
	});

	// Filter by type (source items themselves)
	const typeFilteredSalvageSources = $derived.by(() => {
		if (settings.sourceTypeFilters.size === 0) return rarityFilteredSalvageSources;

		return rarityFilteredSalvageSources.filter(source => {
			return source.item.type && settings.sourceTypeFilters.has(source.item.type);
		});
	});

	const typeFilteredRecycleSources = $derived.by(() => {
		if (settings.sourceTypeFilters.size === 0) return rarityFilteredRecycleSources;

		return rarityFilteredRecycleSources.filter(source => {
			return source.item.type && settings.sourceTypeFilters.has(source.item.type);
		});
	});

	// Filter by categories
	const categoryFilteredSalvageSources = $derived.by(() => {
		if (settings.categoryFilters.size === 0) return typeFilteredSalvageSources;

		return typeFilteredSalvageSources.filter(source => {
			const categories = getItemCategories(source.item.id);
			return categories.some(cat => settings.categoryFilters.has(cat));
		});
	});

	const categoryFilteredRecycleSources = $derived.by(() => {
		if (settings.categoryFilters.size === 0) return typeFilteredRecycleSources;

		return typeFilteredRecycleSources.filter(source => {
			const categories = getItemCategories(source.item.id);
			return categories.some(cat => settings.categoryFilters.has(cat));
		});
	});

	// Filter source items based on value threshold (only if enabled)
	const valueFilteredSalvageSources = $derived.by(() => {
		if (!settings.maxSourceValueEnabled) {
			return categoryFilteredSalvageSources;
		}
		return categoryFilteredSalvageSources.filter(s => s.item.value <= settings.maxSourceValue);
	});

	const valueFilteredRecycleSources = $derived.by(() => {
		if (!settings.maxSourceValueEnabled) {
			return categoryFilteredRecycleSources;
		}
		return categoryFilteredRecycleSources.filter(s => s.item.value <= settings.maxSourceValue);
	});

	// Materials are already filtered by the aggregator
	const filteredMaterials = $derived(aggregatedData?.materials ?? []);

	// Final filtered sources (rarity, type, category, and value filters applied)
	const filteredSalvageSources = $derived(valueFilteredSalvageSources);
	const filteredRecycleSources = $derived(valueFilteredRecycleSources);

	// Helper to check if a material should be highlighted
	function isMaterialHighlighted(materialId: string): boolean {
		return hoverStore.highlightedMaterials.has(materialId);
	}

	// Helper to check if a source should be highlighted
	function isSourceHighlighted(sourceId: string): boolean {
		return hoverStore.highlightedSources.has(sourceId);
	}

	// Handle item click to open drawer
	function handleItemClick(itemId: string) {
		selectedItem.selectItem(itemId);
	}

</script>

<div class="h-full overflow-y-auto p-3 sm:p-4 lg:p-6" data-test-id="materials-grid">
	{#if db.status === 'loading'}
		<div class="flex items-center justify-center h-full" data-test-id="materials-grid-loading">
			<div class="text-center space-y-2">
				<div class="text-muted-foreground">Loading database...</div>
			</div>
		</div>
	{:else if db.status === 'error'}
		<div class="flex items-center justify-center h-full" data-test-id="materials-grid-error">
			<div class="text-center space-y-2">
				<div class="text-destructive">Failed to load database</div>
				<div class="text-sm text-muted-foreground">{db.error?.message}</div>
			</div>
		</div>
	{:else if !aggregatedData}
		<div class="flex items-center justify-center min-h-[calc(100vh-8rem)] p-6" data-test-id="materials-grid-empty">
			<div class="rounded-xl border-2 border-dashed border-border/50 bg-card/50 p-8 space-y-6 max-w-lg">
				<div class="space-y-3 text-center">
					<Bookmark class="size-16 text-muted-foreground/40 mx-auto" />
					<h2 class="heading-sm text-muted-foreground">Get Started</h2>
				</div>

				<p class="text-sm text-muted-foreground/80">
					ARCompanion helps you focus on the crafting materials you need for your favorite equipment and what to salvage or recycle to get them.
				</p>

				<div class="space-y-3">
					<h3 class="section-header text-muted-foreground">How to Use</h3>
					<ol class="list-decimal list-inside space-y-2 text-sm text-muted-foreground/80">
						<li>Search and bookmark equipment you want to craft</li>
						<li>See all required materials in one place</li>
						<li>Find out which items to salvage or recycle for best yield</li>
						<li>Filter and refine results using the Settings panel</li>
					</ol>
				</div>

				<div class="pt-2 text-center">
					<button
						onclick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
						class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--arc-cyan)]/10 border border-[var(--arc-cyan)]/30 hover:bg-[var(--arc-cyan)]/20 hover:border-[var(--arc-cyan)]/50 transition-colors text-sm font-medium text-[var(--arc-cyan)]"
					>
						<span>Search Items</span>
						<kbd class="inline-flex pointer-events-none select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
							<span class="text-xs">⌘</span>K
						</kbd>
					</button>
				</div>
			</div>
		</div>
	{:else if aggregatedData.materials.length === 0}
		<div class="flex items-center justify-center h-full">
			<div class="text-center text-muted-foreground">
				None of your bookmarked items are craftable
			</div>
		</div>
	{:else}
		<!-- Bookmarked Items Bar -->
		<BookmarkedItemsBar />

		<div class="grid grid-cols-1 lg:grid-cols-[minmax(300px,1fr)_3fr] gap-8">
			<!-- Required Materials Section -->
			<section class="rounded-xl border-2 border-[var(--arc-cyan)]/20 bg-[var(--arc-cyan)]/5 p-5" data-test-id="collect-section">
				<div class="mb-3 text-center">
					<div class="flex items-center justify-center gap-2">
						<h2 class="content-header text-[var(--arc-cyan)]">Collect</h2>
						<span class="text-xs text-muted-foreground">({filteredMaterials.length})</span>
					</div>
					<div class="section-divider mt-2 mb-3 bg-gradient-to-r from-transparent via-[var(--arc-cyan)]/30 to-transparent"></div>
				</div>

				{#if filteredMaterials.length === 0}
					<div class="text-center text-muted-foreground py-8">
						All materials filtered by current settings
					</div>
				{:else}
					<div style="height: 600px;">
						<BubbleChart
							items={filteredMaterials}
							getSize={(m) => m.totalQuantity}
							getId={(m) => m.item.id}
							getImageName={(m) => m.item.image_name}
							getName={(m) => m.item.name}
							getRarity={(m) => m.item.rarity}
							onItemClick={handleItemClick}
							onItemHover={(id) => hoverStore.setHoveredMaterial(id)}
							isHighlighted={isMaterialHighlighted}
							hoveredOther={hoverStore.hasAnyHover}
							tooltipType="material"
						/>
					</div>
				{/if}
			</section>

			<!-- Source Materials Sections -->
			<div class="flex flex-col gap-6">
				<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
					<!-- Salvage Section -->
						<section class="rounded-xl border-2 border-emerald-500/20 bg-emerald-500/5 p-5" data-test-id="salvage-section">
							<div class="mb-3 text-center">
								<div class="flex items-center justify-center gap-2">
									<h2 class="content-header text-emerald-400">Salvage</h2>
									<span class="text-xs text-muted-foreground">({filteredSalvageSources.length})</span>
								</div>
								<div class="section-divider mt-2 mb-3 bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent"></div>
							</div>
							{#if filteredSalvageSources.length === 0}
								<div class="text-sm text-muted-foreground">
									{#if aggregatedData.salvageSources.length === 0}
										No items recommended for salvaging
									{:else}
										All sources filtered by current settings
									{/if}
								</div>
							{:else}
								<div style="height: 600px;">
									<BubbleChart
										items={filteredSalvageSources}
										getSize={(s) => s.salvageScore}
										getId={(s) => s.item.id}
										getImageName={(s) => s.item.image_name}
										getName={(s) => s.item.name}
										getRarity={(s) => s.item.rarity}
										onItemClick={handleItemClick}
										onItemHover={(id) => hoverStore.setHoveredSource(id, 'salvage')}
										isHighlighted={isSourceHighlighted}
										hoveredOther={hoverStore.hasAnyHover}
										tooltipType="source"
									/>
								</div>
							{/if}
						</section>

					<!-- Recycle Section -->
						<section class="rounded-xl border-2 border-[var(--arc-amber)]/20 bg-[var(--arc-amber)]/5 p-5" data-test-id="recycle-section">
							<div class="mb-3 text-center">
								<div class="flex items-center justify-center gap-2">
									<h2 class="content-header text-[var(--arc-amber)]">Recycle</h2>
									<span class="text-xs text-muted-foreground">({filteredRecycleSources.length})</span>
								</div>
								<div class="section-divider mt-2 mb-3 bg-gradient-to-r from-transparent via-[var(--arc-amber)]/30 to-transparent"></div>
							</div>
							{#if filteredRecycleSources.length === 0}
								<div class="text-sm text-muted-foreground">
									{#if aggregatedData.recycleSources.length === 0}
										No items recommended for recycling
									{:else}
										All sources filtered by current settings
									{/if}
								</div>
							{:else}
								<div style="height: 600px;">
									<BubbleChart
										items={filteredRecycleSources}
										getSize={(s) => s.recycleScore}
										getId={(s) => s.item.id}
										getImageName={(s) => s.item.image_name}
										getName={(s) => s.item.name}
										getRarity={(s) => s.item.rarity}
										onItemClick={handleItemClick}
										onItemHover={(id) => hoverStore.setHoveredSource(id, 'recycle')}
										isHighlighted={isSourceHighlighted}
										hoveredOther={hoverStore.hasAnyHover}
										tooltipType="source"
									/>
								</div>
							{/if}
						</section>
				</div>
			</div>
		</div>
	{/if}
</div>
