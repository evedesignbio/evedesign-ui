import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { extractModifiers } from "../../utils/events.tsx";
import { NATURAL_SEQ_PREFIX } from "../../pages/results/data.ts";

export type Point = {
	id: string;
	x: number;
	y: number;
	color: string;
	shape: string;
	size: number;
	transparency: number;
	outlineColor?: string;
	tooltipData?: Record<string, any>;
};

type ScatterPlotProps = {
	points: Point[];
	showHistogram?: boolean;
	handleEvent?: (selectedPointIds: string[], modifiers: any) => void;
};

// histogram config
const TOP_HIST_HEIGHT = 90;
const RIGHT_HIST_WIDTH = 90;
const X_THRESHOLDS = 30;
const Y_THRESHOLDS = 30;

export default function ScatterPlot({ 
	points, 
	showHistogram = false, 
	handleEvent = undefined 
}: ScatterPlotProps) {
	const svgRef = useRef<SVGSVGElement | null>(null);
	const [tooltip, setTooltip] = useState<{
		show: boolean;
		x: number;
		y: number;
		content: string | React.ReactNode;
	}>({ show: false, x: 0, y: 0, content: "" });

	useEffect(() => {
		if (!svgRef.current) return;

		const width = 600;
		const height = 450;
		const margin = {
			top: showHistogram ? 20 + TOP_HIST_HEIGHT : 20,
			right: showHistogram ? 20 + RIGHT_HIST_WIDTH : 20,
			bottom: 40,
			left: 40,
		};

		// TODO: makes scales robust to empty

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
		// TOOLTIP FUNCTIONS
		// ------------------------------------------------------------------
		// @ts-ignore
		const showTooltip = (event: MouseEvent, d: Point, index: number) => {
			const mouseX = event.clientX;
			const mouseY = event.clientY;

			const content = d.tooltipData
				? Object.entries(d.tooltipData)
						.map(([k, v]) => `${k}: ${v}`)
						.join("\n")
				: "";
			setTooltip({
				show: true,
				x: mouseX + 10,
				y: mouseY - 10,
				content,
			});
		};

		const hideTooltip = () => {
			setTooltip((prev) => ({ ...prev, show: false }));
		};

		const updateTooltipPosition = (event: MouseEvent) => {
			const mouseX = event.clientX;
			const mouseY = event.clientY;
			setTooltip((prev) => ({
				...prev,
				x: mouseX + 10,
				y: mouseY - 10,
			}));
		};

		function symbolType(shape: string) {
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

		const symbolSize = (r: number) => r * 20;

		// ---------- draw points ----------
		const dots = pointsGroup
			.selectAll<SVGPathElement, Point>("path.dot")
			// @ts-ignore
			.data(points, (d: Point) => d.id)
			.join(
				(enter: d3.Selection<d3.EnterElement, Point, SVGGElement, unknown>) =>
					enter
						.append("path")
						.attr("class", "dot")
						.attr("d", (d: Point) => d3.symbol().type(symbolType(d.shape)).size(symbolSize(d.size))())
						.attr("transform", (d: Point) => `translate(${xScale(d.x)}, ${yScale(d.y)})`)
						.attr("fill", (d: Point) => d.color)
						.attr("fill-opacity", (d: Point) => d.transparency)
						.attr("stroke", (d: Point) => d.outlineColor ?? "none")
						.attr("stroke-width", (d: Point) => (d.outlineColor ? 0.6 : 0))
						// .attr("data-oob", (d) => (isOob(d) ? "1" : "0"))
						.on("mouseover", (event: MouseEvent, d: Point) => {
							const index = points.findIndex((p) => p.id === d.id);
							showTooltip(event, d, index);
						})
						.on("mousemove", (event: MouseEvent) => updateTooltipPosition(event))
						.on("mouseleave", hideTooltip)
						.on("click", function (event: MouseEvent, d: Point) {
							// prevent background reset
							event.stopPropagation();
							// natural sequences are not selectable
							if (d.id.startsWith(NATURAL_SEQ_PREFIX)) return;
							handleEvent?.([d.id], extractModifiers(event));
						}),
				(update: d3.Selection<SVGPathElement, Point, SVGGElement, unknown>) =>
					update
						.attr("d", (d: Point) => d3.symbol().type(symbolType(d.shape)).size(symbolSize(d.size))())
						.attr("transform", (d: Point) => `translate(${xScale(d.x)}, ${yScale(d.y)})`)
						.attr("fill", (d: Point) => d.color)
						.attr("fill-opacity", (d: Point) => d.transparency)
						.attr("stroke", (d: Point) => d.outlineColor ?? "none")
						.attr("stroke-width", (d: Point) => (d.outlineColor ? 0.6 : 0)),
				// .attr("data-oob", (d) => (isOob(d) ? "1" : "0"))
				(exit: d3.Selection<SVGPathElement, Point, SVGGElement, unknown>) => exit.remove()
			);

		// ---------- marginal histograms ----------
		let xHistRects: d3.Selection<SVGRectElement, d3.Bin<number, number>, SVGGElement, unknown> | null = null;
		let yHistRects: d3.Selection<SVGRectElement, d3.Bin<number, number>, SVGGElement, unknown> | null = null;

		if (showHistogram && points.length) {
			// top histogram (X)
			const xValues = points.map((p) => p.x);
			const xBins = d3
				.bin()
				.domain(xScale.domain() as [number, number])
				.thresholds(X_THRESHOLDS)(xValues);
			const xMax = d3.max(xBins, (b) => b.length) ?? 1;
			const xCountToY = d3.scaleLinear().domain([0, xMax]).range([TOP_HIST_HEIGHT, 0]);

			const xHistG = svg.append("g").attr("class", "x-hist");
			xHistRects = xHistG
				.selectAll("rect")
				.data(xBins)
				.enter()
				.append("rect")
				.attr("stroke", "#333")
				.attr("stroke-width", 1)
				.attr("fill", "none")
				.attr("x", (b) => (b.x0 == null ? 0 : xScale(b.x0)) + 1)
				.attr("y", (b) => margin.top - TOP_HIST_HEIGHT + xCountToY(b.length))
				.attr("width", (b) => {
					const x0 = b.x0 == null ? 0 : xScale(b.x0);
					const x1 = b.x1 == null ? 0 : xScale(b.x1);
					return Math.max(0, x1 - x0 - 2);
				})
				.attr("height", (b) => TOP_HIST_HEIGHT - xCountToY(b.length));

			// right histogram (Y)
			const yValues = points.map((p) => p.y);
			const yBins = d3
				.bin()
				.domain(yScale.domain() as [number, number])
				.thresholds(Y_THRESHOLDS)(yValues);
			const yMax = d3.max(yBins, (b) => b.length) ?? 1;
			const yCountToX = d3.scaleLinear().domain([0, yMax]).range([0, RIGHT_HIST_WIDTH]);

			const yHistG = svg.append("g").attr("class", "y-hist");
			yHistRects = yHistG
				.selectAll("rect")
				.data(yBins)
				.enter()
				.append("rect")
				.attr("stroke", "#333")
				.attr("fill", "none")
				.attr("x", width - margin.right)
				.attr("y", (b) => {
					const y1 = b.x1 == null ? 0 : yScale(b.x1);
					return y1;
				})
				.attr("width", (b) => yCountToX(b.length))
				.attr("height", (b) => {
					const y0 = b.x0 == null ? 0 : yScale(b.x0);
					const y1 = b.x1 == null ? 0 : yScale(b.x1);
					return Math.max(0, y0 - y1 - 1);
				});
		}

		// ------------------------------------------------------------------
		// BRUSH HANDLER
		// ------------------------------------------------------------------
		let brushing = false;
		let brushStart: [number, number] | null = null;
		let brushRect: d3.Selection<SVGRectElement, unknown, null, undefined> | null = null;
		let selectedPointIds = new Set<string>();

		const handleBrushStart = (event: MouseEvent) => {
			if (!event.shiftKey) return;

			event.preventDefault();
			event.stopPropagation();

			brushing = true;
			const [x, y] = d3.pointer(event, svg.node());
			brushStart = [x, y];
			selectedPointIds.clear(); // Clear previous selection when starting new drag-select

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
			selectedPointIds.clear(); // Clear previous selection and rebuild selection each move
			const currentTransform = d3.zoomTransform(pointsGroup.node()!);

			dots
				.each((d: Point) => {
					const screenX = currentTransform.applyX(xScale(d.x));
					const screenY = currentTransform.applyY(yScale(d.y));
					const hit = x0 <= screenX && screenX <= x1 && y0 <= screenY && screenY <= y1;
					if (hit && !d.id.startsWith(NATURAL_SEQ_PREFIX)) selectedPointIds.add(d.id);
				});
		};

		const handleBrushEnd = (event: MouseEvent) => {
			if (!brushing || !brushStart || !brushRect) return;

			// TODO: Set up handler for selection event
			if (handleEvent) {
				console.log(selectedPointIds); // DEBUG
				const modifiers = extractModifiers(event);
				const selectedPoints = Array.from(selectedPointIds);
				handleEvent(selectedPoints, modifiers);
			}

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

			// TODO: Set up handler for selection event (currently ignores event in data.ts when empty array is passed)
			handleEvent?.([], extractModifiers(event));
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

			// keep histograms aligned with axes (recompute positions using rescaled axes)
			if (showHistogram) {
				xHistRects
					?.attr("x", (b) => (b.x0 == null ? 0 : newXScale(b.x0)) + 1)
					.attr("width", (b) => {
						const x0 = b.x0 == null ? 0 : newXScale(b.x0);
						const x1 = b.x1 == null ? 0 : newXScale(b.x1);
						return Math.max(0, x1 - x0 - 2);
					});

				yHistRects
					?.attr("y", (b) => {
						const y1 = b.x1 == null ? 0 : newYScale(b.x1);
						return y1;
					})
					.attr("height", (b) => {
						const y0 = b.x0 == null ? 0 : newYScale(b.x0);
						const y1 = b.x1 == null ? 0 : newYScale(b.x1);
						return Math.max(0, y0 - y1 - 1);
					});
			}
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
	}, [points]);

	// Render
	return (
		<div>
			<div style={{ marginBottom: 8, fontSize: "12px" }}>Hold Shift + drag to select points, scroll/drag to zoom/pan</div>
			{/* <div style={{ marginBottom: 8, fontSize: "12px" }}>
				<strong>Selected:</strong> {selected.size ? `${selected.size} points` : "none"}
			</div> */}
			<svg ref={svgRef} width="100%" height="100%" />

			{/* Tooltip */}
			{tooltip.show && (
				<div
					style={{
						position: "fixed",
						left: tooltip.x,
						top: tooltip.y,
						backgroundColor: "rgba(0, 0, 0, 0.8)",
						color: "white",
						padding: "8px 12px",
						borderRadius: "4px",
						fontSize: "12px",
						pointerEvents: "none",
						zIndex: 1000,
						maxWidth: "300px",
						whiteSpace: "pre-line",
						boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
					}}
				>
					{tooltip.content}
				</div>
			)}
		</div>
	);
}