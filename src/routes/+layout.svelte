<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import AppBar from '$lib/components/AppBar.svelte';
	import ItemDetailsDrawer from '$lib/components/ItemDetailsDrawer.svelte';
	import AboutDialog from '$lib/components/AboutDialog.svelte';
	import Github from '@lucide/svelte/icons/github';

	let { children } = $props();
</script>

<svelte:head>
	<title>ARCompanion</title>
	<link rel="icon" href={favicon} />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Barlow+Semi+Condensed:wght@600;700;800&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<div class="h-screen flex flex-col overflow-hidden">
	<AppBar />
	<div class="flex-1 overflow-auto">
		<main class="pb-8">
			{@render children()}
		</main>
		<footer class="mt-12 border-t border-border bg-muted/30 py-4 px-6 text-xs text-muted-foreground">
			<div class="container mx-auto flex flex-col sm:flex-row justify-between items-center gap-3">
				<p class="text-center sm:text-left">
					ARCompanion is not affiliated with Embark Studios. All trademarks and copyrighted materials are the
					property of their respective owners.
				</p>
				<div class="flex items-center gap-3">
					<p>
						created by <a
							href="https://michenriksen.com/"
							target="_blank"
							class="underline hover:text-foreground transition-colors">Michael Henriksen</a
						>
					</p>
					<a
						href="https://github.com/michenriksen/arcompanion"
						target="_blank"
						rel="noopener noreferrer"
						class="inline-flex items-center hover:text-foreground transition-colors"
						aria-label="View source code on GitHub"
					>
						<Github size={16} />
					</a>
				</div>
			</div>
		</footer>
	</div>
</div>

<ItemDetailsDrawer />
<AboutDialog />
