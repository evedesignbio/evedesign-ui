/*
    Color map utilties, making use of Molstars built-in colormaps
*/
import { ColorScale } from "molstar/lib/mol-util/color";
import { ColorListName } from "molstar/lib/mol-util/color/lists";
import { Color, ColorListEntry } from "molstar/lib/mol-util/color/color";

// export type { Color };
// const scale = ColorScale.create({
//   listOrName: "turbo",
//   minLabel: "Start",
//   maxLabel: "End",
// });
// scale.setDomain(1, 10);
// return scale.color(curColorValue);

export type PositionColorCallback = (pos: number | null) => string;
export type ColorMapCallback = (value: number) => Color;
export type ColorMapCallbackWithNull = (value: number | null) => Color;
export type ColorMapCallbackWithNullHex = (value: number | null) => string;
export type ColorMapScaleNoFunction = ColorListEntry[] | ColorListName;
export type ColorMapScale = ColorMapCallback | ColorMapScaleNoFunction;

export type ColorMapBoundaryType = "fixed" | "percentile";

// colormap settings for default and per-score coloring
export type ColorMapParams = {
  colorScale: ColorMapScale;
  // following attributes not needed if specifying function (ColorMapCallback)
  minBoundaryType?: ColorMapBoundaryType;
  minBoundary?: number;
  maxBoundaryType?: ColorMapBoundaryType;
  maxBoundary?: number;
  invert?: boolean;
  colorBarParams?: ColorBarParams;
};

export type ColorBarParams = {
  minBoundaryType: ColorMapBoundaryType;
  minBoundary: number;
  maxBoundaryType: ColorMapBoundaryType;
  maxBoundary: number;
  displayDataRange: boolean;
};

export type ColorBarSpec = ColorBarParams & {
  minBoundaryValue: number;
  maxBoundaryValue: number;
  minDataValue: number;
  maxDataValue: number;
};

// for color options, see here: https://github.com/molstar/molstar/blob/908fff80419baa0dab12b17a1215c7d2f3e18243/src/mol-util/color/lists.ts
export const colorMapFromNameOrList = (
  scaleName: ColorListEntry[] | ColorListName,
  minValue: number,
  maxValue: number,
  invert = false
) => {
  const scale = ColorScale.create({
    listOrName: scaleName,
    domain: invert ? [maxValue, minValue] : [minValue, maxValue],
  });
  return scale.color;
};
