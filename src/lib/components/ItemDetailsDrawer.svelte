<script lang="ts">
	import { db } from '$lib/stores/database.svelte';
	import { selectedItem } from '$lib/stores/selected-item.svelte';
	import { settings } from '$lib/stores/settings.svelte';
	import type { Item, ItemWithQuantity, CraftingBench } from '$lib/types/database';
	import { normalizeRarity } from '$lib/utils/rarity-helpers';
	import * as Drawer from '$lib/components/ui/drawer';
	import * as Button from '$lib/components/ui/button';
	import ItemIcon from './ItemIcon.svelte';
	import ItemEffects from './ItemEffects.svelte';
	import CoinIcon from './CoinIcon.svelte';
	import X from '@lucide/svelte/icons/x';
	import Bookmark from '@lucide/svelte/icons/bookmark';
	import EyeOff from '@lucide/svelte/icons/eye-off';

	// Query database for item details when an item is selected
	const itemData = $derived.by(() => {
		if (!selectedItem.selectedItemId || db.status !== 'ready') {
			return null;
		}

		const itemId = selectedItem.selectedItemId;

		return {
			item: db.queryOne<Item>('SELECT * FROM items WHERE id = ?', [itemId]),
			ingredients: db.query<ItemWithQuantity>(
				`SELECT i.*, cr.quantity
				 FROM crafting_recipes cr
				 JOIN items i ON cr.ingredient_id = i.id
				 WHERE cr.item_id = ?
				 ORDER BY i.name`,
				[itemId]
			),
			benches: db.query<CraftingBench>(
				'SELECT * FROM crafting_benches WHERE item_id = ? ORDER BY station_level',
				[itemId]
			),
			recycling: db.query<ItemWithQuantity>(
				`SELECT i.*, ro.quantity
				 FROM recycling_outputs ro
				 JOIN items i ON ro.output_id = i.id
				 WHERE ro.item_id = ?
				 ORDER BY i.name`,
				[itemId]
			),
			salvaging: db.query<ItemWithQuantity>(
				`SELECT i.*, so.quantity
				 FROM salvaging_outputs so
				 JOIN items i ON so.output_id = i.id
				 WHERE so.item_id = ?
				 ORDER BY i.name`,
				[itemId]
			)
		};
	});

	// Check if current item is bookmarked
	const isBookmarked = $derived(
		itemData?.item ? settings.isBookmarked(itemData.item.id) : false
	);

	// Check if current item is hidden from sources
	const isSourceHidden = $derived(
		itemData?.item ? settings.isSourceHidden(itemData.item.id) : false
	);

	// Check if item can be a source (has salvaging or recycling outputs)
	const canBeSource = $derived(
		itemData ? (itemData.salvaging.length > 0 || itemData.recycling.length > 0) : false
	);
</script>

