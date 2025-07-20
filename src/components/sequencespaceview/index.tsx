import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { data396 } from "./coords_cluster_396.ts"; // TODO: imports dummy data, remove later
import { data392 } from "./coords_cluster_392.ts"; // TODO: imports dummy data, remove later

// Dummy data structure - replace later
type Point = { x: number; y: number };
type Cluster = {
	name: string;
	color: string;
	shape: "circle" | "triangle";
	data: Point[];
};

// Dummy data
const clusters: Cluster[] = [
	{
		name: "cluster1",
		color: "red",
		shape: "circle",
		data: data396,
	},
	{
		name: "cluster2",
		color: "blue",
		shape: "triangle",
		data: data392,
	},
];

// Constants for point sizes
const POINT_RADIUS = {
	DEFAULT: 1.5,
	HIGHLIGHTED: 2.5,
	DIMMED: 1,
} as const;

// Color palette
const pallet = new Map([
	["red", "#fa5252"],
	["blue", "#339af0"],
]);

export default function SequenceSpaceView() {
	const svgRef = useRef<SVGSVGElement | null>(null);
	const [selected, setSelected] = useState<Set<string>>(new Set());

	useEffect(() => {
		if (!svgRef.current) return;

		const width = 600;
		const height = 450;
		const margin = { top: 20, right: 20, bottom: 40, left: 40 };

		// build flat points array with cluster info
		const points = clusters.flatMap((c, ci) =>
			c.data.map((d, di) => ({
				...d,
				key: `${ci}-${di}`,
				cluster: c.name,
				color: pallet.get(c.color) ?? c.color,
			}))
		);

		// scales
		const xScale = d3
			.scaleLinear()
			.domain(d3.extent(points, (d) => d.x) as [number, number])
			.nice()
			.range([margin.left, width - margin.right]);
		const yScale = d3
			.scaleLinear()
			.domain(d3.extent(points, (d) => d.y) as [number, number])
			.nice()
			.range([height - margin.bottom, margin.top]);

		// clean slate
		const svg = d3.select(svgRef.current);
		svg.selectAll("*").remove();
		svg.attr("viewBox", `0 0 ${width} ${height}`);

		// Static axes (not transformed by zoom)
		const xAxis = svg
			.append("g")
			.attr("class", "x-axis")
			.attr("transform", `translate(0,${height - margin.bottom})`)
			.call(d3.axisBottom(xScale));

		const yAxis = svg.append("g").attr("class", "y-axis").attr("transform", `translate(${margin.left},0)`).call(d3.axisLeft(yScale));

		// Create group for points that will be transformed by zoom
		const pointsGroup = svg.append("g").attr("class", "points-group");

		/* ------------------------------------------------------------------ */
		/* CLUSTER HIGHLIGHTING                                               */
		/* ------------------------------------------------------------------ */
		const highlight = (hoveredCluster: string) => {
			dots
				.transition()
				.duration(200)
				.attr("r", (d: any) => (d.cluster === hoveredCluster ? POINT_RADIUS.HIGHLIGHTED : POINT_RADIUS.DIMMED));

			// Bring highlighted cluster points to front
			dots.filter((d: any) => d.cluster === hoveredCluster).raise();
		};

		const removeHighlight = () => {
			dots
				.transition()
				.duration(100)
				.attr("r", POINT_RADIUS.DEFAULT);
		};

		const dots = pointsGroup
			.selectAll("circle")
			.data(points)
			.enter()
			.append("circle")
			.attr("r", POINT_RADIUS.DEFAULT)
			.attr("cx", (d) => xScale(d.x))
			.attr("cy", (d) => yScale(d.y))
			.attr("fill", (d) => d.color)
			.on("mouseover", (event: MouseEvent, d: any) => highlight(d.cluster))
			.on("mouseleave", removeHighlight);

		/* ------------------------------------------------------------------ */
		/* BRUSH HANDLER (Shift + drag only)                                   */
		/* ------------------------------------------------------------------ */
		let brushing = false;
		let brushStart: [number, number] | null = null;
		let brushRect: d3.Selection<SVGRectElement, unknown, null, undefined> | null = null;

		const handleBrushStart = (event: MouseEvent) => {
			if (!event.shiftKey) return;

			event.preventDefault();
			event.stopPropagation();

			brushing = true;
			const [x, y] = d3.pointer(event, svg.node());
			brushStart = [x, y];

			// Create brush rectangle
			brushRect = svg
				.append("rect")
				.attr("class", "brush-rect")
				.attr("x", x)
				.attr("y", y)
				.attr("width", 0)
				.attr("height", 0)
				.style("fill", "rgba(100, 149, 237, 0.1)")
				.style("stroke", "cornflowerblue")
				.style("stroke-width", 1)
				.style("stroke-dasharray", "3,3");
		};

		const handleBrushMove = (event: MouseEvent) => {
			if (!brushing || !brushStart || !brushRect) return;

			const [currentX, currentY] = d3.pointer(event, svg.node());
			const x = Math.min(brushStart[0], currentX);
			const y = Math.min(brushStart[1], currentY);
			const width = Math.abs(currentX - brushStart[0]);
			const height = Math.abs(currentY - brushStart[1]);

			brushRect.attr("x", x).attr("y", y).attr("width", width).attr("height", height);
		};

		const handleBrushEnd = (event: MouseEvent) => {
			if (!brushing || !brushStart || !brushRect) return;

			const [currentX, currentY] = d3.pointer(event, svg.node());
			const x0 = Math.min(brushStart[0], currentX);
			const y0 = Math.min(brushStart[1], currentY);
			const x1 = Math.max(brushStart[0], currentX);
			const y1 = Math.max(brushStart[1], currentY);

			// Find selected points
			const picked = new Set<string>();
			const currentTransform = d3.zoomTransform(pointsGroup.node()!);

			dots
				.style("fill", "lightgrey")
				.filter((d: any) => {
					const screenX = currentTransform.applyX(xScale(d.x));
					const screenY = currentTransform.applyY(yScale(d.y));
					const hit = x0 <= screenX && screenX <= x1 && y0 <= screenY && screenY <= y1;
					if (hit) picked.add(d.key);
					return hit;
				})
				.style("fill", (d: any) => d.color);

			setSelected(picked);

			// Clean up
			brushRect.remove();
			brushRect = null;
			brushStart = null;
			brushing = false;
		};

		// Attach brush event listeners
		svg.on("mousedown.brush", handleBrushStart);
		svg.on("mousemove.brush", handleBrushMove);
		svg.on("mouseup.brush", handleBrushEnd);
		svg.on("mouseleave.brush", handleBrushEnd);

		/* ------------------------------------------------------------------ */
		/* ZOOM HANDLER                                                        */
		/* ------------------------------------------------------------------ */
		const zoomed = (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
			const transform = event.transform;

			// Apply transform only to the points group
			pointsGroup.attr("transform", transform.toString());

			// Update axis scales to reflect the current zoom/pan state
			const newXScale = transform.rescaleX(xScale);
			const newYScale = transform.rescaleY(yScale);

			// Update axis ticks and labels (but not the axis lines themselves)
			xAxis.call(d3.axisBottom(newXScale));
			yAxis.call(d3.axisLeft(newYScale));
		};

		const zoom = d3
			.zoom<SVGSVGElement, unknown>()
			.scaleExtent([0.5, 10])
			.on("zoom", zoomed)
			.filter((event: any) => {
				// Only allow zoom if not shift-clicking (for brush) and not currently brushing
				return !event.shiftKey && !brushing;
			});

		// Apply zoom to the SVG
		svg.call(zoom);
	}, []);

	// Render
	return (
		<div>
			<div style={{ marginBottom: 8, fontSize: "14px" }}>
				Hold Shift + drag to select points, scroll/drag to zoom/pan
			</div>
			<div style={{ marginBottom: 8, fontSize: "14px" }}>
				<strong>Selected:</strong> {selected.size ? `${selected.size} points` : "none"}
			</div>
			<svg ref={svgRef} width="100%" height="100%" />
		</div>
	);
}
