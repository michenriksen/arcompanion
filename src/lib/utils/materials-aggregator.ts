import type { Item, CraftingRecipe, SalvagingOutput, RecyclingOutput, SqlValue } from '$lib/types/database';
import type { MaterialRequirement, SalvagingSource, AggregatedMaterialsData, MaterialFilterOptions, MaterialRarity } from '$lib/types/materials';

interface DatabaseLike {
	query<T>(sql: string, params?: SqlValue[]): T[];
	queryOne<T>(sql: string, params?: SqlValue[]): T | undefined;
}


// Materials auto-collected by Scrappy drone
const SCRAPPY_MATERIALS = new Set([
	'metal_parts',
	'fabric',
	'plastic_parts',
	'chemicals',
	'rubber_parts',
	'assorted_seeds'
]);

// Adjusted formula constants (Balanced mode)
const RARITY_SALVAGE_PENALTY: Record<string, number> = {
	Common: 1.0,
	Uncommon: 0.9,
	Rare: 0.8,
	Epic: 0.7,
	Legendary: 0.6
};

const RARITY_RECYCLE_BONUS: Record<string, number> = {
	Common: 1.0,
	Uncommon: 1.1,
	Rare: 1.15,
	Epic: 1.2,
	Legendary: 1.25
};

const IMMEDIACY_BONUS = 1.2;
const RECYCLING_THRESHOLD = 2.0;
const COMPLEXITY_PENALTY = 0.85;
const SLOT_EFFICIENCY_WEIGHT = 0.3;
const DEFAULT_STACK_SIZE = 1;

/**
 * Calculate multi-material bonus for recycling
 */
function multiMaterialBonus(numMaterials: number): number {
	return Math.pow(1.15, numMaterials - 1);
}

/**
 * Calculate carry weight penalty for recycling
 */
function carryWeightPenalty(weight: number): number {
	return Math.max(0.3, 1 - (weight / 10));
}

/**
 * Calculate value bonus for recycling (capped at +30%)
 */
function valueBonus(value: number): number {
	return Math.min(1.3, 1 + (value / 5000) * 0.1);
}

/**
 * Calculate slot efficiency gain from salvaging/recycling
 * Returns the ratio of average output stack size to input stack size
 */
function calculateSlotEfficiency(
	item: Item,
	outputYields: Map<string, number>,
	db: DatabaseLike
): number {
	const itemStackSize = item.stack_size ?? DEFAULT_STACK_SIZE;

	if (outputYields.size === 0) return 1.0;

	// Calculate weighted average stack size of outputs
	const totalQuantity = Array.from(outputYields.values()).reduce((sum, qty) => sum + qty, 0);

	let weightedStackSum = 0;
	for (const [materialId, quantity] of outputYields.entries()) {
		const materialItem = db.queryOne<Item>('SELECT * FROM items WHERE id = ?', [materialId]);
		const stackSize = materialItem?.stack_size ?? DEFAULT_STACK_SIZE;
		weightedStackSum += stackSize * quantity;
	}

	const avgOutputStack = weightedStackSum / totalQuantity;

	return avgOutputStack / itemStackSize;
}

/**
 * Extract base name by removing tier suffixes (I, II, III, IV)
 */
function getBaseName(name: string): string {
	return name.replace(/\s+(I|II|III|IV)$/, '');
}

/**
 * Check if a material should be included based on filter settings
 */
function shouldIncludeMaterial(
	material: Item,
	filterOptions: MaterialFilterOptions
): boolean {
	// Rarity filter
	if (!filterOptions.rarityFilters.has(material.rarity as MaterialRarity)) {
		return false;
	}

	// Scrappy filter
	if (filterOptions.hideScrappyCollected && SCRAPPY_MATERIALS.has(material.id)) {
		return false;
	}

	return true;
}

/**
 * Aggregate materials and salvaging/recycling sources from bookmarked items
 */
