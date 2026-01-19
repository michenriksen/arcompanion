<script lang="ts">
	import { settings } from '$lib/stores/settings.svelte';
	import type { MaterialRarity } from '$lib/stores/settings.svelte';
	import { db } from '$lib/stores/database.svelte';
	import * as Drawer from '$lib/components/ui/drawer';
	import * as Button from '$lib/components/ui/button';
	import Switch from '$lib/components/ui/switch/switch.svelte';
	import Checkbox from '$lib/components/ui/checkbox/checkbox.svelte';
	import Label from '$lib/components/ui/label/label.svelte';
	import CoinIcon from './CoinIcon.svelte';
	import X from '@lucide/svelte/icons/x';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Download from '@lucide/svelte/icons/download';
	import Upload from '@lucide/svelte/icons/upload';
	import ExternalLink from '@lucide/svelte/icons/external-link';

	// === COMPONENT STATE ===

	// Collapsible section states
	let rarityExpanded = $state(true);
	let categoryExpanded = $state(true);
	let typeExpanded = $state(true);

	// Track user modifications to filters
	let userModifiedCategories = $state(false);
	let lastKnownCategories = $state<string[]>([]);
	let userModifiedTypes = $state(false);
	let lastKnownTypes = $state<string[]>([]);

	// Import/Export state
	let fileInputRef: HTMLInputElement | null = $state(null);
	let feedbackMessage = $state<string | null>(null);
	let feedbackType = $state<'success' | 'error'>('success');
	let showFeedback = $state(false);

	// === CONSTANTS ===

	const RARITIES: MaterialRarity[] = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];

	// === COMPUTED VALUES ===

	// Available categories from source items
	const availableCategories = $derived.by(() => {
		if (!settings.aggregatedData || db.status !== 'ready') return [];

		const categoriesSet = new Set<string>();
		const sourceItemIds = new Set<string>();

		// Collect all source item IDs
		for (const source of settings.aggregatedData.salvageSources) {
			sourceItemIds.add(source.item.id);
		}
		for (const source of settings.aggregatedData.recycleSources) {
			sourceItemIds.add(source.item.id);
		}

		// Query categories for source items
		if (sourceItemIds.size > 0) {
			const placeholders = Array.from(sourceItemIds).map(() => '?').join(',');
			const categories = db.query<{ display_name: string }>(
				`SELECT DISTINCT ic.display_name
				 FROM item_category_links icl
				 JOIN item_categories ic ON icl.category_id = ic.id
				 WHERE icl.item_id IN (${placeholders})
				 ORDER BY ic.display_name`,
				Array.from(sourceItemIds)
			);

			for (const category of categories) {
				categoriesSet.add(category.display_name);
			}
		}

		return Array.from(categoriesSet).sort();
	});

	// Available types from source items
	const availableTypes = $derived.by(() => {
		if (!settings.aggregatedData) return [];

		const typesSet = new Set<string>();

		for (const source of settings.aggregatedData.salvageSources) {
			if (source.item.type) typesSet.add(source.item.type);
		}

		for (const source of settings.aggregatedData.recycleSources) {
			if (source.item.type) typesSet.add(source.item.type);
		}

		return Array.from(typesSet).sort();
	});

	// Max value from all source items
	const maxMaterialValue = $derived.by(() => {
		if (!settings.aggregatedData) return 500;

		const allValues = [
			...settings.aggregatedData.salvageSources.map(s => s.item.value),
			...settings.aggregatedData.recycleSources.map(s => s.item.value)
		];

		return allValues.length > 0 ? Math.max(...allValues) : 500;
	});

	// Selection states
	const allRaritiesSelected = $derived(settings.rarityFilters.size === RARITIES.length);
	const allCategoriesSelected = $derived(
		availableCategories.length > 0 && settings.categoryFilters.size === availableCategories.length
	);
	const allTypesSelected = $derived(
		availableTypes.length > 0 && settings.sourceTypeFilters.size === availableTypes.length
	);

	// === EFFECTS ===

	// Sync available categories to settings store
	$effect(() => {
		settings.availableCategoriesCount = availableCategories.length;

		if (availableCategories.length === 0) return;

		const currentCategoriesSet = new Set(availableCategories);
		const categoriesChanged =
			lastKnownCategories.length !== availableCategories.length ||
			availableCategories.some(cat => !lastKnownCategories.includes(cat));

		if (categoriesChanged) {
			if (settings.categoryFilters.size === 0 || !userModifiedCategories) {
				// First load or no user modifications - select all
				settings.setCategoryFilters(currentCategoriesSet);
				userModifiedCategories = false;
			} else {
				// Preserve user selections where possible
				const intersection = [...settings.categoryFilters].filter(cat =>
					currentCategoriesSet.has(cat)
				);

				if (intersection.length === 0) {
					settings.setCategoryFilters(currentCategoriesSet);
					userModifiedCategories = false;
				} else {
					settings.setCategoryFilters(new Set(intersection));
				}
			}

			lastKnownCategories = [...availableCategories];
		}
	});

	// Sync available types to settings store
	$effect(() => {
		settings.availableTypesCount = availableTypes.length;

		if (availableTypes.length === 0) return;

		const currentTypesSet = new Set(availableTypes);
		const typesChanged =
			lastKnownTypes.length !== availableTypes.length ||
			availableTypes.some(type => !lastKnownTypes.includes(type));

		if (typesChanged) {
			if (settings.sourceTypeFilters.size === 0 || !userModifiedTypes) {
				// First load or no user modifications - select all
				settings.setSourceTypeFilters(currentTypesSet);
				userModifiedTypes = false;
			} else {
				// Preserve user selections where possible
				const intersection = [...settings.sourceTypeFilters].filter(type =>
					currentTypesSet.has(type)
				);

				if (intersection.length === 0) {
					settings.setSourceTypeFilters(currentTypesSet);
					userModifiedTypes = false;
				} else {
					settings.setSourceTypeFilters(new Set(intersection));
				}
			}

			lastKnownTypes = [...availableTypes];
		}
	});

	// === EVENT HANDLERS ===

	function handleCategoryToggle(category: string) {
		userModifiedCategories = true;
		settings.toggleCategory(category);
	}

	function handleTypeToggle(type: string) {
		userModifiedTypes = true;
		settings.toggleSourceType(type);
	}

	function selectAllCategories() {
		userModifiedCategories = true;
		for (const category of availableCategories) {
			if (!settings.categoryFilters.has(category)) {
				settings.toggleCategory(category);
			}
		}
	}

	function clearAllCategories() {
		userModifiedCategories = true;
		for (const category of availableCategories) {
			if (settings.categoryFilters.has(category)) {
				settings.toggleCategory(category);
			}
		}
	}

	function selectAllTypes() {
		userModifiedTypes = true;
		for (const type of availableTypes) {
			if (!settings.sourceTypeFilters.has(type)) {
				settings.toggleSourceType(type);
			}
		}
	}

	function clearAllTypes() {
		userModifiedTypes = true;
		for (const type of availableTypes) {
			if (settings.sourceTypeFilters.has(type)) {
				settings.toggleSourceType(type);
			}
		}
	}

	// === IMPORT/EXPORT HANDLERS ===

	function handleExportSettings() {
		try {
			const json = settings.exportSettings();
			const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
			const filename = `arcompanion-settings-${timestamp}.json`;

			const blob = new Blob([json], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = filename;
			link.click();
			URL.revokeObjectURL(url);

			showSuccessFeedback('Settings exported successfully');
		} catch (error) {
			console.error('Export failed:', error);
			showErrorFeedback('Failed to export settings');
		}
	}

	async function handleImportSettings(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];

		if (!file) return;

		try {
			const json = await file.text();
			const result = settings.importSettings(json, true);

			if (result.success) {
				if (result.validatedCount !== undefined && result.invalidCount !== undefined) {
					if (result.validatedCount === 0 && result.invalidCount > 0) {
						showSuccessFeedback(
							`Settings imported (0 bookmarks imported, ${result.invalidCount} invalid items removed)`
						);
					} else if (result.invalidCount > 0) {
						showSuccessFeedback(
							`Settings imported (${result.validatedCount} bookmarks imported, ${result.invalidCount} invalid items removed)`
						);
					} else {
						showSuccessFeedback('Settings imported successfully');
					}
				} else {
					showSuccessFeedback('Settings imported successfully');
				}
			} else {
				showErrorFeedback(result.message || 'Failed to import settings');
			}
		} catch (error) {
			console.error('Import failed:', error);
			showErrorFeedback('Failed to read file');
		} finally {
			// Reset input so same file can be selected again
			input.value = '';
		}
	}

	function triggerFileInput() {
		fileInputRef?.click();
	}

	function showSuccessFeedback(message: string) {
		feedbackMessage = message;
		feedbackType = 'success';
		showFeedback = true;
		setTimeout(() => {
			showFeedback = false;
		}, 5000);
	}

	function showErrorFeedback(message: string) {
		feedbackMessage = message;
		feedbackType = 'error';
		showFeedback = true;
		setTimeout(() => {
			showFeedback = false;
		}, 7000);
	}
