import { browser } from '$app/environment';
import MiniSearch from 'minisearch';
import { db } from './database.svelte';
import type { Item } from '$lib/types/database';

export type SearchStatus = 'loading' | 'ready' | 'error';

export interface SearchResult {
	id: string;
	name: string;
	type: string;
	rarity: string;
	is_craftable: number;
	image_name: string;
	score: number;
}

export interface SearchError {
	message: string;
	cause?: unknown;
}

class SearchStore {
	status = $state<SearchStatus>('loading');
	error = $state<SearchError | null>(null);

	private miniSearch: MiniSearch<Item> | null = null;

	constructor() {
		if (browser) {
			// Watch database status reactively
			$effect.root(() => {
				$effect(() => {
					if (db.status === 'ready') {
						this.buildIndex();
					} else if (db.status === 'error') {
						this.status = 'error';
						this.error = {
							message: 'Database failed to load',
							cause: db.error
						};
					}
				});
			});
		}
	}

	private buildIndex() {
		try {
			const startTime = performance.now();

			// Fetch all items from database
			const items = db.query<Item>('SELECT * FROM items');

			// Configure MiniSearch
			this.miniSearch = new MiniSearch<Item>({
				fields: ['name'],
				storeFields: ['id', 'name', 'type', 'rarity', 'is_craftable', 'image_name'],
				searchOptions: {
					fuzzy: 0.2,
					prefix: true,
					combineWith: 'AND'
				}
			});

			// Add all items to index
			this.miniSearch.addAll(items);

			const duration = (performance.now() - startTime).toFixed(2);
			console.log(`[Search] Indexed ${items.length} items in ${duration}ms`);

			this.status = 'ready';
		} catch (err) {
			console.error('[Search] Index build failed:', err);
			this.status = 'error';
			this.error = {
				message: err instanceof Error ? err.message : String(err),
				cause: err
			};
		}
	}

	/**
	 * Search for items matching the query
	 */
	search(query: string, options?: { limit?: number }): SearchResult[] {
		if (!this.miniSearch) {
			return [];
		}

		const limit = options?.limit ?? 50;

		try {
			const results = this.miniSearch.search(query, {
				fuzzy: 0.2,
				prefix: true,
				combineWith: 'AND'
			});

			// Convert results and sort by score (primary) and name length (secondary)
			const mappedResults = results.map((result) => ({
				...(result as unknown as Omit<SearchResult, 'score'>),
				score: result.score
			}));

			// Sort by score (descending), then by name length (ascending) for similar scores
			mappedResults.sort((a, b) => {
				// If scores are very close (within 0.1), sort by name length
				if (Math.abs(a.score - b.score) < 0.1) {
					return a.name.length - b.name.length;
				}
				return b.score - a.score;
			});

			return mappedResults.slice(0, limit);
		} catch (err) {
			console.error('[Search] Query failed:', err);
			return [];
		}
	}
}

// Export singleton instance
export const search = new SearchStore();