<Drawer.Root bind:open={selectedItem.drawerOpen} direction="left" onOpenChange={(open) => {
	if (!open) selectedItem.closeDrawer();
}}>
	<Drawer.Content class="h-full sm:max-w-md lg:max-w-lg" data-test-id="item-drawer">
		{#if itemData?.item}
			<Drawer.Header class="relative border-b border-[var(--arc-cyan)]/30">
				<button
					onclick={() => selectedItem.closeDrawer()}
					class="absolute right-4 top-4 cursor-pointer rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-hidden focus:ring-2 focus:ring-[var(--arc-cyan)] focus:ring-offset-2"
					aria-label="Close"
					data-test-id="item-drawer-close"
				>
					<X class="size-4" />
				</button>
				<div class="flex items-start gap-3 mb-3">
					<ItemIcon
					itemId={itemData.item.id}
					imageName={itemData.item.image_name}
					alt={itemData.item.name}
					size="size-16"
					loading="eager"
				/>
					<div class="flex-1 min-w-0 pr-8">
						<Drawer.Title class="text-xl mb-1" data-test-id="item-drawer-title">{itemData.item.name}</Drawer.Title>
						<div class="flex gap-2 text-sm">
							<span class="rarity-{itemData.item.rarity.toLowerCase()} font-medium">
								{itemData.item.rarity}
							</span>
							<span class="text-muted-foreground">•</span>
							<span class="text-muted-foreground">{itemData.item.type}</span>
						</div>
					</div>
				</div>

				{#if itemData.item.is_craftable}
					<Button.Root
						variant={isBookmarked ? 'default' : 'outline'}
						size="default"
						class="w-full cursor-pointer {isBookmarked ? 'bg-[var(--arc-amber)] hover:bg-[var(--arc-amber)]/90 text-black' : ''}"
						onclick={() => settings.toggle(itemData.item!.id)}
						data-test-id="item-drawer-bookmark-btn"
					>
						<Bookmark
							class="size-4 mr-2 {isBookmarked
								? 'fill-current'
								: 'fill-none'}"
						/>
						{isBookmarked ? 'Bookmarked' : 'Bookmark Item'}
					</Button.Root>
				{/if}

				{#if canBeSource}
					<Button.Root
						variant={isSourceHidden ? 'default' : 'outline'}
						size="default"
						class="w-full cursor-pointer mt-2 {isSourceHidden ? 'bg-red-500 hover:bg-red-600 text-white' : ''}"
						onclick={() => settings.toggleSourceHidden(itemData.item!.id)}
					>
						<EyeOff class="size-4 mr-2" />
						{isSourceHidden ? 'Hidden from Sources' : 'Hide from Sources'}
					</Button.Root>
				{/if}
			</Drawer.Header>

			<div class="px-4 pt-6 pb-4 space-y-6 overflow-y-auto flex-1">
				<!-- Description -->
				{#if itemData.item.description}
					<div>
						<h3 class="section-header mb-2">Description</h3>
						<p class="text-sm text-muted-foreground">{itemData.item.description}</p>
					</div>
				{/if}

				<!-- Stats -->
				<div>
					<h3 class="section-header mb-2">Stats</h3>
					<dl class="grid grid-cols-2 gap-2 text-sm">
						<div>
							<dt class="text-muted-foreground">Value</dt>
							<dd class="font-medium flex items-center gap-1">
								{itemData.item.value}
								<CoinIcon size={14} class="text-[var(--arc-amber)]" />
							</dd>
						</div>
						<div>
							<dt class="text-muted-foreground">Weight</dt>
							<dd class="font-medium">{itemData.item.weight_kg} kg</dd>
						</div>
						{#if itemData.item.stack_size}
							<div>
								<dt class="text-muted-foreground">Stack Size</dt>
								<dd class="font-medium">{itemData.item.stack_size}</dd>
							</div>
						{/if}
						{#if itemData.item.is_weapon}
							<div>
								<dt class="text-muted-foreground">Type</dt>
								<dd class="font-medium">Weapon</dd>
							</div>
						{/if}
					</dl>
				</div>

				<!-- Effects -->
				{#if itemData.item.effects}
					<div>
						<h3 class="section-header mb-2">Effects</h3>
						<ItemEffects effects={itemData.item.effects} />
					</div>
				{/if}

				<!-- Crafting Requirements -->
				{#if itemData.item.is_craftable}
					<div>
						<h3 class="section-header mb-3">Crafting</h3>

						<!-- Ingredients -->
						{#if itemData.ingredients.length > 0}
							<div class="space-y-2">
								{#each itemData.ingredients as ingredient}
										<button
											onclick={() => selectedItem.selectItem(ingredient.id)}
											class="flex items-center gap-2 w-full rounded-lg p-2 border border-transparent hover:border-[var(--arc-cyan)]/50 hover:bg-accent/50 transition-all text-left cursor-pointer"
											data-test-id="item-ingredient-{ingredient.id}"
										>
											<ItemIcon
												itemId={ingredient.id}
												imageName={ingredient.image_name}
												alt={ingredient.name}
												size="size-8"
												loading="lazy"
											/>
											<div class="flex-1 min-w-0">
												<div class="text-sm font-medium truncate">{ingredient.name}</div>
												<div class="text-xs text-muted-foreground">Quantity: {ingredient.quantity}</div>
											</div>
										</button>
								{/each}
							</div>
						{/if}
					</div>
				{:else}
					<div>
						<h3 class="section-header mb-2">Crafting</h3>
						<p class="text-sm text-muted-foreground">This item cannot be crafted.</p>
					</div>
				{/if}

				<!-- Salvaging -->
				{#if itemData.salvaging.length > 0}
					<div>
						<h3 class="section-header mb-3">Salvaging</h3>
						<div class="space-y-2">
							{#each itemData.salvaging as output}
								<button
									onclick={() => selectedItem.selectItem(output.id)}
									class="flex items-center gap-2 w-full rounded-lg p-2 border border-transparent hover:border-[var(--arc-cyan)]/50 hover:bg-accent/50 transition-all text-left cursor-pointer"
									data-test-id="item-salvage-output-{output.id}"
								>
									<ItemIcon itemId={output.id} imageName={output.image_name} alt={output.name} size="size-8" loading="lazy" />
									<div class="flex-1 min-w-0">
										<div class="text-sm font-medium truncate">{output.name}</div>
										<div class="text-xs text-muted-foreground">Quantity: {output.quantity}</div>
									</div>
								</button>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Recycling -->
				{#if itemData.recycling.length > 0}
					<div>
						<h3 class="section-header mb-3">Recycling</h3>
						<div class="space-y-2">
							{#each itemData.recycling as output}
								<button
									onclick={() => selectedItem.selectItem(output.id)}
									class="flex items-center gap-2 w-full rounded-lg p-2 border border-transparent hover:border-[var(--arc-cyan)]/50 hover:bg-accent/50 transition-all text-left cursor-pointer"
									data-test-id="item-recycle-output-{output.id}"
								>
									<ItemIcon itemId={output.id} imageName={output.image_name} alt={output.name} size="size-8" loading="lazy" />
									<div class="flex-1 min-w-0">
										<div class="text-sm font-medium truncate">{output.name}</div>
										<div class="text-xs text-muted-foreground">Quantity: {output.quantity}</div>
									</div>
								</button>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		{:else if db.status === 'loading'}
			<div class="p-6 text-center">
				<p class="text-sm text-muted-foreground">Loading item data...</p>
			</div>
		{:else if db.status === 'error'}
			<div class="p-6 text-center">
				<p class="text-sm text-destructive">Failed to load item data</p>
			</div>
		{/if}
	</Drawer.Content>
</Drawer.Root>
