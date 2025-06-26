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
  invert = false,
) => {
  const scale = ColorScale.create({
    listOrName: scaleName,
    domain: invert ? [maxValue, minValue] : [minValue, maxValue],
  });
  return scale.color;
};

// modified from https://github.com/molstar/molstar/blob/908fff80419baa0dab12b17a1215c7d2f3e18243/src/mol-util/color/color.ts
export function toHexString(hexColor: Color) {
  return "#" + ("000000" + hexColor.toString(16)).slice(-6);
}

// source: https://stackoverflow.com/questions/3942878/how-to-decide-font-color-in-white-or-black-depending-on-background-color
export const highContrastColor = (
  bgColor: string,
  lightColor: string,
  darkColor: string,
  threshold = 0.179,
) => {
  var color = bgColor.charAt(0) === "#" ? bgColor.substring(1, 7) : bgColor;
  var r = parseInt(color.substring(0, 2), 16); // hexToR
  var g = parseInt(color.substring(2, 4), 16); // hexToG
  var b = parseInt(color.substring(4, 6), 16); // hexToB
  var uicolors = [r / 255, g / 255, b / 255];
  var c = uicolors.map((col) => {
    if (col <= 0.03928) {
      return col / 12.92;
    }
    return Math.pow((col + 0.055) / 1.055, 2.4);
  });
  var L = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  return L > threshold ? darkColor : lightColor;
  // return L > 0.21 ? darkColor : lightColor;
};
