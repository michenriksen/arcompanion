<script lang="ts">
	import type { MaterialRequirement, SalvagingSource } from '$lib/types/materials';
	import { db } from '$lib/stores/database.svelte';
	import CoinIcon from './CoinIcon.svelte';

	interface Props {
		item: MaterialRequirement | SalvagingSource | null;
		x: number;
		y: number;
		type: 'material' | 'source';
	}

	let { item, x, y, type }: Props = $props();

	// Helper to get item names from IDs
	function getItemNames(itemIds: string[]): string[] {
		if (db.status !== 'ready') return [];
		return itemIds
			.map(id => db.queryOne<{ name: string }>('SELECT name FROM items WHERE id = ?', [id]))
			.filter(result => result !== undefined)
			.map(result => result!.name);
	}

	// Helper to get salvage yields from database
	function getSalvageYields(itemId: string): Array<{ name: string; quantity: number }> {
		if (db.status !== 'ready') return [];
		const yields = db.query<{ name: string; quantity: number }>(
			`SELECT i.name, so.quantity
			 FROM salvaging_outputs so
			 JOIN items i ON so.output_id = i.id
			 WHERE so.item_id = ?
			 ORDER BY so.quantity DESC`,
			[itemId]
		);
		return yields;
	}

	// Helper to get recycle yields from database
	function getRecycleYields(itemId: string): Array<{ name: string; quantity: number }> {
		if (db.status !== 'ready') return [];
		const yields = db.query<{ name: string; quantity: number }>(
			`SELECT i.name, ro.quantity
			 FROM recycling_outputs ro
			 JOIN items i ON ro.output_id = i.id
			 WHERE ro.item_id = ?
			 ORDER BY ro.quantity DESC`,
			[itemId]
		);
		return yields;
	}

	// Calculate tooltip position (offset from cursor)
	const tooltipStyle = $derived(() => {
		const offsetX = 15;
		const offsetY = 15;
		return `left: ${x + offsetX}px; top: ${y + offsetY}px;`;
	});

	const isMaterial = $derived(type === 'material' && item && 'requiredBy' in item);
	const isSource = $derived(type === 'source' && item && 'salvageScore' in item);
</script>

{#if item}
	<div class="tooltip" style={tooltipStyle()}>
		<div class="tooltip-header">
			<div class="tooltip-name break-words">{item.item.name}</div>
			<div class="tooltip-rarity rarity-{item.item.rarity.toLowerCase()}">{item.item.rarity}</div>
		</div>

		<div class="tooltip-content">
			{#if isMaterial}
				{@const material = item as MaterialRequirement}
				<div class="tooltip-row">
					<span class="tooltip-label">Total Needed:</span>
					<span class="tooltip-value">×{material.totalQuantity}</span>
				</div>
				<div class="tooltip-row flex-wrap">
					<span class="tooltip-label">Required By:</span>
					<span class="tooltip-value whitespace-normal break-words">
						{#if material.requiredBy.length <= 3}
							{getItemNames(material.requiredBy).join(', ')}
						{:else}
							{material.requiredBy.length} items
						{/if}
					</span>
				</div>
			{:else if isSource}
				{@const source = item as SalvagingSource}
				<div class="tooltip-row">
					<span class="tooltip-label">Weight:</span>
					<span class="tooltip-value">{source.item.weight_kg} kg</span>
				</div>
				<div class="tooltip-row">
					<span class="tooltip-label">Value:</span>
					<span class="tooltip-value inline-flex items-center gap-1">
						{source.item.value}
						<CoinIcon size={12} class="text-[var(--arc-amber)]" />
					</span>
				</div>

				{#if source.salvageScore > 0 || source.recycleScore > 0}
					<div class="tooltip-divider"></div>
					{#if source.salvageScore > 0}
						<div class="tooltip-row">
							<span class="tooltip-label text-emerald-400">Salvage:</span>
							<span class="tooltip-value">{source.salvageScore.toFixed(2)}</span>
						</div>
					{/if}
					{#if source.recycleScore > 0}
						<div class="tooltip-row">
							<span class="tooltip-label text-[var(--arc-amber)]">Recycle:</span>
							<span class="tooltip-value">{source.recycleScore.toFixed(2)}</span>
						</div>
					{/if}
				{/if}

				{@const salvageYields = getSalvageYields(source.item.id)}
				{@const recycleYields = getRecycleYields(source.item.id)}
				{#if salvageYields.length > 0 || recycleYields.length > 0}
					<div class="tooltip-divider"></div>
					<div class="tooltip-yields">
						{#if salvageYields.length > 0}
							<div class="tooltip-yield-section">
								<div class="tooltip-yield-header text-emerald-400">Salvage Yields:</div>
								{#each salvageYields as material}
									<div class="tooltip-row flex-wrap">
										<span class="tooltip-label break-words">{material.name}</span>
										<span class="tooltip-value">×{material.quantity}</span>
									</div>
								{/each}
							</div>
						{/if}
						{#if recycleYields.length > 0}
							<div class="tooltip-yield-section">
								<div class="tooltip-yield-header text-[var(--arc-amber)]">Recycle Yields:</div>
								{#each recycleYields as material}
									<div class="tooltip-row flex-wrap">
										<span class="tooltip-label break-words">{material.name}</span>
										<span class="tooltip-value">×{material.quantity}</span>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{/if}
			{/if}
		</div>
	</div>
{/if}

<style>
	.tooltip {
		position: fixed;
		z-index: 9999;
		pointer-events: none;
		background: oklch(0.12 0.015 280);
		border: 1px solid var(--arc-cyan);
		border-radius: 0.375rem;
		padding: 0.5rem;
		min-width: 180px;
		max-width: 240px;
		box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
	}

	.tooltip-header {
		margin-bottom: 0.375rem;
		padding-bottom: 0.375rem;
		border-bottom: 1px solid rgba(148, 163, 184, 0.1);
	}

	.tooltip-name {
		font-weight: 600;
		font-size: 0.8125rem;
		margin-bottom: 0.125rem;
		color: var(--foreground);
	}

	.tooltip-rarity {
		font-size: 0.6875rem;
		font-weight: 500;
	}

	.tooltip-content {
		font-size: 0.6875rem;
	}

	.tooltip-row {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
		margin-bottom: 0.125rem;
		min-width: 0;
	}

	.tooltip-row:last-child {
		margin-bottom: 0;
	}

	.tooltip-label {
		color: var(--muted-foreground);
		flex-shrink: 0;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.tooltip-value {
		color: var(--popover-foreground);
		text-align: right;
		flex-shrink: 0;
		white-space: nowrap;
	}

	.tooltip-divider {
		height: 1px;
		background: rgba(148, 163, 184, 0.1);
		margin: 0.375rem 0;
	}

	.tooltip-yields {
		font-size: 0.6875rem;
	}

	.tooltip-yield-section {
		margin-bottom: 0.25rem;
	}

	.tooltip-yield-section:last-child {
		margin-bottom: 0;
	}

	.tooltip-yield-header {
		font-weight: 600;
		font-size: 0.625rem;
		text-transform: uppercase;
		letter-spacing: 0.025em;
		margin-bottom: 0.125rem;
	}

	.truncate {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
