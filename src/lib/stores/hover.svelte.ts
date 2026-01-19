import { db } from './database.svelte';
import { settings } from './settings.svelte';
import type { CraftingRecipe } from '$lib/types/database';

class HoverStore {
	// Core hover state (only one can be active at a time)
	private hoveredBookmarkId = $state<string | null>(null);
	private hoveredMaterialId = $state<string | null>(null);
	private hoveredSourceId = $state<string | null>(null);
	private hoveredSourceType = $state<'salvage' | 'recycle' | null>(null);

	// Helper to check if any hover is active
	get hasAnyHover(): boolean {
		return (
			this.hoveredBookmarkId !== null ||
			this.hoveredMaterialId !== null ||
			this.hoveredSourceId !== null
		);
	}

	// Derived: Set of materials to highlight
	highlightedMaterials = $derived.by(() => {
		const set = new Set<string>();

		// Bookmark hover: show required crafting materials
		if (this.hoveredBookmarkId && db.status === 'ready') {
			const recipes = db.query<CraftingRecipe>(
				'SELECT ingredient_id FROM crafting_recipes WHERE item_id = ?',
				[this.hoveredBookmarkId]
			);
			recipes.forEach((r) => set.add(r.ingredient_id));
		}

		// Material hover: highlight self
		if (this.hoveredMaterialId) {
			set.add(this.hoveredMaterialId);
		}

		// Source hover: show materials it yields
		if (this.hoveredSourceId && this.hoveredSourceType && settings.aggregatedData) {
			const sourceList =
				this.hoveredSourceType === 'salvage'
					? settings.aggregatedData.salvageSources
					: settings.aggregatedData.recycleSources;

			const source = sourceList.find((s) => s.item.id === this.hoveredSourceId);
			if (source) {
				const yields =
					this.hoveredSourceType === 'salvage' ? source.salvageYields : source.recycleYields;
				yields.forEach((_, materialId) => set.add(materialId));
			}
		}

		return set;
	});

	// Derived: Set of sources to highlight
	highlightedSources = $derived.by(() => {
		const set = new Set<string>();

		// Bookmark hover: show sources that provide required materials
		if (this.hoveredBookmarkId && db.status === 'ready' && settings.aggregatedData) {
			const recipes = db.query<CraftingRecipe>(
				'SELECT ingredient_id FROM crafting_recipes WHERE item_id = ?',
				[this.hoveredBookmarkId]
			);

			recipes.forEach((recipe) => {
				const sourceIds = settings.aggregatedData?.materialToSources.get(recipe.ingredient_id);
				sourceIds?.forEach((id) => set.add(id));
			});
		}

		// Material hover: show sources that provide it
		if (this.hoveredMaterialId && settings.aggregatedData) {
			const sourceIds = settings.aggregatedData.materialToSources.get(this.hoveredMaterialId);
			sourceIds?.forEach((id) => set.add(id));
		}

		// Source hover: highlight self
		if (this.hoveredSourceId) {
			set.add(this.hoveredSourceId);
		}

		return set;
	});

	// Derived: Set of bookmarks to highlight (for future use)
	highlightedBookmarks = $derived.by(() => {
		const set = new Set<string>();

		// Material hover: show bookmarks that require it
		if (this.hoveredMaterialId && settings.aggregatedData) {
			const material = settings.aggregatedData.materials.find(
				(m) => m.item.id === this.hoveredMaterialId
			);
			material?.requiredBy.forEach((id) => set.add(id));
		}

		// Bookmark hover: highlight self
		if (this.hoveredBookmarkId) {
			set.add(this.hoveredBookmarkId);
		}

		return set;
	});

	// Public API - only one hover type can be active at a time
	setHoveredBookmark(itemId: string | null) {
		this.hoveredBookmarkId = itemId;
		this.hoveredMaterialId = null;
		this.hoveredSourceId = null;
		this.hoveredSourceType = null;
	}

	setHoveredMaterial(materialId: string | null) {
		this.hoveredMaterialId = materialId;
		this.hoveredBookmarkId = null;
		this.hoveredSourceId = null;
		this.hoveredSourceType = null;
	}

	setHoveredSource(sourceId: string | null, type: 'salvage' | 'recycle') {
		this.hoveredSourceId = sourceId;
		this.hoveredSourceType = sourceId ? type : null;
		this.hoveredBookmarkId = null;
		this.hoveredMaterialId = null;
	}

	clearAll() {
		this.hoveredBookmarkId = null;
		this.hoveredMaterialId = null;
		this.hoveredSourceId = null;
		this.hoveredSourceType = null;
	}
}

export const hoverStore = new HoverStore();
