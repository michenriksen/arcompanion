<script lang="ts">
	import { aboutDialog } from '$lib/stores/about-dialog.svelte';
	import * as Dialog from '$lib/components/ui/dialog';
	import ExternalLink from '@lucide/svelte/icons/external-link';
</script>

<Dialog.Root bind:open={aboutDialog.open}>
	<Dialog.Content class="max-w-2xl max-h-[80vh] overflow-y-auto border-[var(--arc-cyan)]/40">
		<Dialog.Header>
			<Dialog.Title class="gradient-text-arc">About ARCompanion</Dialog.Title>
			<Dialog.Description>
				ARCompanion helps you focus on the crafting materials you need for your favorite equipment
				and what to salvage and recycle to get them. Bookmark your desired items and see all the
				materials you need in one place, with clear visual priorities showing you which items to
				salvage or recycle for the best yield.
			</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-6">
			<!-- Getting Started -->
			<section class="space-y-3">
				<h3 class="section-header">
					Getting Started
				</h3>
				<ul class="list-disc list-inside space-y-2 text-sm text-muted-foreground">
					<li>
						Search and bookmark equipment to track
						<kbd
							class="inline-flex pointer-events-none select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground ml-1"
						>
							<span class="text-xs">⌘</span>K
						</kbd>
					</li>
					<li>
						See required crafting materials and what to salvage or recycle
					</li>
					<li>Filter and refine with the Settings panel</li>
					<li>Click items for more details</li>
				</ul>
			</section>

			<!-- How Scoring Works -->
			<section class="space-y-3">
				<h3 class="section-header">
					How Scoring Works
				</h3>
				<div class="space-y-3 text-sm text-muted-foreground">
					<p>
						ARCompanion calculates two separate scores for each item: a salvage score and a
						recycle score. Both scores evaluate how well an item provides the materials you need,
						considering practical factors like weight, stack size, and effort required.
					</p>
					<p>
						The salvage score prioritizes items good for immediate salvaging. It favors
						lightweight items that yield materials you need most, with a bonus for the immediacy
						of salvaging. Common items typically score higher for salvaging.
					</p>
					<p>
						The recycle score evaluates items worth carrying to recycle. It rewards items that
						provide multiple different materials and considers the trade-off between extra effort
						and yield. Rare items typically score higher for recycling due to diverse outputs.
					</p>
					<p>
						Items go to the Recycle section if the recycle score is more than 2x higher than the
						salvage score. Otherwise, they go to Salvage. This threshold ensures you only recycle
						when it's significantly worth the extra effort of carrying items out and finding a
						recycler.
					</p>
					<p>
						Both scores factor in slot efficiency—items that stack well and produce materials that
						stack well score higher. Use Maximum Yield mode to prioritize quantity, or Weight
						Conscious mode to favor lightweight items.
					</p>
				</div>
			</section>

			<!-- Data & Attribution -->
			<section class="space-y-3">
				<h3 class="section-header">
					Data & Attribution
				</h3>
				<div class="space-y-2 text-sm">
					<div class="flex items-center gap-2">
						<span class="text-muted-foreground">Item Data:</span>
						<a
							href="https://github.com/RaidTheory/arcraiders-data"
							target="_blank"
							rel="noopener noreferrer"
							class="flex items-center gap-1 text-[var(--arc-cyan)] hover:underline"
						>
							RaidTheory/arcraiders-data
							<ExternalLink class="size-3" />
						</a>
					</div>
					<div class="flex items-center gap-2">
						<span class="text-muted-foreground">Item Icons:</span>
						<a
							href="https://arc-raiders.fandom.com/wiki/Arc_Raiders_Wiki"
							target="_blank"
							rel="noopener noreferrer"
							class="flex items-center gap-1 text-[var(--arc-cyan)] hover:underline"
						>
							Arc Raiders Wiki
							<ExternalLink class="size-3" />
						</a>
					</div>
				</div>
			</section>
		</div>
	</Dialog.Content>
</Dialog.Root>
