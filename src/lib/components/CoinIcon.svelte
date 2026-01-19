<script lang="ts">
	interface Props {
		class?: string;
		size?: number;
	}

	let { class: className = '', size = 16 }: Props = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 16 16"
	fill="none"
	xmlns="http://www.w3.org/2000/svg"
	class={className}
	aria-hidden="true"
>
	<!-- Outer circle -->
	<circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5" fill="none" />
	<!-- Left vertical line -->
	<line x1="6" y1="0.5" x2="6" y2="15.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
	<!-- Right vertical line -->
	<line x1="10" y1="0.5" x2="10" y2="15.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
</svg>
