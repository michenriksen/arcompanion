<script lang="ts">
	interface EffectsData {
		[key: string]: string;
	}

	interface ItemEffectsProps {
		effects: string | null;
		class?: string;
	}

	let { effects, class: className }: ItemEffectsProps = $props();

	const parsedEffects = $derived.by(() => {
		if (!effects) return null;

		try {
			const data = JSON.parse(effects) as EffectsData;
			return Object.entries(data).map(([key, value]) => ({
				name: key,
				value: value
			}));
		} catch {
			return null;
		}
	});

	// Determine if effect is positive or negative based on common patterns
	function getEffectType(name: string): 'positive' | 'negative' | 'neutral' {
		const lowerName = name.toLowerCase();

		// Negative effects
		if (lowerName.includes('reduced') ||
		    lowerName.includes('decrease') ||
		    lowerName.includes('slower') ||
		    lowerName.includes('penalty')) {
			return 'negative';
		}

		// Positive effects
		if (lowerName.includes('increased') ||
		    lowerName.includes('bonus') ||
		    lowerName.includes('healing') ||
		    lowerName.includes('regeneration') ||
		    lowerName.includes('damage') ||
		    lowerName.includes('faster')) {
			return 'positive';
		}

		return 'neutral';
	}
</script>

{#if parsedEffects && parsedEffects.length > 0}
	<div class={className}>
		<dl class="space-y-1.5">
			{#each parsedEffects as effect}
				{@const effectType = getEffectType(effect.name)}
				<div class="flex justify-between items-baseline text-sm gap-2">
					<dt class="text-muted-foreground">{effect.name}</dt>
					<dd
						class="font-medium tabular-nums"
						class:text-green-600={effectType === 'positive'}
						class:dark:text-green-400={effectType === 'positive'}
						class:text-red-600={effectType === 'negative'}
						class:dark:text-red-400={effectType === 'negative'}
					>
						{effect.value}
					</dd>
				</div>
			{/each}
		</dl>
	</div>
{/if}
