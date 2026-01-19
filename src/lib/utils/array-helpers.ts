/**
 * Toggle item in array (add if missing, remove if present)
 */
export function toggleInArray<T>(
	arr: T[],
	item: T,
	predicate: (a: T, b: T) => boolean = (a, b) => a === b
): T[] {
	const index = arr.findIndex((i) => predicate(i, item));
	if (index >= 0) {
		return arr.filter((_, i) => i !== index);
	}
	return [...arr, item];
}

/**
 * Check if item exists in array
 */
export function includesItem<T>(
	arr: T[],
	item: T,
	predicate: (a: T, b: T) => boolean = (a, b) => a === b
): boolean {
	return arr.findIndex((i) => predicate(i, item)) >= 0;
}
