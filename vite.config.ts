import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		viteStaticCopy({
			targets: [
				{
					src: 'node_modules/sql.js/dist/sql-wasm.wasm',
					dest: 'sql-wasm'
				}
			]
		})
	]
});
