import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

// Dummy data structure - replace later
export type Point = { 
	id: string;
	x: number; 
	y: number;
	color: string;
	shape: string;
	size: number;
	transparency: number;
	outlineColor?: string;
 };

type Props = {
	points: Point[];
};

// Constants for point sizes
const POINT_RADIUS = {
	DEFAULT: 1.5,
	HIGHLIGHTED: 2.5,
	DIMMED: 1,
} as const;

export default function ScatterPlot({ points }: Props) {
	const svgRef = useRef<SVGSVGElement | null>(null);
	const [selected, setSelected] = useState<Set<string>>(new Set());

	useEffect(() => {
		if (!svgRef.current) return;

		const width = 600;
		const height = 450;
		const margin = { top: 20, right: 20, bottom: 40, left: 40 };

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

		// ------------------------------------------------------------------
		// CLUSTER HIGHLIGHTING
		// ------------------------------------------------------------------
		// const highlight = (hoveredCluster: string) => {
		// 	dots
		// 		.transition()
		// 		.duration(200)
		// 		.attr("r", (d: any) => (d.cluster === hoveredCluster ? POINT_RADIUS.HIGHLIGHTED : POINT_RADIUS.DIMMED));

		// 	// Bring highlighted cluster points to front
		// 	dots.filter((d: any) => d.cluster === hoveredCluster).raise();
		// };

		// const removeHighlight = () => {
		// 	dots.transition().duration(100).attr("r", POINT_RADIUS.DEFAULT);
		// };

		function getSymbolType(shape: string) {
			switch (shape) {
				case "circle":
					return d3.symbolCircle;
				case "triangle":
					return d3.symbolTriangle;
				case "square":
					return d3.symbolSquare;
				case "star":
					return d3.symbolStar;
				case "diamond":
					return d3.symbolDiamond;
				case "cross":
					return d3.symbolCross;
				default:
					return d3.symbolCircle;
			}
		}

		const dots = pointsGroup
			.selectAll("circle")
			.data(points, (d) => d.id)
			.enter()
			.append("path")
			.attr("d", (d) => {
				const symbolType = getSymbolType(d.shape);
				return d3
					.symbol()
					.type(symbolType)
					.size(d.size * 20)(); // TODO: adjust size factor
			})
			.attr("transform", (d) => `translate(${xScale(d.x)}, ${yScale(d.y)})`)
			.attr("fill", (d) => d.color)
			.attr("fill-opacity", (d) => d.transparency)
			.attr("stroke", (d) => d.outlineColor ?? "none")
			.attr("stroke-width", (d) => (d.outlineColor ? 0.4 : 0));
			// .on("mouseover", (event: MouseEvent, d: any) => highlight(d.cluster))
			// .on("mouseleave", removeHighlight);

		// ------------------------------------------------------------------
		// BRUSH HANDLER
		// ------------------------------------------------------------------
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

			// stop the click from propagating after a brush (prevents interfering with reset click)
			event.stopPropagation();

			const [currentX, currentY] = d3.pointer(event, svg.node());
			const x0 = Math.min(brushStart[0], currentX);
			const y0 = Math.min(brushStart[1], currentY);
			const x1 = Math.max(brushStart[0], currentX);
			const y1 = Math.max(brushStart[1], currentY);

			// Draw the brush rectangle
			const width = Math.abs(currentX - brushStart[0]);
			const height = Math.abs(currentY - brushStart[1]);
			brushRect.attr("x", x0).attr("y", y0).attr("width", width).attr("height", height);

			// Find selected points
			const picked = new Set<string>();
			const currentTransform = d3.zoomTransform(pointsGroup.node()!);

			dots
				.style("fill", "lightgrey")
				.filter((d: any) => {
					const screenX = currentTransform.applyX(xScale(d.x));
					const screenY = currentTransform.applyY(yScale(d.y));
					const hit = x0 <= screenX && screenX <= x1 && y0 <= screenY && screenY <= y1;
					if (hit) picked.add(d.id);
					return hit;
				})
				.style("fill", (d: any) => d.color);

			setSelected(picked);
		};

		const handleBrushEnd = (event: MouseEvent) => {
			if (!brushing || !brushStart || !brushRect) return;

			// Clean up
			brushRect.remove();
			brushRect = null;
			brushStart = null;
			brushing = false;
		};

		// -------------------------------------------------------------
		// RESET ON CLICK
		// -------------------------------------------------------------
		// when you click anywhere (and you're not brushing), clear highlights
		svg.on("click.reset", (event: MouseEvent) => {
			// don't reset while shift-dragging
			if (event.shiftKey || brushing) return;
			// reset all dots to their original fill
			dots.style("fill", (d: any) => d.color);
			setSelected(new Set());
		});

		// Attach brush event listeners
		svg.on("mousedown.brush", handleBrushStart);
		svg.on("mousemove.brush", handleBrushMove);
		svg.on("mouseup.brush", handleBrushEnd);
		svg.on("mouseleave.brush", handleBrushEnd);

		// ------------------------------------------------------------------
		// ZOOM HANDLER
		// ------------------------------------------------------------------
		const zoomed = (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
			const transform = event.transform;

			// Apply transform only to the points group
			pointsGroup.attr("transform", transform.toString());

			// Update axis scales to reflect the current zoom/pan state
			const newXScale = transform.rescaleX(xScale);
			const newYScale = transform.rescaleY(yScale);

			// Update axis ticks and labels
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

		svg.call(zoom);
	}, []);

	// Render
	return (
		<div>
			<div style={{ marginBottom: 8, fontSize: "14px" }}>Hold Shift + drag to select points, scroll/drag to zoom/pan</div>
			<div style={{ marginBottom: 8, fontSize: "14px" }}>
				<strong>Selected:</strong> {selected.size ? `${selected.size} points` : "none"}
			</div>
			<svg ref={svgRef} width="100%" height="100%" />
		</div>
	);
}