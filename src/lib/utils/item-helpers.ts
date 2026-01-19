/**
 * Strip tier suffix (e.g., _i, _ii, _iii, _iv) from item ID.
 *
 * @param id - The item ID that may contain a tier suffix
 * @returns The base item ID without tier suffix
 *
 * @example
 * stripTierSuffix('anvil_i') // Returns 'anvil'
 * stripTierSuffix('anvil_iii') // Returns 'anvil'
 * stripTierSuffix('battery') // Returns 'battery'
 */
export function stripTierSuffix(id: string): string {
	const match = id.match(/^(.+)_(i|ii|iii|iv|v|vi|vii|viii|ix|x)$/);
	return match ? match[1] : id;
}

/**
 * Get the image path for an item, handling tier suffixes.
 * Items with tier suffixes (e.g., anvil_i, anvil_ii) use the base image (anvil.png).
 *
 * @param itemId - The item ID
 * @param base - The base path from SvelteKit (default: '')
 * @returns The path to the item's image
 *
 * @example
 * getItemImagePath('anvil_i') // Returns '/images/items/anvil.png'
 * getItemImagePath('battery') // Returns '/images/items/battery.png'
 */
export function getItemImagePath(itemId: string, base: string = ''): string {
	return `${base}/images/items/${stripTierSuffix(itemId)}.png`;
}
