import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

// Dummy data structure - replace later
type Cluster = {
	name: string;
	color: string; 
	shape: "circle" | "triangle";
	data: { x: number; y: number }[];
};

// Dummy data
const clusters: Cluster[] = [
	{
		name: "cluster1",
		color: "red.5",
		shape: "circle",
		data: [
			{ x: 25, y: 20 },
			{ x: 30, y: 22 },
			{ x: 35, y: 18 },
			{ x: 40, y: 25 },
			{ x: 45, y: 30 },
			{ x: 28, y: 15 },
			{ x: 22, y: 12 },
			{ x: 50, y: 28 },
			{ x: 32, y: 19 },
			{ x: 48, y: 31 },
			{ x: 26, y: 24 },
			{ x: 38, y: 27 },
			{ x: 42, y: 29 },
			{ x: 29, y: 16 },
			{ x: 34, y: 23 },
			{ x: 44, y: 33 },
			{ x: 23, y: 14 },
			{ x: 37, y: 26 },
			{ x: 49, y: 34 },
			{ x: 27, y: 17 },
			{ x: 41, y: 32 },
			{ x: 31, y: 21 },
			{ x: 46, y: 35 },
			{ x: 24, y: 13 },
			{ x: 33, y: 22 },
			{ x: 39, y: 28 },
			{ x: 47, y: 30 },
			{ x: 36, y: 25 },
			{ x: 43, y: 29 },
			{ x: 21, y: 11 },
		],
	},
	{
		name: "cluster2",
		color: "blue.5",
		shape: "triangle",
		data: [
			{ x: 26, y: 21 },
			{ x: 31, y: 24 },
			{ x: 37, y: 19 },
			{ x: 42, y: 27 },
			{ x: 29, y: 32 },
			{ x: 35, y: 18 },
			{ x: 40, y: 23 },
			{ x: 45, y: 30 },
			{ x: 27, y: 15 },
			{ x: 33, y: 20 },
			{ x: 38, y: 25 },
			{ x: 43, y: 29 },
			{ x: 30, y: 16 },
			{ x: 36, y: 22 },
			{ x: 41, y: 28 },
			{ x: 46, y: 33 },
			{ x: 28, y: 17 },
			{ x: 34, y: 22 },
			{ x: 39, y: 26 },
			{ x: 44, y: 31 },
			{ x: 32, y: 18 },
			{ x: 38, y: 23 },
			{ x: 43, y: 28 },
			{ x: 48, y: 35 },
			{ x: 25, y: 14 },
			{ x: 31, y: 20 },
			{ x: 36, y: 25 },
			{ x: 41, y: 30 },
			{ x: 29, y: 16 },
		],
	},
];

// Color palette
const pallet = new Map([
	["red.5", "#fa5252"],
	["blue.5", "#339af0"],
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
		const x = d3
			.scaleLinear()
			.domain(d3.extent(points, (d) => d.x) as [number, number])
			.nice()
			.range([margin.left, width - margin.right]);
		const y = d3
			.scaleLinear()
			.domain(d3.extent(points, (d) => d.y) as [number, number])
			.nice()
			.range([height - margin.bottom, margin.top]);

		// clean slate
		const svg = d3.select(svgRef.current);
		svg.selectAll("*").remove();
		svg.attr("viewBox", `0 0 ${width} ${height}`);

		// axes
		svg
			.append("g")
			.attr("transform", `translate(0,${height - margin.bottom})`)
			.call(d3.axisBottom(x));
		svg.append("g").attr("transform", `translate(${margin.left},0)`).call(d3.axisLeft(y));

		// points layer
		const gPoints = svg.append("g").attr("class", "points");

		gPoints
			.selectAll("circle")
			.data(points)
			.enter()
			.append("circle")
			.attr("r", 4)
			.attr("cx", (d) => x(d.x))
			.attr("cy", (d) => y(d.y))
			.attr("fill", (d) => d.color)
			.attr("stroke", "white")
			.attr("stroke-width", 1);

		// Zoom + pan
		const zoomed = (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
			const transform = event.transform;
			const zx = transform.rescaleX(x);
			const zy = transform.rescaleY(y);

			svg
				.select<SVGGElement>(".points")!
				.selectAll("circle")
				.attr("cx", (d: any) => zx(d.x))
				.attr("cy", (d: any) => zy(d.y));

			svg.select<SVGGElement>("g.x-axis")?.call(d3.axisBottom(zx));
			svg.select<SVGGElement>("g.y-axis")?.call(d3.axisLeft(zy));
		};

		svg.call(d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.5, 10]).on("zoom", zoomed));

		// Drag-select
	// 	const brushed = ({ selection }: d3.D3BrushEvent<any>) => {
	// 		if (!selection) return;
	// 		const [[x0, y0], [x1, y1]] = selection;

	// 		const newSel = new Set<string>();
	// 		gPoints.selectAll<SVGCircleElement, any>("circle").classed("selected", function (d) {
	// 			const sel = x0 <= +this.getAttribute("cx")! && +this.getAttribute("cx")! <= x1 && y0 <= +this.getAttribute("cy")! && +this.getAttribute("cy")! <= y1;
	// 			if (sel) newSel.add(d.key);
	// 			return sel;
	// 		});

	// 		setSelected(newSel);
	// 	};

	// 	svg.call(
	// 		(d3.brush() as unknown as d3.BrushBehavior<any>).on("start brush end", brushed).filter((event) => (event as any).shiftKey) // shift-drag only
	// 	);
	}, []);

	// Render
	return (
		<div style={{ border: "1px solid #ddd", borderRadius: 4, padding: 8 }}>
			<div style={{ marginBottom: 8 }}>Selected: {selected.size ? [...selected].join(", ") : "–"}</div>
			<svg ref={svgRef} width="100%" height={460} />
		</div>
	);
}