</script>

<Drawer.Root bind:open={settings.panelOpen} direction="right" onOpenChange={(open) => {
	if (!open) settings.closePanel();
}}>
	<Drawer.Content class="h-full sm:max-w-sm" data-test-id="settings-panel">
		<!-- Header -->
		<Drawer.Header class="relative border-b border-[var(--arc-cyan)]/30">
			<button
				onclick={() => settings.closePanel()}
				class="absolute right-4 top-4 cursor-pointer rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-hidden focus:ring-2 focus:ring-[var(--arc-cyan)] focus:ring-offset-2"
				aria-label="Close"
				data-test-id="settings-close"
			>
				<X class="size-4" />
			</button>
			<Drawer.Title class="text-xl gradient-text-arc">Settings</Drawer.Title>
			<p class="text-sm text-muted-foreground mt-1">
				Customize material display and scoring
			</p>
		</Drawer.Header>

		<!-- Content -->
		<div class="px-4 pt-6 pb-4 space-y-8 overflow-y-auto flex-1">
			<!-- Scoring Method -->
			<section class="space-y-4">
				<h3 class="section-header">Scoring Method</h3>
				<div class="space-y-2">
					<label class="flex items-center gap-3 cursor-pointer p-3 rounded-lg border transition-all {settings.scoringMethod === 'max_yield' ? 'border-[var(--arc-cyan)]/60 bg-[var(--arc-cyan)]/5' : 'border-border hover:border-[var(--arc-cyan)]/40'}">
						<input
							type="radio"
							name="scoring"
							value="max_yield"
							checked={settings.scoringMethod === 'max_yield'}
							onchange={() => settings.scoringMethod = 'max_yield'}
							class="size-4 text-[var(--arc-cyan)] cursor-pointer"
							data-test-id="scoring-max-yield"
						/>
						<div class="flex-1">
							<div class="text-sm font-medium">Maximum Yield</div>
							<div class="text-xs text-muted-foreground">Prioritize material quantity</div>
						</div>
					</label>
					<label class="flex items-center gap-3 cursor-pointer p-3 rounded-lg border transition-all {settings.scoringMethod === 'weight_conscious' ? 'border-[var(--arc-cyan)]/60 bg-[var(--arc-cyan)]/5' : 'border-border hover:border-[var(--arc-cyan)]/40'}">
						<input
							type="radio"
							name="scoring"
							value="weight_conscious"
							checked={settings.scoringMethod === 'weight_conscious'}
							onchange={() => settings.scoringMethod = 'weight_conscious'}
							class="size-4 text-[var(--arc-cyan)] cursor-pointer"
							data-test-id="scoring-weight-conscious"
						/>
						<div class="flex-1">
							<div class="text-sm font-medium">Weight Conscious</div>
							<div class="text-xs text-muted-foreground">Optimize for carry capacity</div>
						</div>
					</label>
				</div>
			</section>

			<!-- Material Filters -->
			<section class="space-y-4">
				<h3 class="section-header">Material Filters</h3>

				<!-- Hide Scrappy Materials -->
				<div class="flex items-center justify-between cursor-pointer p-3 rounded-lg border border-border hover:border-[var(--arc-cyan)]/40 transition-all">
					<div class="flex items-center gap-3">
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" class="size-5 text-[var(--arc-cyan)]" fill="currentColor" aria-label="Scrappy">
							<path d="M15.42 16.25a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z"/>
							<path d="M21.19 2c3.336.077 4.97 4.034 2.87 6.502a10.353 10.353 0 0 1 3.65 6.085l2.646 11.865c.057.258.081.52.093.748l.001.025v.025a3.748 3.748 0 0 1-6.41 2.643A3.757 3.757 0 0 1 21.38 31a3.74 3.74 0 0 1-2.66-1.107A3.757 3.757 0 0 1 16.06 31a3.74 3.74 0 0 1-2.66-1.108A3.73 3.73 0 0 1 10.71 31c-1.894-.013-3.408-1.44-3.678-3.228a1.841 1.841 0 0 1-.891.228c-1.317 0-2.206-1.34-1.71-2.564l.89-2.126c.113-.268.286-.499.5-.677-1.13-.302-2.228-.846-3.191-1.818-.506-.507-.678-1.094-.603-1.691.05-.395.221-.805.334-1.075l.05-.122.016-.04.02-.037c.627-1.244 1.384-2.247 2.327-2.983a6.56 6.56 0 0 1 2.716-1.25c.02-.063.041-.127.063-.19A3.836 3.836 0 0 1 7 11.61a3.878 3.878 0 0 1 2.76-3.89c.33-.1.55-.4.55-.74v-.01c0-2.14 1.73-3.87 3.87-3.87.56 0 1.09.12 1.57.33.76.34 1.66.21 2.3-.33a4.72 4.72 0 0 1 3-1.1h.14ZM6.99 19.5H4.146c.806.772 1.757 1.156 2.844 1.343V19.5Zm0-1v-1.64c0-.343.016-.683.048-1.019a4.406 4.406 0 0 0-1.033.602c-.599.468-1.144 1.133-1.642 2.057H6.99ZM4 19.347Zm21.748-4.37a8.34 8.34 0 0 0-8.574-6.768h-.001c-4.58.197-8.183 4.042-8.183 8.651V27.2c0 .995.79 1.794 1.737 1.8h.004a1.756 1.756 0 0 0 1.453-.758l.002-.003c.587-.82 1.836-.86 2.435.01.324.458.846.751 1.439.751a1.77 1.77 0 0 0 1.442-.756l.004-.005c.586-.82 1.836-.86 2.435.01.324.458.846.751 1.439.751a1.77 1.77 0 0 0 1.442-.756l.004-.005c.586-.82 1.836-.86 2.435.01.324.458.846.751 1.439.751.96 0 1.737-.77 1.75-1.727a2.481 2.481 0 0 0-.046-.385l-2.653-11.895-.003-.016Z"/>
						</svg>
						<div>
							<div class="text-sm font-medium flex items-center gap-1.5">
								Hide Scrappy Materials
								<a
									href="https://arcraiders.wiki/wiki/Scrappy"
									target="_blank"
									rel="noopener noreferrer"
									class="inline-flex text-muted-foreground hover:text-[var(--arc-cyan)] transition-colors"
									onclick={(e) => e.stopPropagation()}
									aria-label="Learn more about Scrappy"
								>
									<ExternalLink class="size-3.5" />
								</a>
							</div>
							<div class="text-xs text-muted-foreground">Auto-collected by Scrappy the rooster</div>
						</div>
					</div>
					<Switch bind:checked={settings.hideScrappyCollected} data-test-id="hide-scrappy-toggle" />
				</div>

				<!-- Hide Expensive Sources -->
				<div class="p-3 rounded-lg border border-border hover:border-[var(--arc-cyan)]/40 transition-all space-y-3">
					<div class="flex items-center justify-between cursor-pointer">
						<div class="flex items-center gap-3">
							<CoinIcon class="text-[var(--arc-amber)]" size={20} />
							<div>
								<div class="text-sm font-medium">Hide Expensive Sources</div>
								<div class="text-xs text-muted-foreground">Skip items worth more to sell</div>
							</div>
						</div>
						<Switch bind:checked={settings.maxSourceValueEnabled} data-test-id="hide-expensive-toggle" />
					</div>

					{#if settings.maxSourceValueEnabled}
						<div class="pt-1 space-y-2 border-t border-border/50">
							<div class="flex items-center gap-3">
								<Label class="text-sm text-muted-foreground whitespace-nowrap">Max value</Label>
								<input
									type="number"
									min="0"
									max={maxMaterialValue}
									step="100"
									bind:value={settings.maxSourceValue}
									class="flex-1 px-3 py-2 rounded-lg border-2 border-border bg-background text-sm font-medium text-foreground focus:border-[var(--arc-cyan)] focus:outline-none transition-colors"
									placeholder="Coins"
									data-test-id="max-value-input"
								/>
							</div>
							<p class="text-xs text-muted-foreground">
								Don't suggest sources worth more than {settings.maxSourceValue} coins
							</p>
						</div>
					{/if}
				</div>
			</section>

			<!-- Source Filters -->
			<section class="space-y-3">
				<h3 class="section-header">Source Filters</h3>

				<!-- Source Rarity -->
				<div class="space-y-2">
					<button
						onclick={() => rarityExpanded = !rarityExpanded}
						class="flex items-center justify-between w-full cursor-pointer group"
					>
						<h4 class="text-sm font-medium">Rarity</h4>
						<ChevronDown class="size-4 transition-transform {rarityExpanded ? 'rotate-180' : ''}" />
					</button>

					{#if rarityExpanded}
						<div class="space-y-2 pl-1">
							<div class="flex items-center gap-2 mb-2">
								<button
									onclick={() => settings.setAllRarities(true)}
									class="text-xs text-[var(--arc-cyan)] hover:underline cursor-pointer"
								>
									Select All
								</button>
								<span class="text-xs text-muted-foreground">•</span>
								<button
									onclick={() => settings.setAllRarities(false)}
									class="text-xs text-[var(--arc-cyan)] hover:underline cursor-pointer"
								>
									Clear All
								</button>
							</div>
							{#each RARITIES as rarity}
								{@const isChecked = settings.rarityFilters.has(rarity)}
								<button
									onclick={() => settings.toggleMaterialRarity(rarity)}
									class="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-accent transition-colors w-full text-left"
									data-test-id="rarity-filter-{rarity.toLowerCase()}"
								>
									<Checkbox checked={isChecked} />
									<span class="text-sm rarity-{rarity.toLowerCase()}">{rarity}</span>
								</button>
							{/each}
						</div>
					{/if}
				</div>

				<!-- Source Categories -->
				<div class="space-y-2">
					<button
						onclick={() => categoryExpanded = !categoryExpanded}
						class="flex items-center justify-between w-full cursor-pointer group"
					>
						<h4 class="text-sm font-medium">Categories</h4>
						<ChevronDown class="size-4 transition-transform {categoryExpanded ? 'rotate-180' : ''}" />
					</button>

					{#if categoryExpanded}
						{#if availableCategories.length === 0}
							<p class="text-sm text-muted-foreground pl-1">No sources to filter</p>
						{:else}
							<div class="space-y-2 pl-1">
								<div class="flex items-center gap-2 mb-2">
									<button
										onclick={selectAllCategories}
										class="text-xs text-[var(--arc-cyan)] hover:underline cursor-pointer"
									>
										Select All
									</button>
									<span class="text-xs text-muted-foreground">•</span>
									<button
										onclick={clearAllCategories}
										class="text-xs text-[var(--arc-cyan)] hover:underline cursor-pointer"
									>
										Clear All
									</button>
								</div>
								{#each availableCategories as category}
									{@const isChecked = settings.categoryFilters.has(category)}
									<button
										onclick={() => handleCategoryToggle(category)}
										class="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-accent transition-colors w-full text-left"
										data-test-id="category-filter-{category.toLowerCase().replace(/\s+/g, '-')}"
									>
										<Checkbox checked={isChecked} />
										<span class="text-sm">{category}</span>
									</button>
								{/each}
							</div>
						{/if}
					{/if}
				</div>

				<!-- Source Types -->
				<div class="space-y-2">
					<button
						onclick={() => typeExpanded = !typeExpanded}
						class="flex items-center justify-between w-full cursor-pointer group"
					>
						<h4 class="text-sm font-medium">Types</h4>
						<ChevronDown class="size-4 transition-transform {typeExpanded ? 'rotate-180' : ''}" />
					</button>

					{#if typeExpanded}
						{#if availableTypes.length === 0}
							<p class="text-sm text-muted-foreground pl-1">No sources to filter</p>
						{:else}
							<div class="space-y-2 pl-1">
								<div class="flex items-center gap-2 mb-2">
									<button
										onclick={selectAllTypes}
										class="text-xs text-[var(--arc-cyan)] hover:underline cursor-pointer"
									>
										Select All
									</button>
									<span class="text-xs text-muted-foreground">•</span>
									<button
										onclick={clearAllTypes}
										class="text-xs text-[var(--arc-cyan)] hover:underline cursor-pointer"
									>
										Clear All
									</button>
								</div>
								{#each availableTypes as type}
									{@const isChecked = settings.sourceTypeFilters.has(type)}
									<button
										onclick={() => handleTypeToggle(type)}
										class="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-accent transition-colors w-full text-left"
										data-test-id="type-filter-{type.toLowerCase().replace(/\s+/g, '-')}"
									>
										<Checkbox checked={isChecked} />
										<span class="text-sm">{type}</span>
									</button>
								{/each}
							</div>
						{/if}
					{/if}
				</div>
			</section>
		</div>

		<!-- Footer -->
		<div class="border-t border-border px-4 pt-4 pb-2 space-y-3">
			<!-- Feedback Message -->
			{#if showFeedback && feedbackMessage}
				<div
					class="px-3 py-2 rounded-lg text-sm font-medium transition-all {feedbackType === 'success'
						? 'bg-[var(--arc-cyan)]/10 text-[var(--arc-cyan)] border border-[var(--arc-cyan)]/30'
						: 'bg-destructive/10 text-destructive border border-destructive/30'}"
				>
					{feedbackMessage}
				</div>
			{/if}

			<!-- Import/Export Buttons -->
			<div class="grid grid-cols-2 gap-2">
				<Button.Root
					variant="outline"
					class="cursor-pointer"
					onclick={triggerFileInput}
					data-test-id="settings-import-btn"
				>
					<Upload class="size-4 mr-2" />
					Import
				</Button.Root>
				<Button.Root
					variant="outline"
					class="cursor-pointer"
					onclick={handleExportSettings}
					data-test-id="settings-export-btn"
				>
					<Download class="size-4 mr-2" />
					Export
				</Button.Root>
			</div>

			<!-- Hidden File Input -->
			<input
				type="file"
				accept=".json"
				bind:this={fileInputRef}
				onchange={handleImportSettings}
				class="hidden"
			/>
		</div>
	</Drawer.Content>
</Drawer.Root>
