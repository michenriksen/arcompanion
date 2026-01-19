/**
 * Parses item JSON data from ARC Raiders repository
 */

/**
 * Parse an item JSON file and extract relevant data
 * @param {Object} jsonData - Raw JSON data from item file
 * @returns {Object} Parsed item data with English text and relational data
 */
export function parseItem(jsonData) {
	if (!jsonData.id || !jsonData.name || !jsonData.type) {
		throw new Error('Invalid item data: missing required fields (id, name, or type)');
	}

	// Parse recipe from 'recipe', 'craftingRequirement', or 'upgradeCost' field
	let recipe = {};
	let craft_bench = [];
	let station_level = 1;

	if (jsonData.recipe) {
		// Old format: recipe is a simple object { ingredient_id: quantity }
		recipe = jsonData.recipe;
		craft_bench = Array.isArray(jsonData.craftBench)
			? jsonData.craftBench
			: jsonData.craftBench
				? [jsonData.craftBench]
				: [];
		station_level = jsonData.stationLevelRequired || 1;
	} else if (jsonData.craftingRequirement?.requiredItems) {
		// New format: craftingRequirement.requiredItems is an array
		// Convert array format to object format: [{ id: "foo", amount: 5 }] -> { foo: 5 }
		for (const item of jsonData.craftingRequirement.requiredItems) {
			recipe[item.id] = item.amount;
		}
		// Extract station info if present
		if (jsonData.craftingRequirement.station) {
			craft_bench = [jsonData.craftingRequirement.station.id];
			station_level = jsonData.craftingRequirement.station.tier || 1;
		}
	} else if (jsonData.upgradeCost) {
		// Upgrade format: upgradeCost is a simple object like recipe
		// Used for tier 2+ weapons that upgrade from previous tier
		recipe = jsonData.upgradeCost;
	}

	// Extract image filename from CDN URL
	let image_name = `${jsonData.id}.png`; // Default fallback
	if (jsonData.imageFilename) {
		// Extract filename from URL: "https://cdn.arctracker.io/items/foo.png" → "foo.png"
		const match = jsonData.imageFilename.match(/\/([^\/]+\.png)$/);
		if (match) {
			image_name = match[1];
		}
	}

	return {
		id: jsonData.id,
		name: jsonData.name?.en || jsonData.name,
		description: jsonData.description?.en || jsonData.description || '',
		type: jsonData.type,
		rarity: jsonData.rarity || 'Common',
		value: jsonData.value || 0,
		weight_kg: jsonData.weightKg || 0,
		stack_size: jsonData.stackSize || null,
		found_in: jsonData.foundIn || null,
		is_weapon: jsonData.isWeapon ? 1 : 0,
		blueprint_locked: jsonData.blueprintLocked ? 1 : 0,
		effects: jsonData.effects ? JSON.stringify(cleanEffects(jsonData.effects)) : null,
		image_name: image_name,
		updated_at: jsonData.updatedAt || new Date().toLocaleDateString('en-US'),

		// Relational data (processed separately)
		recipe: recipe,
		craft_bench: craft_bench,
		station_level: station_level,
		recycles_into: jsonData.recyclesInto || {},
		salvages_into: jsonData.salvagesInto || {},
		categories: [] // Will be populated by extractCategories
	};
}

/**
 * Extract crafting recipe entries from item data
 * @param {Object} itemData - Parsed item data
 * @returns {Array} Array of {item_id, ingredient_id, quantity}
 */
export function extractRecipes(itemData) {
	const recipes = [];
	for (const [ingredientId, quantity] of Object.entries(itemData.recipe)) {
		recipes.push({
			item_id: itemData.id,
			ingredient_id: ingredientId,
			quantity: quantity
		});
	}
	return recipes;
}

/**
 * Extract crafting bench entries from item data
 * @param {Object} itemData - Parsed item data
 * @returns {Array} Array of {item_id, bench_type, station_level}
 */
export function extractBenches(itemData) {
	return itemData.craft_bench.map((benchType) => ({
		item_id: itemData.id,
		bench_type: benchType,
		station_level: itemData.station_level
	}));
}

/**
 * Extract recycling output entries from item data
 * @param {Object} itemData - Parsed item data
 * @returns {Array} Array of {item_id, output_id, quantity}
 */
export function extractRecycling(itemData) {
	const outputs = [];
	for (const [outputId, quantity] of Object.entries(itemData.recycles_into)) {
		outputs.push({
			item_id: itemData.id,
			output_id: outputId,
			quantity: quantity
		});
	}
	return outputs;
}

/**
 * Extract salvaging output entries from item data
 * @param {Object} itemData - Parsed item data
 * @returns {Array} Array of {item_id, output_id, quantity}
 */
export function extractSalvaging(itemData) {
	const outputs = [];
	for (const [outputId, quantity] of Object.entries(itemData.salvages_into)) {
		outputs.push({
			item_id: itemData.id,
			output_id: outputId,
			quantity: quantity
		});
	}
	return outputs;
}

/**
 * Clean effects JSON by extracting values
 * @param {Object} effects - Raw effects object with translations
 * @returns {Object} Cleaned effects with simple key-value pairs
 */
export function cleanEffects(effects) {
	if (!effects || typeof effects !== 'object') {
		return null;
	}

	const cleaned = {};

	for (const [effectName, effectData] of Object.entries(effects)) {
		if (effectData && typeof effectData === 'object') {
			// Extract just the value, use effect name as key
			cleaned[effectName] = effectData.value || '';
		}
	}

	return Object.keys(cleaned).length > 0 ? cleaned : null;
}

/**
 * Extract category names from found_in field
 * @param {Object} itemData - Parsed item data
 * @returns {Array<string>} Array of category names
 */
export function extractCategories(itemData) {
	if (!itemData.found_in) {
		return [];
	}

	return itemData.found_in
		.split(',')
		.map(cat => cat.trim())
		.filter(cat => cat.length > 0);
}
