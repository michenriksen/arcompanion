/**
 * Unified settings store with localStorage persistence
 *
 * Consolidates bookmarks, graph filters, and material filters into a single store.
 * Supports migration from legacy stores and future export/import functionality.
 */

import type { Rarity } from '$lib/utils/rarity-helpers';
import type { ItemType } from '$lib/utils/type-helpers';
import type { AggregatedMaterialsData } from '$lib/types/materials';
import { toggleInArray, includesItem } from '$lib/utils/array-helpers';
import { db } from '$lib/stores/database.svelte';

export type ScoringMethod = 'max_yield' | 'weight_conscious';
export type MaterialRarity = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary';

// Settings structure
export interface BookmarksSettings {
	bookmarkedItems: string[];
	pausedItems: string[];
}

export interface GraphFilterSettings {
	hiddenRarities: Rarity[];
	hiddenTypes: ItemType[];
}

export interface MaterialFilterSettings {
	scoringMethod: ScoringMethod;
	hideScrappyCollected: boolean;
	rarityFilters: MaterialRarity[];
	categoryFilters: string[];
	typeFilters: string[];
	maxSourceValueEnabled: boolean;
	maxSourceValue: number;
}

export interface SourceFilterSettings {
	hiddenSourceItems: string[];
}

export interface SettingsState {
	version: number;
	bookmarks: BookmarksSettings;
	graphFilters: GraphFilterSettings;
	materialFilters: MaterialFilterSettings;
	sourceFilters: SourceFilterSettings;
}

// Default settings
const DEFAULT_SETTINGS: SettingsState = {
	version: 1,
	bookmarks: {
		bookmarkedItems: [],
		pausedItems: []
	},
	graphFilters: {
		hiddenRarities: [],
		hiddenTypes: []
	},
	materialFilters: {
		scoringMethod: 'max_yield',
		hideScrappyCollected: false,
		rarityFilters: ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'],
		categoryFilters: [],
		typeFilters: [],
		maxSourceValueEnabled: false,
		maxSourceValue: 500
	},
	sourceFilters: {
		hiddenSourceItems: []
	}
};

class SettingsStore {
	// Persisted settings
	private _settings = $state<SettingsState>(structuredClone(DEFAULT_SETTINGS));

	// Ephemeral state (not persisted)
	panelOpen = $state(false);
	aggregatedData = $state<AggregatedMaterialsData | null>(null);
	availableCategoriesCount = $state(0);
	availableTypesCount = $state(0);

	// Debounce timer for localStorage saves
	private saveTimer: ReturnType<typeof setTimeout> | null = null;

	constructor() {
		// Load settings from localStorage (runs only in browser)
		if (typeof window !== 'undefined') {
			this.loadFromStorage();

			// Auto-save on settings changes (debounced)
			// Use $effect.root() to create effect outside component context
			$effect.root(() => {
				$effect(() => {
					// Track deep changes by serializing the settings object
					// This ensures nested mutations trigger the effect
					JSON.stringify(this._settings);
					this.debouncedSave();
				});
			});
		}
	}

	// === BOOKMARKS API ===

	/**
	 * Set of currently bookmarked item IDs
	 */
	get bookmarkedItems(): Set<string> {
		return new Set(this._settings.bookmarks.bookmarkedItems);
	}

	/**
	 * Check if an item is bookmarked
	 */
	isBookmarked(itemId: string): boolean {
		return this._settings.bookmarks.bookmarkedItems.includes(itemId);
	}

	/**
	 * Toggle bookmark state for an item
	 */
	toggle(itemId: string) {
		if (this.isBookmarked(itemId)) {
			this._settings.bookmarks.bookmarkedItems = this._settings.bookmarks.bookmarkedItems.filter(
				(id) => id !== itemId
			);
			// Auto-cleanup paused state
			this._settings.bookmarks.pausedItems = this._settings.bookmarks.pausedItems.filter(
				(id) => id !== itemId
			);
		} else {
			this._settings.bookmarks.bookmarkedItems = [
				...this._settings.bookmarks.bookmarkedItems,
				itemId
			];
		}
	}

	/**
	 * Clear all bookmarks
	 */
	clear() {
		this._settings.bookmarks.bookmarkedItems = [];
		this._settings.bookmarks.pausedItems = [];
	}

