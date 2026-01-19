<script lang="ts">
	import SearchCommand from './SearchCommand.svelte';
	import SettingsPanel from './SettingsPanel.svelte';
	import { settings } from '$lib/stores/settings.svelte';
	import { searchDialog } from '$lib/stores/search-dialog.svelte';
	import { aboutDialog } from '$lib/stores/about-dialog.svelte';
	import Search from '@lucide/svelte/icons/search';
	import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
	import Info from '@lucide/svelte/icons/info';

	// Handle Ctrl/Cmd+K keyboard shortcut
	$effect(() => {
		function handleKeydown(e: KeyboardEvent) {
			if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
				e.preventDefault();
				searchDialog.openDialog();
			}
		}

		document.addEventListener('keydown', handleKeydown);
		return () => document.removeEventListener('keydown', handleKeydown);
	});
</script>

<header class="sticky top-0 z-50 w-full border-b border-[var(--arc-cyan)]/30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60" data-test-id="app-bar">
	<div class="flex h-16 w-full items-center justify-between px-4 gap-3">
		<h1 class="heading-md gradient-text-arc flex items-center gap-2">
			<span class="inline-block w-1 h-6 bg-gradient-to-b from-[var(--arc-cyan)] to-[var(--arc-amber)] rounded-full"></span>
			ARCompanion
			<span class="relative -top-1 -left-1 px-2 py-0.5 text-xs font-bold bg-[var(--arc-amber)] rounded-sm" style="-webkit-text-fill-color: var(--arc-dark); color: var(--arc-dark);">BETA</span>
		</h1>

		<div class="flex items-center gap-3">
			<button
				onclick={() => searchDialog.openDialog()}
				class="flex items-center gap-2 w-64 md:w-72 px-4 py-2.5 rounded-lg border-2 border-[var(--arc-cyan)]/40 bg-card/50 cursor-pointer text-sm text-muted-foreground hover:border-[var(--arc-cyan)] hover:bg-[var(--arc-cyan)]/10 hover:text-[var(--arc-cyan)] transition-all"
				aria-label="Search craftable items"
				aria-keyshortcuts="Control+K"
				data-test-id="search-button"
			>
				<Search class="size-5 shrink-0" />
				<span class="flex-1 text-left font-medium">Search items...</span>
				<kbd class="hidden md:inline-flex pointer-events-none select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
					<span class="text-xs">⌘</span>K
				</kbd>
			</button>

			<button
				onclick={() => settings.openPanel()}
				class="relative flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-[var(--arc-cyan)]/40 bg-card/50 cursor-pointer text-sm text-muted-foreground hover:border-[var(--arc-cyan)] hover:bg-[var(--arc-cyan)]/10 hover:text-[var(--arc-cyan)] transition-all"
				aria-label="Open settings panel"
				data-test-id="settings-button"
			>
				<SlidersHorizontal class="size-5" />
				<span class="hidden sm:inline font-medium">Settings</span>
				{#if settings.activeFilterCount > 0}
					<span
						class="absolute -top-1 -right-1 flex items-center justify-center size-5 rounded-full bg-[var(--arc-amber)] text-[var(--arc-dark)] text-xs font-bold"
						data-test-id="settings-filter-badge"
					>
						{settings.activeFilterCount}
					</span>
				{/if}
			</button>

			<button
				onclick={() => aboutDialog.openDialog()}
				class="flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-[var(--arc-cyan)]/40 bg-card/50 cursor-pointer text-sm text-muted-foreground hover:border-[var(--arc-cyan)] hover:bg-[var(--arc-cyan)]/10 hover:text-[var(--arc-cyan)] transition-all"
				aria-label="About ARCompanion"
				data-test-id="about-button"
			>
				<Info class="size-5" />
				<span class="hidden sm:inline font-medium">About</span>
			</button>
		</div>
	</div>
</header>

<SearchCommand bind:open={searchDialog.open} />
<SettingsPanel />