export function aggregateMaterials(
	bookmarkedIds: Set<string>,
	db: DatabaseLike,
	scoringMethod: 'max_yield' | 'weight_conscious' = 'max_yield',
	filterOptions: MaterialFilterOptions = {
		hideScrappyCollected: false,
		rarityFilters: new Set(['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'])
	}
): AggregatedMaterialsData {
	// Maps to track material requirements
	const materialQuantityMap = new Map<string, number>();
	const materialRequiredByMap = new Map<string, Set<string>>();
	const materialItemsMap = new Map<string, Item>();

	// Step 1: Aggregate materials from all bookmarked items
	for (const itemId of bookmarkedIds) {
		// Skip paused items
		if (filterOptions.pausedBookmarks?.has(itemId)) {
			continue;
		}

		const recipes = db.query<CraftingRecipe>(
			'SELECT * FROM crafting_recipes WHERE item_id = ?',
			[itemId]
		);

		for (const recipe of recipes) {
			const { ingredient_id, quantity } = recipe;

			// Store material item data if not already present
			if (!materialItemsMap.has(ingredient_id)) {
				const materialItem = db.queryOne<Item>(
					'SELECT * FROM items WHERE id = ?',
					[ingredient_id]
				);
				if (materialItem) {
					materialItemsMap.set(ingredient_id, materialItem);
				}
			}

			// Check if material should be included based on filters
			const materialItem = materialItemsMap.get(ingredient_id);
			if (!materialItem || !shouldIncludeMaterial(materialItem, filterOptions)) {
				continue; // Skip this material
			}

			// Aggregate quantity
			const currentQuantity = materialQuantityMap.get(ingredient_id) || 0;
			materialQuantityMap.set(ingredient_id, currentQuantity + quantity);

			// Track which items require this material
			if (!materialRequiredByMap.has(ingredient_id)) {
				materialRequiredByMap.set(ingredient_id, new Set());
			}
			materialRequiredByMap.get(ingredient_id)!.add(itemId);
		}
	}

	// Step 2: Build material requirements array
	const materials: MaterialRequirement[] = [];
	for (const [materialId, totalQuantity] of materialQuantityMap.entries()) {
		const item = materialItemsMap.get(materialId);
		const requiredBy = Array.from(materialRequiredByMap.get(materialId) || []);

		if (item) {
			materials.push({
				item,
				totalQuantity,
				requiredBy
			});
		}
	}

	// Sort materials by quantity descending
	materials.sort((a, b) => b.totalQuantity - a.totalQuantity);

	// Step 3: Find salvaging AND recycling sources for materials
	const materialIds = Array.from(materialQuantityMap.keys());
	const bookmarkedIdsArray = Array.from(bookmarkedIds);
	const excludedIds = new Set([
		...bookmarkedIdsArray,
		...materialIds,
		...(filterOptions.hiddenSourceItems || [])
	]);

	// Group sources by base name to aggregate tier variants
	const groupedSources = new Map<string, {
		items: Item[],
		salvageYieldsMap: Map<string, number>,
		recycleYieldsMap: Map<string, number>,
		baseName: string
	}>();

	// Query salvaging outputs
	for (const materialId of materialIds) {
		const placeholders = Array.from(excludedIds).map(() => '?').join(',');
		const sources = db.query<SalvagingOutput & Item>(
			`SELECT so.item_id, so.output_id, so.quantity, i.*
			 FROM salvaging_outputs so
			 JOIN items i ON so.item_id = i.id
			 WHERE so.output_id = ?
			 AND so.item_id NOT IN (${placeholders})`,
			[materialId, ...Array.from(excludedIds)]
		);

		for (const source of sources) {
			const baseName = getBaseName(source.name);

			if (!groupedSources.has(baseName)) {
				groupedSources.set(baseName, {
					items: [],
					salvageYieldsMap: new Map(),
					recycleYieldsMap: new Map(),
					baseName
				});
			}

			const group = groupedSources.get(baseName)!;

			// Add item if not already present
			if (!group.items.some(item => item.id === source.id)) {
				group.items.push(source as Item);
			}

			// Aggregate salvage yields for this material
			const currentYield = group.salvageYieldsMap.get(materialId) || 0;
			group.salvageYieldsMap.set(materialId, currentYield + source.quantity);
		}
	}

	// Query recycling outputs
	for (const materialId of materialIds) {
		const placeholders = Array.from(excludedIds).map(() => '?').join(',');
		const sources = db.query<RecyclingOutput & Item>(
			`SELECT ro.item_id, ro.output_id, ro.quantity, i.*
			 FROM recycling_outputs ro
			 JOIN items i ON ro.item_id = i.id
			 WHERE ro.output_id = ?
			 AND ro.item_id NOT IN (${placeholders})`,
			[materialId, ...Array.from(excludedIds)]
		);

		for (const source of sources) {
			const baseName = getBaseName(source.name);

			if (!groupedSources.has(baseName)) {
				groupedSources.set(baseName, {
					items: [],
					salvageYieldsMap: new Map(),
					recycleYieldsMap: new Map(),
					baseName
				});
			}

			const group = groupedSources.get(baseName)!;

			// Add item if not already present
			if (!group.items.some(item => item.id === source.id)) {
				group.items.push(source as Item);
			}

			// Aggregate recycle yields for this material
			const currentYield = group.recycleYieldsMap.get(materialId) || 0;
			group.recycleYieldsMap.set(materialId, currentYield + source.quantity);
		}
	}

	// Calculate total demand for normalization
	const totalDemand = Array.from(materialQuantityMap.values()).reduce((sum, qty) => sum + qty, 0);

	// Step 4: Build sources with salvage and recycle scores
	const allSources: SalvagingSource[] = [];
	for (const group of groupedSources.values()) {
		// Skip if no salvaging or recycling data
		if (group.salvageYieldsMap.size === 0 && group.recycleYieldsMap.size === 0) {
			continue;
		}

		// Use first item as representative
		const representativeItem = group.items[0];

		// Average yields across all tier variants, filtering out materials not in demand
		const avgSalvageYields = new Map<string, number>();
		for (const [materialId, totalYield] of group.salvageYieldsMap.entries()) {
			// Only include materials that passed the filter (are in materialQuantityMap)
			if (materialQuantityMap.has(materialId)) {
				const avgYield = Math.round(totalYield / group.items.length);
				avgSalvageYields.set(materialId, avgYield);
			}
		}

		const avgRecycleYields = new Map<string, number>();
		for (const [materialId, totalYield] of group.recycleYieldsMap.entries()) {
			// Only include materials that passed the filter (are in materialQuantityMap)
			if (materialQuantityMap.has(materialId)) {
				const avgYield = Math.round(totalYield / group.items.length);
				avgRecycleYields.set(materialId, avgYield);
			}
		}

		// Calculate salvage score
		let salvageBaseScore = 0;
		const salvageTotalYield = Array.from(avgSalvageYields.values()).reduce((sum, qty) => sum + qty, 0);

		if (totalDemand > 0 && salvageTotalYield > 0) {
			for (const [materialId, yieldAmount] of avgSalvageYields.entries()) {
				const userNeeds = materialQuantityMap.get(materialId) || 0;
				const demandWeight = userNeeds / totalDemand;
				salvageBaseScore += yieldAmount * demandWeight;
			}
		}

		// Calculate total weight of yielded materials (player carries these after salvaging)
		let totalYieldWeight = 0;
		for (const [materialId, yieldAmount] of avgSalvageYields.entries()) {
			const materialItem = db.queryOne<Item>('SELECT * FROM items WHERE id = ?', [materialId]);
			if (materialItem) {
				totalYieldWeight += yieldAmount * materialItem.weight_kg;
			}
		}

		// Fallback to source item weight if no yield weight (shouldn't happen)
		const effectiveWeight = totalYieldWeight > 0 ? totalYieldWeight : representativeItem.weight_kg;

		// Apply scoring method to salvage score
		const weightFactor = scoringMethod === 'weight_conscious'
			? Math.pow(effectiveWeight, 2)
			: effectiveWeight;

		let salvageScore = (salvageBaseScore / weightFactor)
			* (RARITY_SALVAGE_PENALTY[representativeItem.rarity] || 1.0)
			* IMMEDIACY_BONUS;

		// Apply slot efficiency bonus
		const slotEfficiency = calculateSlotEfficiency(representativeItem, avgSalvageYields, db);
		const slotBonus = Math.max(1.0, 1 + (slotEfficiency - 1) * SLOT_EFFICIENCY_WEIGHT);
		salvageScore *= slotBonus;

		// Calculate recycle score
		let recycleBaseScore = 0;
		const recycleTotalYield = Array.from(avgRecycleYields.values()).reduce((sum, qty) => sum + qty, 0);

		if (totalDemand > 0 && recycleTotalYield > 0) {
			for (const [materialId, yieldAmount] of avgRecycleYields.entries()) {
				const userNeeds = materialQuantityMap.get(materialId) || 0;
				const demandWeight = userNeeds / totalDemand;
				recycleBaseScore += yieldAmount * demandWeight;
			}
		}

		// Apply scoring method to recycle score
		let recycleScore: number;
		if (scoringMethod === 'max_yield') {
			// Simplified formula prioritizing quantity
			recycleScore = (recycleBaseScore / representativeItem.weight_kg)
				* (RARITY_RECYCLE_BONUS[representativeItem.rarity] || 1.0)
				* multiMaterialBonus(avgRecycleYields.size)
			* COMPLEXITY_PENALTY;
		} else {
			// Full formula with all penalties for weight conscious
			recycleScore = (recycleBaseScore / Math.pow(representativeItem.weight_kg, 2))
				* (RARITY_RECYCLE_BONUS[representativeItem.rarity] || 1.0)
				* multiMaterialBonus(avgRecycleYields.size)
				* carryWeightPenalty(representativeItem.weight_kg)
				* valueBonus(representativeItem.value)
			* COMPLEXITY_PENALTY;
		}

		// Apply slot efficiency bonus (same as salvage)
		const recycleSlotEfficiency = calculateSlotEfficiency(representativeItem, avgRecycleYields, db);
		const recycleSlotBonus = Math.max(1.0, 1 + (recycleSlotEfficiency - 1) * SLOT_EFFICIENCY_WEIGHT);
		recycleScore *= recycleSlotBonus;

		allSources.push({
			item: representativeItem,
			salvageYields: avgSalvageYields,
			recycleYields: avgRecycleYields,
			salvageScore,
			recycleScore,
			baseName: group.baseName
		});
	}

	// Step 5: Split sources into salvage vs recycle based on scores
	const salvageSources: SalvagingSource[] = [];
	const recycleSources: SalvagingSource[] = [];

	for (const source of allSources) {
		// Skip items with no useful yields (both scores are 0)
		if (source.salvageScore === 0 && source.recycleScore === 0) {
			continue;
		}

		// If no salvage data, must recycle
		if (source.salvageScore === 0 && source.recycleScore > 0) {
			recycleSources.push(source);
			continue;
		}

		// If no recycle data, must salvage
		if (source.recycleScore === 0 && source.salvageScore > 0) {
			salvageSources.push(source);
			continue;
		}

		// Compare scores
		const recyclingAdvantage = source.recycleScore / source.salvageScore;

		if (recyclingAdvantage > RECYCLING_THRESHOLD) {
			recycleSources.push(source);
		} else {
			salvageSources.push(source);
		}
	}

	// Sort by respective scores
	salvageSources.sort((a, b) => b.salvageScore - a.salvageScore);
	recycleSources.sort((a, b) => b.recycleScore - a.recycleScore);

	// Step 6: Build relationship maps for hover highlighting
	const materialToSources = new Map<string, string[]>();
	const sourceToMaterials = new Map<string, string[]>();

	for (const source of [...salvageSources, ...recycleSources]) {
		const sourceId = source.item.id;
		const materialsProvided: string[] = [];

		// Include both salvage and recycle yields
		const allYields = new Map([...source.salvageYields, ...source.recycleYields]);

		for (const [materialId] of allYields) {
			// Map material -> sources
			if (!materialToSources.has(materialId)) {
				materialToSources.set(materialId, []);
			}
			if (!materialToSources.get(materialId)!.includes(sourceId)) {
				materialToSources.get(materialId)!.push(sourceId);
			}

			// Track materials for source -> materials mapping
			if (!materialsProvided.includes(materialId)) {
				materialsProvided.push(materialId);
			}
		}

		// Map source -> materials
		sourceToMaterials.set(sourceId, materialsProvided);
	}

	return {
		materials,
		salvageSources,
		recycleSources,
		materialToSources,
		sourceToMaterials
	};
}
