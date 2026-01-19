import { browser } from '$app/environment';
import { base } from '$app/paths';
import initSqlJs, { type Database } from 'sql.js';
import type { DatabaseStatus, DatabaseError, SqlValue } from '$lib/types/database';

class DatabaseStore {
	status = $state<DatabaseStatus>('loading');
	error = $state<DatabaseError | null>(null);

	private db: Database | null = null;

	constructor() {
		// Only initialize in browser environment
		if (browser) {
			this.initialize();
		}
	}

	private async initialize() {
		try {
			// Load sql.js WASM
			const SQL = await initSqlJs({
				// Point to WASM file in static directory
				locateFile: (file) => `${base}/sql-wasm/${file}`
			});

			// Fetch database file
			const response = await fetch(`${base}/data/items.db`);
			if (!response.ok) {
				throw new Error(`Failed to load database: ${response.statusText}`);
			}

			const arrayBuffer = await response.arrayBuffer();
			const uint8Array = new Uint8Array(arrayBuffer);

			// Create database instance
			this.db = new SQL.Database(uint8Array);

			this.status = 'ready';
		} catch (err) {
			console.error('[Database] Initialization failed:', err);
			this.status = 'error';
			this.error = {
				message: err instanceof Error ? err.message : String(err),
				cause: err
			};
		}
	}

	/**
	 * Convert sql.js result row to typed object
	 */
	private zipRowToObject<T>(columns: string[], values: SqlValue[]): T {
		return Object.fromEntries(columns.map((col, i) => [col, values[i]])) as T;
	}

	/**
	 * Execute query and return array of typed results
	 */
	query<T>(sql: string, params?: SqlValue[]): T[] {
		if (!this.db) {
			throw new Error('Database not initialized');
		}

		const results = this.db.exec(sql, params);

		// No results
		if (results.length === 0 || results[0].values.length === 0) {
			return [];
		}

		const { columns, values } = results[0];

		// Convert each row to typed object
		return values.map((row) => this.zipRowToObject(columns, row)) as T[];
	}

	/**
	 * Execute query expecting single result
	 */
	queryOne<T>(sql: string, params?: SqlValue[]): T | undefined {
		const results = this.query<T>(sql, params);
		return results[0];
	}

	/**
	 * Execute raw SQL and return sql.js results
	 */
	exec(sql: string, params?: SqlValue[]): Array<{ columns: string[]; values: SqlValue[][] }> {
		if (!this.db) {
			throw new Error('Database not initialized');
		}

		return this.db.exec(sql, params);
	}
}

// Export singleton instance
export const db = new DatabaseStore();
