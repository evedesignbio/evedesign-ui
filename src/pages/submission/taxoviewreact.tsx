// src/pages/submission/TaxoviewReact.tsx
import "taxoview/dist/taxoview.ce.js"; // registers the custom element
import type * as React from "react"; // ← fixes React.FC / ComponentProps

// inherit the attributes you declared in taxoview.d.ts
export type TaxoviewProps = React.ComponentProps<"taxo-view">;

export const Taxoview: React.FC<TaxoviewProps> = (props) => (
	<taxo-view {...props} /> // no space before ...props
);