	/**
	 * Set of currently paused item IDs (filtered to only bookmarked items)
	 */
	get pausedItems(): Set<string> {
		const bookmarked = new Set(this._settings.bookmarks.bookmarkedItems);
		const paused = this._settings.bookmarks.pausedItems.filter(id => bookmarked.has(id));
		return new Set(paused);
	}

	/**
	 * Check if an item is paused
	 */
	isPaused(itemId: string): boolean {
		return this._settings.bookmarks.pausedItems.includes(itemId);
	}

	/**
	 * Toggle pause state for an item
	 */
	togglePause(itemId: string) {
		if (!this.isBookmarked(itemId)) return;

		if (this.isPaused(itemId)) {
			this._settings.bookmarks.pausedItems =
				this._settings.bookmarks.pausedItems.filter(id => id !== itemId);
		} else {
			this._settings.bookmarks.pausedItems = [
				...this._settings.bookmarks.pausedItems,
				itemId
			];
		}
	}

	/**
	 * Clear all paused items
	 */
	clearPaused() {
		this._settings.bookmarks.pausedItems = [];
	}

	// === GRAPH FILTERS API ===

	/**
	 * Set of currently hidden rarities for fast lookups
	 */
	get hiddenRaritiesSet(): Set<Rarity> {
		return new Set(this._settings.graphFilters.hiddenRarities);
	}

	/**
	 * Check if a rarity is currently hidden
	 */
	isRarityHidden(rarity: Rarity): boolean {
		return includesItem(this._settings.graphFilters.hiddenRarities, rarity);
	}

	/**
	 * Toggle visibility for a rarity
	 */
	toggleRarity(rarity: Rarity) {
		this._settings.graphFilters.hiddenRarities = toggleInArray(
			this._settings.graphFilters.hiddenRarities,
			rarity
		);
	}

	/**
	 * Show all rarities
	 */
	showAllRarities() {
		this._settings.graphFilters.hiddenRarities = [];
	}

	/**
	 * Hide all rarities
	 */
	hideAllRarities() {
		this._settings.graphFilters.hiddenRarities = ['legendary', 'epic', 'rare', 'uncommon', 'common'];
	}

	/**
	 * Number of currently hidden rarities
	 */
	get activeRarityFilterCount(): number {
		return this._settings.graphFilters.hiddenRarities.length;
	}

	/**
	 * Set of currently hidden types for fast lookups
	 */
	get hiddenTypesSet(): Set<ItemType> {
		return new Set(this._settings.graphFilters.hiddenTypes);
	}

	/**
	 * Check if a type is currently hidden
	 */
	isTypeHidden(type: ItemType): boolean {
		return includesItem(this._settings.graphFilters.hiddenTypes, type);
	}

	/**
	 * Toggle visibility for a type
	 */
	toggleType(type: ItemType) {
		this._settings.graphFilters.hiddenTypes = toggleInArray(
			this._settings.graphFilters.hiddenTypes,
			type
		);
	}

	/**
	 * Show all types
	 */
	showAllTypes() {
		this._settings.graphFilters.hiddenTypes = [];
	}

	/**
	 * Hide all types
	 */
	hideAllTypes(types: readonly ItemType[]) {
		this._settings.graphFilters.hiddenTypes = [...types];
	}

	/**
	 * Number of currently hidden types
	 */
	get activeTypeFilterCount(): number {
		return this._settings.graphFilters.hiddenTypes.length;
	}

	/**
	 * Total active filter count (rarities + types)
	 */
	get totalActiveFilterCount(): number {
		return this.activeRarityFilterCount + this.activeTypeFilterCount;
	}

	// === MATERIAL FILTERS API ===

	/**
	 * Update aggregated data (called by MaterialsGrid)
	 */
	setAggregatedData(data: AggregatedMaterialsData | null) {
		this.aggregatedData = data;
	}

	/**
	 * Open the filters panel
	 */
	openPanel() {
		this.panelOpen = true;
	}

	/**
	 * Close the filters panel
	 */
	closePanel() {
		this.panelOpen = false;
	}

	/**
	 * Get current scoring method
	 */
	get scoringMethod(): ScoringMethod {
		return this._settings.materialFilters.scoringMethod;
	}

	/**
	 * Set scoring method
	 */
	set scoringMethod(value: ScoringMethod) {
		this._settings.materialFilters.scoringMethod = value;
	}

	/**
	 * Get hide scrappy collected flag
	 */
	get hideScrappyCollected(): boolean {
		return this._settings.materialFilters.hideScrappyCollected;
	}

