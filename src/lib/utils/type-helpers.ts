export type ItemType =
	| 'Ammunition'
	| 'Assault Rifle'
	| 'Augment'
	| 'Backpack Charm'
	| 'Basic Material'
	| 'Battle Rifle'
	| 'Blueprint'
	| 'Cosmetic'
	| 'Hand Cannon'
	| 'Key'
	| 'LMG'
	| 'Misc'
	| 'Modification'
	| 'Nature'
	| 'Outfit'
	| 'Pistol'
	| 'Quick Use'
	| 'Recyclable'
	| 'Refined Material'
	| 'SMG'
	| 'Shield'
	| 'Shotgun'
	| 'Sniper Rifle'
	| 'Special'
	| 'Topside Material'
	| 'Trinket';

// Commonly filtered types (weapons, mods, etc.)
export const WEAPON_TYPES: readonly ItemType[] = [
	'Assault Rifle',
	'Battle Rifle',
	'Hand Cannon',
	'LMG',
	'Pistol',
	'SMG',
	'Shotgun',
	'Sniper Rifle'
] as const;

export const COMMON_FILTER_TYPES: readonly ItemType[] = [
	'Ammunition',
	'Assault Rifle',
	'Augment',
	'Battle Rifle',
	'Hand Cannon',
	'LMG',
	'Modification',
	'Pistol',
	'Quick Use',
	'Shield',
	'Shotgun',
	'SMG',
	'Sniper Rifle'
] as const;

export const ALL_TYPES: readonly ItemType[] = [
	'Ammunition',
	'Assault Rifle',
	'Augment',
	'Backpack Charm',
	'Basic Material',
	'Battle Rifle',
	'Blueprint',
	'Cosmetic',
	'Hand Cannon',
	'Key',
	'LMG',
	'Misc',
	'Modification',
	'Nature',
	'Outfit',
	'Pistol',
	'Quick Use',
	'Recyclable',
	'Refined Material',
	'SMG',
	'Shield',
	'Shotgun',
	'Sniper Rifle',
	'Special',
	'Topside Material',
	'Trinket'
] as const;
