declare module "taxoview/dist/taxoview.ce.js";

import type React from "react";

declare global {
  namespace React {
	namespace JSX {
    interface IntrinsicElements {
			"taxo-view": {
				"raw-data": string;
				// + any other attributes
			} & React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
		}
	}
}
}

export {};
