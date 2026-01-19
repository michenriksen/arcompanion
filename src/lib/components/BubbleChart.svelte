<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import * as d3 from 'd3';
	import type { MaterialRequirement, SalvagingSource } from '$lib/types/materials';
	import BubbleChartTooltip from './BubbleChartTooltip.svelte';

	interface Props {
		items: MaterialRequirement[] | SalvagingSource[];
		getSize: (item: any) => number;
		getId: (item: any) => string;
		getImageName: (item: any) => string;
		getName: (item: any) => string;
		getRarity: (item: any) => string;
		onItemClick: (id: string) => void;
		onItemHover: (id: string | null) => void;
		isHighlighted: (id: string) => boolean;
		hoveredOther: boolean;
		tooltipType: 'material' | 'source';
	}

	let {
		items,
		getSize,
		getId,
		getImageName,
		getName,
		getRarity,
		onItemClick,
		onItemHover,
		isHighlighted,
		hoveredOther,
		tooltipType
	}: Props = $props();

	let container: HTMLDivElement;
	let svg: SVGSVGElement;
	let simulation: d3.Simulation<any, undefined> | null = null;
	let width = $state(800);
	let height = $state(400);
	let hoveredItem = $state<MaterialRequirement | SalvagingSource | null>(null);
	let mouseX = $state(0);
	let mouseY = $state(0);

	// Observe container size changes
	onMount(() => {
		const resizeObserver = new ResizeObserver((entries) => {
			for (const entry of entries) {
				width = entry.contentRect.width;
				height = entry.contentRect.height;
			}
		});

		if (container) {
			resizeObserver.observe(container);
		}

		return () => {
			resizeObserver.disconnect();
		};
	});

	// Memoize maxSize to avoid recomputation
	const maxItemSize = $derived(
		items.length > 0 ? Math.max(...items.map(item => getSize(item))) : 1
	);

	// Use D3's scaleSqrt for proper radius scaling based on container size
	const radiusScale = $derived.by(() => {
		if (items.length === 0 || width === 0 || height === 0) {
			return d3.scaleSqrt().domain([0, 1]).range([0, 10]);
		}

		const sizes = items.map(item => getSize(item));
		const maxSize = maxItemSize;
		const minSize = Math.min(...sizes);

		// Determine max radius based on container size and item count
		const containerSize = Math.min(width, height);
		const density = Math.sqrt(items.length);

		// Adaptive max radius with reduced sensitivity and fixed cap
		// Reduced density multiplier from 0.8 to 0.4 for less sensitivity
		const adaptiveMaxRadius = containerSize / (2 + density * 0.4);
		// Cap maximum radius at 80px to prevent bubbles from getting too large
		const maxRadius = Math.min(80, adaptiveMaxRadius);
		const minRadius = Math.max(32, maxRadius * 0.4); // Ensure minimum visibility

		return d3.scaleSqrt()
			.domain([minSize, maxSize])
			.range([minRadius, maxRadius]);
	});

	// Convert items to nodes with D3 force simulation data
	// Initialize larger items closer to center
	const nodes = $derived(items.map(item => {
		const size = getSize(item);
		const radius = radiusScale(size);

		// Larger items start closer to center
		const normalizedSize = size / maxItemSize;
		const spread = (1 - normalizedSize) * 200; // Inverse: larger = less spread

		return {
			id: getId(item),
			item,
			radius,
			size, // Keep original size for radial force
			x: width / 2 + (Math.random() - 0.5) * spread,
			y: height / 2 + (Math.random() - 0.5) * spread,
			vx: 0,
			vy: 0
		};
	}));

	$effect(() => {
		if (!svg || items.length === 0 || width === 0 || height === 0) return;

		// Clear previous simulation
		if (simulation) {
			simulation.stop();
		}

		const svgSelection = d3.select(svg);
		svgSelection.selectAll('*').remove();

		// Create container group
		const svgContainer = svgSelection.append('g');

		// Find max size for radial positioning
		const maxSize = Math.max(...nodes.map(d => d.size));
		const centerX = width / 2;
		const centerY = height / 2;

		// Create force simulation with parameters tuned for filling space
		simulation = d3.forceSimulation(nodes)
			.force('charge', d3.forceManyBody().strength(5))
			.force('collision', d3.forceCollide<any>()
				.radius(d => d.radius + 2)
				.strength(0.9)
				.iterations(3)
			)
			// Custom radial force: larger items toward center, smaller items outward
			.force('radial', d3.forceRadial<any>(
				(d) => {
					// Calculate target distance from center based on size
					// Larger items = closer to center (smaller radius)
					const normalizedSize = d.size / maxSize;
					const maxDistance = Math.min(width, height) * 0.4;
					return maxDistance * (1 - normalizedSize);
				},
				centerX,
				centerY
			).strength(0.8))
			.force('bounds', () => {
				// Keep nodes within bounds
				nodes.forEach(node => {
					const padding = node.radius;
					node.x = Math.max(padding, Math.min(width - padding, node.x ?? width / 2));
					node.y = Math.max(padding, Math.min(height - padding, node.y ?? height / 2));
				});
			})
			.alphaDecay(0.02)
			.velocityDecay(0.4)
			.stop(); // Stop automatic ticking

		// Pre-stabilize the simulation before rendering
		// Run enough ticks to settle the layout
		for (let i = 0; i < 300; i++) {
			simulation.tick();
		}

		// Create bubble groups with final positions
		const bubbles = svgContainer.selectAll('g.bubble')
			.data(nodes, (d: any) => d.id)
			.join('g')
			.attr('class', 'bubble')
			.attr('data-item-id', d => d.id)
			.attr('transform', d => `translate(${d.x},${d.y})`) // Set initial position to final
			.style('cursor', 'pointer')
			.on('click', (_event, d) => onItemClick(d.id))
			.on('mouseenter', (_event, d) => {
				onItemHover(d.id);
				hoveredItem = d.item;
			})
			.on('mouseleave', () => {
				onItemHover(null);
				hoveredItem = null;
			})
			.on('mousemove', (event) => {
				mouseX = event.clientX;
				mouseY = event.clientY;
			});

		// Add circles (invisible, only used for highlighting border)
		bubbles.append('circle')
			.attr('r', d => d.radius)
			.attr('fill', 'transparent')
			.attr('stroke', 'transparent')
			.attr('stroke-width', 3)
			.style('transition', 'all 0.2s');

		// Add images (icons without bubble backgrounds)
		bubbles.append('image')
			.attr('href', d => `${base}/images/items/${getImageName(d.item)}`)
			.attr('width', d => d.radius * 1.4)
			.attr('height', d => d.radius * 1.4)
			.attr('x', d => -d.radius * 0.7)
			.attr('y', d => -d.radius * 0.7)
			.style('pointer-events', 'none')
			.style('transition', 'opacity 0.2s');

		return () => {
			if (simulation) {
				simulation.stop();
			}
		};
	});

	// Update highlighting
	$effect(() => {
		if (!svg) return;

		const svgSelection = d3.select(svg);
		svgSelection.selectAll('g.bubble').each(function(d: any) {
			const bubble = d3.select(this);
			const circle = bubble.select('circle');

			if (isHighlighted(d.id)) {
				circle
					.attr('stroke', 'oklch(0.75 0.15 195)')
					.attr('stroke-width', 3);
				bubble.raise();
			} else if (hoveredOther) {
				circle
					.attr('stroke', 'transparent')
					.attr('stroke-width', 3);
				bubble.select('image')
					.style('opacity', 0.4);
			} else {
				circle
					.attr('stroke', 'transparent')
					.attr('stroke-width', 3);
				bubble.select('image')
					.style('opacity', 1);
			}
		});
	});
</script>

<div bind:this={container} class="bubble-chart-container" data-test-id="bubble-chart-container">
	<svg bind:this={svg} {width} {height} class="bubble-chart" data-test-id="bubble-chart-svg"></svg>
</div>

<BubbleChartTooltip item={hoveredItem} x={mouseX} y={mouseY} type={tooltipType} />

<style>
	.bubble-chart-container {
		width: 100%;
		height: 100%;
	}

	.bubble-chart {
		display: block;
	}
</style>