	/**
	 * Set hide scrappy collected flag
	 */
	set hideScrappyCollected(value: boolean) {
		this._settings.materialFilters.hideScrappyCollected = value;
	}

	/**
	 * Get rarity filters as a Set
	 */
	get rarityFilters(): Set<MaterialRarity> {
		return new Set(this._settings.materialFilters.rarityFilters);
	}

	/**
	 * Toggle a rarity filter
	 */
	toggleMaterialRarity(rarity: MaterialRarity) {
		this._settings.materialFilters.rarityFilters = toggleInArray(
			this._settings.materialFilters.rarityFilters,
			rarity
		);
	}

	/**
	 * Select/deselect all rarities
	 */
	setAllRarities(enabled: boolean) {
		if (enabled) {
			this._settings.materialFilters.rarityFilters = [
				'Common',
				'Uncommon',
				'Rare',
				'Epic',
				'Legendary'
			];
		} else {
			this._settings.materialFilters.rarityFilters = [];
		}
	}

	/**
	 * Get category filters as a Set
	 */
	get categoryFilters(): Set<string> {
		return new Set(this._settings.materialFilters.categoryFilters);
	}

	/**
	 * Toggle a category filter
	 */
	toggleCategory(category: string) {
		this._settings.materialFilters.categoryFilters = toggleInArray(
			this._settings.materialFilters.categoryFilters,
			category
		);
	}

	/**
	 * Set category filters from a Set or Array
	 */
	setCategoryFilters(categories: Set<string> | string[]) {
		this._settings.materialFilters.categoryFilters = Array.from(categories);
	}

	/**
	 * Get source type filters as a Set
	 */
	get sourceTypeFilters(): Set<string> {
		return new Set(this._settings.materialFilters.typeFilters);
	}

	/**
	 * Toggle a source type filter
	 */
	toggleSourceType(type: string) {
		this._settings.materialFilters.typeFilters = toggleInArray(
			this._settings.materialFilters.typeFilters,
			type
		);
	}

	/**
	 * Set source type filters from a Set or Array
	 */
	setSourceTypeFilters(types: Set<string> | string[]) {
		this._settings.materialFilters.typeFilters = Array.from(types);
	}

	/**
	 * Get whether max source value filter is enabled
	 */
	get maxSourceValueEnabled(): boolean {
		return this._settings.materialFilters.maxSourceValueEnabled;
	}

	/**
	 * Set whether max source value filter is enabled
	 */
	set maxSourceValueEnabled(value: boolean) {
		this._settings.materialFilters.maxSourceValueEnabled = value;
	}

	/**
	 * Get maximum source value threshold (items worth more are hidden)
	 */
	get maxSourceValue(): number {
		return this._settings.materialFilters.maxSourceValue;
	}

	/**
	 * Set maximum source value threshold (items worth more are hidden)
	 */
	set maxSourceValue(value: number) {
		this._settings.materialFilters.maxSourceValue = value;
	}

	/**
	 * Reset all material filters to defaults
	 */
	resetAll() {
		this._settings.materialFilters = structuredClone(DEFAULT_SETTINGS.materialFilters);
		// Category filters will be repopulated by SettingsPanel (array is already cleared above)
	}

	/**
	 * Get count of active (non-default) material filters
	 */
	get activeFilterCount(): number {
		let count = 0;
		const mf = this._settings.materialFilters;

		// Non-default scoring method
		if (mf.scoringMethod !== 'max_yield') count++;

		// Scrappy filter
		if (mf.hideScrappyCollected) count++;

		// Rarity filters (not all selected)
		if (mf.rarityFilters.length !== 5) count++;

		// Category filters (not all selected)
		if (
			this.availableCategoriesCount > 0 &&
			mf.categoryFilters.length !== this.availableCategoriesCount
		) {
			count++;
		}

		// Type filters (not all selected)
		if (
			this.availableTypesCount > 0 &&
			mf.typeFilters.length !== this.availableTypesCount
		) {
			count++;
		}

		// Value filter (active if enabled)
		if (mf.maxSourceValueEnabled) count++;

		return count;
	}

	// === SOURCE FILTERS API ===

	/**
	 * Get hidden source items as a Set
	 */
	get hiddenSourceItems(): Set<string> {
		return new Set(this._settings.sourceFilters.hiddenSourceItems);
	}

