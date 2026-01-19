import type { Item } from './database';

/**
 * Represents an aggregated material requirement across all bookmarked items
 */
export interface MaterialRequirement {
	/** The material item */
	item: Item;
	/** Total quantity needed across all bookmarked items */
	totalQuantity: number;
	/** IDs of bookmarked items that require this material */
	requiredBy: string[];
}

/**
 * Represents an item that can be salvaged or recycled to obtain materials
 */
export interface SalvagingSource {
	/** The source item that can be salvaged/recycled */
	item: Item;
	/** Map of material IDs to quantities yielded when salvaging */
	salvageYields: Map<string, number>;
	/** Map of material IDs to quantities yielded when recycling */
	recycleYields: Map<string, number>;
	/** Salvaging score (higher = better for field salvaging) */
	salvageScore: number;
	/** Recycling score (higher = better for carrying back to base) */
	recycleScore: number;
	/** Base name without tier suffix (e.g., "Anvil" for "Anvil I", "Anvil II") */
	baseName: string;
}

/**
 * Filter options for material aggregation
 */
export interface MaterialFilterOptions {
	hideScrappyCollected: boolean;
	rarityFilters: Set<MaterialRarity>;
	hiddenSourceItems?: Set<string>;
	pausedBookmarks?: Set<string>;
}

export type MaterialRarity = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary';

/**
 * Complete aggregated materials data including relationship maps
 */
export interface AggregatedMaterialsData {
	/** All required materials sorted by quantity descending */
	materials: MaterialRequirement[];
	/** Sources best for field salvaging (sorted by salvage score descending) */
	salvageSources: SalvagingSource[];
	/** Sources best for recycling at base (sorted by recycle score descending) */
	recycleSources: SalvagingSource[];
	/** Map of material ID to source IDs that provide it */
	materialToSources: Map<string, string[]>;
	/** Map of source ID to material IDs it provides */
	sourceToMaterials: Map<string, string[]>;
}
