export type Rarity = 'legendary' | 'epic' | 'rare' | 'uncommon' | 'common';

export const RARITIES: readonly Rarity[] = [
	'legendary',
	'epic',
	'rare',
	'uncommon',
	'common'
] as const;

export const RARITY_LABELS: Record<Rarity, string> = {
	legendary: 'Legendary',
	epic: 'Epic',
	rare: 'Rare',
	uncommon: 'Uncommon',
	common: 'Common'
};

export function getRarityColor(rarity: Rarity): string {
	return `var(--rarity-${rarity})`;
}

/**
 * Normalize rarity string to a valid rarity type.
 * Returns 'common' as safe fallback for invalid rarities.
 */
export function normalizeRarity(rarity: string): Rarity {
	const normalized = rarity.toLowerCase();
	if (RARITIES.includes(normalized as Rarity)) {
		return normalized as Rarity;
	}
	return 'common'; // Safe fallback
}