	/**
	 * Check if an item is hidden from sources
	 */
	isSourceHidden(itemId: string): boolean {
		return this._settings.sourceFilters.hiddenSourceItems.includes(itemId);
	}

	/**
	 * Toggle source hidden state for an item
	 */
	toggleSourceHidden(itemId: string) {
		if (this.isSourceHidden(itemId)) {
			this._settings.sourceFilters.hiddenSourceItems =
				this._settings.sourceFilters.hiddenSourceItems.filter((id) => id !== itemId);
		} else {
			this._settings.sourceFilters.hiddenSourceItems = [
				...this._settings.sourceFilters.hiddenSourceItems,
				itemId
			];
		}
	}

	/**
	 * Clear all hidden source items
	 */
	clearHiddenSources() {
		this._settings.sourceFilters.hiddenSourceItems = [];
	}

	// === PERSISTENCE & EXPORT/IMPORT ===

	/**
	 * Load settings from localStorage with migration support
	 */
	private loadFromStorage() {
		try {
			// Try loading unified settings first
			const stored = localStorage.getItem('arcompanion-settings');
			if (stored) {
				const parsed = JSON.parse(stored) as SettingsState;

				// Version-based migration (future-proofing)
				if (parsed.version === 1) {
					this._settings = parsed;

					// Migrate missing maxSourceValueEnabled flag (added after v1)
					if (this._settings.materialFilters.maxSourceValueEnabled === undefined) {
						this._settings.materialFilters.maxSourceValueEnabled = false;
					}

					// Migrate missing typeFilters array (added after v1)
					if (this._settings.materialFilters.typeFilters === undefined) {
						this._settings.materialFilters.typeFilters = [];
					}

					// Migrate missing sourceFilters (added after v1)
					if (this._settings.sourceFilters === undefined) {
						this._settings.sourceFilters = { hiddenSourceItems: [] };
					}

					// Migrate missing pausedItems (added after v1)
					if (this._settings.bookmarks.pausedItems === undefined) {
						this._settings.bookmarks.pausedItems = [];
					}

					// Remove deprecated showSalvageOnly/showRecycleOnly properties
					const mf = this._settings.materialFilters as any;
					if (mf.showSalvageOnly !== undefined) {
						delete mf.showSalvageOnly;
					}
					if (mf.showRecycleOnly !== undefined) {
						delete mf.showRecycleOnly;
					}

					return;
				}
			}

			// No unified settings found, try migrating from old stores
			this.migrateFromOldStores();
		} catch (error) {
			console.error('Failed to load settings:', error);
		}
	}

	/**
	 * Migrate data from legacy localStorage keys
	 */
	private migrateFromOldStores() {
		let migrated = false;

		// Migrate bookmarks
		const oldBookmarks = localStorage.getItem('arcompanion-bookmarks');
		if (oldBookmarks) {
			try {
				const parsed = JSON.parse(oldBookmarks);
				if (Array.isArray(parsed)) {
					this._settings.bookmarks.bookmarkedItems = parsed;
					migrated = true;
				}
			} catch (e) {
				console.warn('Failed to migrate bookmarks:', e);
			}
		}

		// Migrate graph filters
		const oldGraphFilters = localStorage.getItem('arcompanion-graph-filters');
		if (oldGraphFilters) {
			try {
				const parsed = JSON.parse(oldGraphFilters);

				// Handle old array format (just rarities)
				if (Array.isArray(parsed)) {
					this._settings.graphFilters.hiddenRarities = parsed;
					migrated = true;
				}
				// Handle new object format
				else if (parsed.hiddenRarities !== undefined || parsed.hiddenTypes !== undefined) {
					this._settings.graphFilters = {
						hiddenRarities: parsed.hiddenRarities || [],
						hiddenTypes: parsed.hiddenTypes || []
					};
					migrated = true;
				}
			} catch (e) {
				console.warn('Failed to migrate graph filters:', e);
			}
		}

		// If we migrated any data, save to the new unified format
		if (migrated) {
			this.saveToStorage();
		}
	}

	/**
	 * Save settings to localStorage
	 */
	private saveToStorage() {
		try {
			localStorage.setItem('arcompanion-settings', JSON.stringify(this._settings));
		} catch (error) {
			console.error('Failed to save settings:', error);
		}
	}

