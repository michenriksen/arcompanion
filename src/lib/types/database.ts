// Database types extracted from sql.js
export type SqlValue = number | string | Uint8Array | null;

export interface Item {
	id: string;
	name: string;
	description: string;
	type: string;
	rarity: string;
	value: number;
	weight_kg: number;
	stack_size: number | null;
	found_in: string | null; // DEPRECATED: Use item_category_links table
	is_weapon: number;
	blueprint_locked: number;
	is_craftable: number;
	effects: string | null;
	image_name: string;
	updated_at: string;
}

export interface CraftingRecipe {
	item_id: string;
	ingredient_id: string;
	quantity: number;
}

export interface CraftingBench {
	item_id: string;
	bench_type: string;
	station_level: number;
}

export interface RecyclingOutput {
	item_id: string;
	output_id: string;
	quantity: number;
}

export interface SalvagingOutput {
	item_id: string;
	output_id: string;
	quantity: number;
}

export interface ItemWithQuantity extends Item {
	quantity: number;
}

export interface ItemCategory {
	id: string;
	display_name: string;
}

export interface ItemCategoryLink {
	item_id: string;
	category_id: string;
}

// Database status types
export type DatabaseStatus = 'loading' | 'ready' | 'error';

export interface DatabaseError {
	message: string;
	cause?: unknown;
}
