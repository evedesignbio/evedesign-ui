import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { extractModifiers } from "../../utils/events.tsx";
import { NATURAL_SEQ_PREFIX } from "../../pages/results/data.ts";
import { useResizeObserver } from "@mantine/hooks";

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
	// isSelected: boolean;
};

type ScatterPlotProps = {
	points: Point[];
	showHistogram?: boolean;
	showAxes?: boolean;
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
	showAxes = true,
	handleEvent = undefined 
}: ScatterPlotProps) {
	const svgRef = useRef<SVGSVGElement | null>(null);
	const [containerRef, rect] = useResizeObserver();
	const [zoomTransform, setZoomTransform] = useState<d3.ZoomTransform>(d3.zoomIdentity);
	const [brushTrigger, setBrushTrigger] = useState(0);

	// NEW: persistent groups
	const gPointsRef = useRef<SVGGElement | null>(null);
	const gXAxisRef = useRef<SVGGElement | null>(null);
	const gYAxisRef = useRef<SVGGElement | null>(null);
	const gXHistRef = useRef<SVGGElement | null>(null);
	const gYHistRef = useRef<SVGGElement | null>(null);

	// NEW: unique clipPath id to avoid collisions if multiple charts mount
	const clipIdRef = useRef(`plot-clip-${Math.random().toString(36).slice(2)}`);

	const [tooltip, setTooltip] = useState<{
		show: boolean;
		x: number;
		y: number;
		content: string | React.ReactNode;
	}>({ show: false, x: 0, y: 0, content: "" });

	// INIT: build static SVG structure and behaviors (no data-dependent drawing here)
	useEffect(() => {
		if (!svgRef.current || rect.width === 0 || rect.height === 0) return;

		// Clean slate only on reinitialization
		const { width, height } = rect;
		const svg = d3.select(svgRef.current);
		svg.selectAll("*").remove();
		svg.attr("viewBox", `0 0 ${width} ${height}`).attr("width", "100%").attr("height", "100%");

		const margin = {
			top: showHistogram ? 10 + TOP_HIST_HEIGHT : 10,
			right: showHistogram ? 10 + RIGHT_HIST_WIDTH : 10,
			bottom: showAxes ? 20 : 0,
			left: showAxes ? 30 : 0,
		};

		// Clip
		svg
			.append("defs")
			.append("clipPath")
			.attr("id", clipIdRef.current)
			.append("rect")
			.attr("x", margin.left)
			.attr("y", margin.top)
			.attr("width", width - margin.left - margin.right)
			.attr("height", height - margin.top - margin.bottom);

		// Axes
		gXAxisRef.current = showAxes
			? svg
					.append("g")
					.attr("class", "x-axis")
					.attr("transform", `translate(0,${height - margin.bottom})`)
					.node()
			: null;

		gYAxisRef.current = showAxes
			? svg.append("g")
					.attr("class", "y-axis")
					.attr("transform", `translate(${margin.left},0)`)
					.node()
			: null;

		// Histograms
		gXHistRef.current = showHistogram ? svg.append("g").attr("class", "x-hist").node() : null;
		gYHistRef.current = showHistogram ? svg.append("g").attr("class", "y-hist").node() : null;

		// Clipped plot area + points group
		const clippedArea = svg.append("g").attr("clip-path", `url(#${clipIdRef.current})`);
		gPointsRef.current = clippedArea.append("g").attr("class", "points-group").node();

		// ----- BRUSH (listeners attached to the svg; selection computed in Update effect scales) -----
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
			event.stopPropagation();

			const [cx, cy] = d3.pointer(event, svg.node());
			const x0 = Math.min(brushStart[0], cx);
			const y0 = Math.min(brushStart[1], cy);
			const x1 = Math.max(brushStart[0], cx);
			const y1 = Math.max(brushStart[1], cy);

			brushRect
				.attr("x", x0)
				.attr("y", y0)
				.attr("width", Math.abs(cx - brushStart[0]))
				.attr("height", Math.abs(cy - brushStart[1]));

			// Hit-test happens in Update effect where we have current scales.
			// Store the brush box on the svg for Update effect to read.
			(svg.node() as any).__brushBox = { x0, y0, x1, y1 };
			(svg.node() as any).__needsBrushUpdate = true;
			setBrushTrigger((prev) => prev + 1);
		};

		const handleBrushEnd = (event: MouseEvent) => {
			if (!brushing || !brushStart || !brushRect) return;
			handleEvent?.(Array.from(selectedPointIds), extractModifiers(event));

			brushRect.remove();
			brushRect = null;
			brushStart = null;
			brushing = false;
			
			(svg.node() as any).__brushBox = null;
			(svg.node() as any).__needsBrushUpdate = false;
		};

		// Reset on click (when not brushing)
		svg.on("click.reset", (event: MouseEvent) => {
			// do nothing if shift-brushing
			if ((event as any).shiftKey || brushing) return;
			handleEvent?.([], extractModifiers(event));
		});

		// Attach brush event listeners
		svg.on("mousedown.brush", handleBrushStart);
		svg.on("mousemove.brush", handleBrushMove);
		svg.on("mouseup.brush", handleBrushEnd);
		svg.on("mouseleave.brush", handleBrushEnd);

		// ----- ZOOM (only transforms the points group; axes/hists updated in Update effect) -----
		const zoomed = (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
			setZoomTransform(event.transform);
			// Apply this transform on the <g> element that holds all your points
			d3.select(gPointsRef.current).attr("transform", event.transform.toString());
		};

		const zoom = d3
			.zoom<SVGSVGElement, unknown>()
			.scaleExtent([0.5, 10])
			.on("zoom", zoomed)
			.filter((ev: any) => !ev.shiftKey); // disable zoom when shift (brushing)

		svg.call(zoom);
		if (zoomTransform !== d3.zoomIdentity) {
			svg.call(zoom.transform, zoomTransform);
		}

		// Expose selection set so Update effect can fill it
		(svg.node() as any).__selectedPointIds = selectedPointIds;
	}, [rect.width, rect.height, showHistogram, showAxes]);

	// UPDATE: compute scales, update axes/hists, and *selectively* update points
	useEffect(() => {
		if (!svgRef.current || !gPointsRef.current || rect.width === 0 || rect.height === 0) return;

		const svg = d3.select(svgRef.current);
		const pointsGroup = d3.select(gPointsRef.current);

		const { width, height } = rect;
		const margin = {
			top: showHistogram ? 10 + TOP_HIST_HEIGHT : 10,
			right: showHistogram ? 10 + RIGHT_HIST_WIDTH : 10,
			bottom: showAxes ? 20 : 0,
			left: showAxes ? 30 : 0,
		};

		// Scales from data
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

		// Rescale by current zoom transform (if any)
		const t = zoomTransform;
		const newX = t.rescaleX(xScale);
		const newY = t.rescaleY(yScale);

		// Axes
		if (showAxes && gXAxisRef.current && gYAxisRef.current) {
			d3.select(gXAxisRef.current).call(d3.axisBottom(newX));
			d3.select(gYAxisRef.current).call(d3.axisLeft(newY));
		}

		// Histograms (data-join, don’t rebuild containers)
		if (showHistogram) {
			// X
			if (gXHistRef.current) {
				const xVals = points.map((p) => p.x);
				const xBins = d3
					.bin()
					.domain(xScale.domain() as [number, number])
					.thresholds(X_THRESHOLDS)(xVals);
				const xMax = d3.max(xBins, (b) => b.length) ?? 1;
				const xCountToY = d3.scaleLinear().domain([0, xMax]).range([TOP_HIST_HEIGHT, 0]);

				const gx = d3.select(gXHistRef.current);
				const rects = gx.selectAll<SVGRectElement, d3.Bin<number, number>>("rect").data(xBins, (d: any) => `${d.x0}|${d.x1}`);

				rects.enter().append("rect").attr("stroke", "#333").attr("stroke-width", 1).attr("fill", "none");
				rects
					.attr("x", (b) => (b.x0 == null ? 0 : newX(b.x0)) + 1)
					.attr("y", (b) => margin.top - TOP_HIST_HEIGHT + xCountToY(b.length))
					.attr("width", (b) => {
						const x0 = b.x0 == null ? 0 : newX(b.x0);
						const x1 = b.x1 == null ? 0 : newX(b.x1);
						return Math.max(0, x1 - x0 - 2);
					})
					.attr("height", (b) => TOP_HIST_HEIGHT - xCountToY(b.length));
				rects.exit().remove();
			}

			// Y
			if (gYHistRef.current) {
				const yVals = points.map((p) => p.y);
				const yBins = d3
					.bin()
					.domain(yScale.domain() as [number, number])
					.thresholds(Y_THRESHOLDS)(yVals);
				const yMax = d3.max(yBins, (b) => b.length) ?? 1;
				const yCountToX = d3.scaleLinear().domain([0, yMax]).range([0, RIGHT_HIST_WIDTH]);

				const gy = d3.select(gYHistRef.current);
				const rects = gy.selectAll<SVGRectElement, d3.Bin<number, number>>("rect").data(yBins, (d: any) => `${d.x0}|${d.x1}`);

				rects.enter().append("rect").attr("stroke", "#333").attr("fill", "none");
				rects
					.attr("x", width - margin.right)
					.attr("y", (b) => (b.x1 == null ? 0 : newY(b.x1)))
					.attr("width", (b) => yCountToX(b.length))
					.attr("height", (b) => {
						const y0 = b.x0 == null ? 0 : newY(b.x0);
						const y1 = b.x1 == null ? 0 : newY(b.x1);
						return Math.max(0, y0 - y1 - 1);
					});
				rects.exit().remove();
			}
		}

		// Tooltip helpers
		const showTooltip = (event: MouseEvent, d: Point) => {
			const content = d.tooltipData
				? Object.entries(d.tooltipData)
						.map(([k, v]) => `${k}: ${v}`)
						.join("\n")
				: "";
			setTooltip({ 
				show: true, 
				x: event.clientX + 10, 
				y: event.clientY - 10, 
				content 
			});
		};
		const hideTooltip = () => {
			setTooltip((prev) => ({ ...prev, show: false }));
		};
		const moveTooltip = (event: MouseEvent) => {
			setTooltip((prev) => ({
				...prev,
				x: event.clientX + 10,
				y: event.clientY - 10
			}));
		};

		// POINTS: keyed join + per-node hash to skip unchanged
		const pts = points.map((p) => ({ ...p, __hash: hashPointForRender(p) }));

		const sel = pointsGroup.selectAll<SVGPathElement, Point & { __hash: string }>("path.dot").data(pts, (d: any) => d.id);

		sel.exit().remove();

		const enter = sel
			.enter()
			.append("path")
			.attr("class", "dot")
			.each(function () {
				(this as any).__hash = "";
			})
			.attr("d", d3.symbol().type(symbolType("circle")).size(1)()) // temp; real 'd' set below when changed
			.on("mouseover", (event: MouseEvent, d: Point) => showTooltip(event, d))
			.on("mousemove", (event: MouseEvent) => moveTooltip(event))
			.on("mouseleave", () => hideTooltip())
			.on("click", function (event: MouseEvent, d: Point) {
				event.stopPropagation();
				if (d.id.startsWith(NATURAL_SEQ_PREFIX)) return;
				handleEvent?.([d.id], extractModifiers(event));
			});

		// Only rerender nodes whose visual hash changed
		const update = enter.merge(sel as any).filter(function (d) {
			const prev = (this as any).__hash;
			const changed = prev !== d.__hash;
			if (changed) (this as any).__hash = d.__hash;
			return changed;
		});
		
		update
		.attr("d", (d: Point) => d3.symbol().type(symbolType(d.shape)).size(symbolSize(d.size))())
		.attr("transform", (d: Point) => `translate(${xScale(d.x)}, ${yScale(d.y)})`)
		.attr("fill", (d: Point) => d.color)
		.attr("fill-opacity", (d: Point) => d.transparency)
		.attr("stroke", (d: Point) => d.outlineColor ?? "none")
		.attr("stroke-width", (d: Point) => (d.outlineColor ? 0.6 : 0));
		
				// if (!update.empty()) {
				// 	console.log(
				// 		"Points re-rendered this frame:",
				// 		update.data().map((d) => d.id)
				// 	);
				// } // DEBUG: check points being rerendered

		// Move selected nodes to the end of the group (show on top)
		pointsGroup.selectAll<SVGPathElement, Point>("path.dot").classed("is-selected", (d) => (d as any).isSelected == true); 
		pointsGroup.selectAll<SVGPathElement, Point>("path.dot.is-selected").raise();

		// Collect selected points in brush rectangle (with current transform)
		const brushBox = (svg.node() as any).__brushBox;
		const needsBrushUpdate = (svg.node() as any).__needsBrushUpdate;

		if (brushBox && needsBrushUpdate) {
			const selSet: Set<string> = (svg.node() as any).__selectedPointIds;
			selSet.clear();

			pointsGroup.selectAll<SVGPathElement, Point>("path.dot").each(function (d: Point) {
				// NOTE: use original scales + zoom transform for screen coords
				const sx = t.applyX(xScale(d.x));
				const sy = t.applyY(yScale(d.y));
				if (brushBox.x0 <= sx && sx <= brushBox.x1 && brushBox.y0 <= sy && sy <= brushBox.y1) {
					if (!d.id.startsWith(NATURAL_SEQ_PREFIX)) selSet.add(d.id);
				}
			});

			// Reset the update flag
			(svg.node() as any).__needsBrushUpdate = false;
			console.log("Brush selection updated:", Array.from(selSet)); // DEBUG
		}
	}, [points, rect.width, rect.height, showHistogram, showAxes, zoomTransform, brushTrigger]);

	function hashPointForRender(p: Point): string {
		const s = `${p.x}|${p.y}|${p.color}|${p.shape}|${p.size}|${p.transparency}|${p.outlineColor ?? ""}`;
		let h = 2166136261 >>> 0; // FNV-1a
		for (let i = 0; i < s.length; i++) {
			h ^= s.charCodeAt(i);
			h = Math.imul(h, 16777619);
		}
		return `${h}`;
	}

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

	// Render
	return (
		<div ref={containerRef} style={{ width: "100%", height: "100%" }}>
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