	/**
	 * Debounced save to avoid excessive localStorage writes
	 */
	private debouncedSave() {
		if (this.saveTimer) {
			clearTimeout(this.saveTimer);
		}
		this.saveTimer = setTimeout(() => {
			this.saveToStorage();
			this.saveTimer = null;
		}, 100);
	}

	/**
	 * Validate item IDs against database
	 */
	private validateItemIds(itemIds: string[]): Set<string> {
		if (db.status !== 'ready') {
			console.warn('[Settings] Database not ready, skipping bookmark validation');
			return new Set();
		}
		if (itemIds.length === 0) return new Set();

		try {
			const placeholders = itemIds.map(() => '?').join(',');
			const existingItems = db.query<{ id: string }>(
				`SELECT id FROM items WHERE id IN (${placeholders})`,
				itemIds
			);
			return new Set(existingItems.map((item) => item.id));
		} catch (error) {
			console.error('[Settings] Failed to validate item IDs:', error);
			return new Set();
		}
	}

	/**
	 * Export settings as JSON string
	 */
	exportSettings(): string {
		return JSON.stringify(this._settings, null, 2);
	}

	/**
	 * Import settings from JSON string with validation
	 * @param json JSON string to import
	 * @param validateBookmarks Whether to validate bookmarked item IDs against database
	 * @returns Result object with success status and details
	 */
	importSettings(
		json: string,
		validateBookmarks = false
	): {
		success: boolean;
		message?: string;
		validatedCount?: number;
		invalidCount?: number;
	} {
		try {
			const parsed = JSON.parse(json) as SettingsState;

			// Validate structure
			if (parsed.version !== 1) {
				return {
					success: false,
					message: 'Invalid settings format: unsupported version'
				};
			}

			if (!parsed.bookmarks || !parsed.graphFilters || !parsed.materialFilters) {
				return {
					success: false,
					message: 'Invalid settings format: missing required sections'
				};
			}

			// Validate and filter bookmarked items if requested
			let validatedCount = 0;
			let invalidCount = 0;

			if (validateBookmarks && parsed.bookmarks.bookmarkedItems.length > 0) {
				const bookmarkedItems = parsed.bookmarks.bookmarkedItems;
				const validItems = this.validateItemIds(bookmarkedItems);

				validatedCount = validItems.size;
				invalidCount = bookmarkedItems.length - validItems.size;

				// Filter out invalid items
				parsed.bookmarks.bookmarkedItems = Array.from(validItems);
			}

			// Ensure sourceFilters exists (for backwards compatibility)
			if (!parsed.sourceFilters) {
				parsed.sourceFilters = { hiddenSourceItems: [] };
			}

			// Apply settings - create completely new object to force reactivity
			const newSettings: SettingsState = {
				version: parsed.version,
				bookmarks: {
				bookmarkedItems: [...parsed.bookmarks.bookmarkedItems],
				pausedItems: [...(parsed.bookmarks.pausedItems || [])]
			},
				graphFilters: {
					hiddenRarities: [...parsed.graphFilters.hiddenRarities],
					hiddenTypes: [...parsed.graphFilters.hiddenTypes]
				},
				materialFilters: {
					scoringMethod: parsed.materialFilters.scoringMethod,
					hideScrappyCollected: parsed.materialFilters.hideScrappyCollected,
					rarityFilters: [...parsed.materialFilters.rarityFilters],
					categoryFilters: [...parsed.materialFilters.categoryFilters],
					typeFilters: [...parsed.materialFilters.typeFilters],
					maxSourceValueEnabled: parsed.materialFilters.maxSourceValueEnabled,
					maxSourceValue: parsed.materialFilters.maxSourceValue
				},
				sourceFilters: {
					hiddenSourceItems: [...parsed.sourceFilters.hiddenSourceItems]
				}
			};

			this._settings = newSettings;
			this.saveToStorage();

			return {
				success: true,
				validatedCount,
				invalidCount
			};
		} catch (error) {
			if (error instanceof SyntaxError) {
				return {
					success: false,
					message: 'Invalid JSON format'
				};
			}

			console.error('Failed to import settings:', error);
			return {
				success: false,
				message: 'Failed to read file'
			};
		}
	}

	/**
	 * Reset all settings to defaults
	 */
	resetAllSettings() {
		this._settings = structuredClone(DEFAULT_SETTINGS);
		this.saveToStorage();
	}
}

export const settings = new SettingsStore();
