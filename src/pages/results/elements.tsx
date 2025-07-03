import {
  aggregateMutationMatrix,
  AggregationFunc,
  decodeMutation,
  decodePosition,
  effectPercentile,
  encodePosition,
  instancesToCountMatrix,
  MutationMatrix,
} from "./data.ts";
import { useMemo } from "react";
import { Stack, Text } from "@mantine/core";
import { CellCoords, LabelData } from "../../components/autowrapheatmap";
import {
  PipelineSpec,
  Position,
  SingleMutationScanSpec,
  SystemInstanceSpecEnhanced,
} from "../../models/design.ts";
import {
  DataInteractionReducerState,
  mutationsToMutatedPositions,
} from "./reducers.ts";
import {
  ColorBarParams,
  ColorBarSpec,
  ColorMapBoundaryType,
  ColorMapCallback,
  ColorMapCallbackWithNull,
  colorMapFromNameOrList,
  ColorMapParams,
  toGrayScale,
  toHexString,
} from "../../utils/colormap.ts";
import { SiteHighlightTargetPos } from "../../features/structurepanel/data.ts";
import { Color } from "molstar/lib/mol-util/color";

// Per-effect score visualization properties
export interface ScoreParameters {
  // name of score in data file
  key: string;
  // priority of score in automatic score selection (lower number is higher priority)
  priority: number;
  // display name of score
  displayName: string;
  // display group of score (used in score selection dialog)
  group: string;
  // colormap to use for visualization of score
  colorMap?: ColorMapParams;
  // if true, allow to override score-specific colormap with
  // global default based on UI setting
  allowDefaultColorMap: boolean;
  // parameters for corresponding colobar
  colorBar?: ColorBarParams;
  // only show in expert mode?
  expertModeOnly: boolean;
}

export const useAnnotationTracks = (matrix: MutationMatrix) => {
  return useMemo(
    () => [
      {
        id: "spacer_above",
        above: true,
        height: "10pt",
      },
      {
        id: "spacer_below",
        above: false,
        height: "5pt",
      },
      {
        id: "xlabel",
        above: false,
        height: "30pt",
        yLabel: "",
        render: (i: number, selected: boolean) => {
          const pos = matrix.indexToPositions.get(i)!;
          const posDec = decodePosition(pos);
          const ref = matrix.ref.get(pos)!;

          // note background color is set on complete flexbox column div
          return (
            <div
              style={{
                width: "100%",
                height: "100%",
                // color: "white",
                display: "flex",
                alignItems: "center", // keep
                justifyContent: "flex-end",
                // alignItems: "flex-top",
                fontSize: "7pt",
                fontWeight: selected ? "bold" : "normal",
                // color: selected ? "white" : "black",  // TODO: dynamic based on color theme - or not needed?
                writingMode: "vertical-lr",
                // verticalAlign: "top",
                transform: "rotate(180deg)",
                cursor: "default",
                // backgroundColor: "yellow",
              }}
            >
              <span>
                {ref} {posDec.pos}
              </span>
            </div>
          );
        },
      },
    ],
    [],
  );
};

export const useTooltipStyle = (computedColorScheme: "dark" | "light") => {
  return useMemo(
    () => ({
      backgroundColor: computedColorScheme === "dark" ? "#fff" : "#000",
      color: computedColorScheme === "dark" ? "#000" : "#fff",
      zIndex: 9999,
    }),
    [computedColorScheme],
  );
};

export const useLabelRenderer = (
  matrix: MutationMatrix,
  isMutationScan: boolean,
) => {
  return useMemo(() => {
    return (labelData: LabelData) => {
      const pos = matrix.indexToPositions.get(labelData.column!)!;
      const posDec = decodePosition(pos);
      const ref = matrix.ref.get(pos)!;

      if (labelData.type === "data") {
        const subs = matrix.indexToSubstitutions.get(labelData.row!);

        let value = "n/a";
        if (labelData.value !== null && labelData.value !== undefined) {
          if (isMutationScan) {
            value = labelData.value.toFixed(2);
          } else {
            value = (labelData.value * 100).toFixed(1);
          }
        }

        return (
          <Stack gap={0}>
            <Text size="sm">
              Pos: <b>{posDec.pos}</b>
            </Text>
            <Text size="sm">
              Ref: <b>{ref}</b>
            </Text>
            <Text size="sm">
              Subs: <b>{subs}</b>
            </Text>
            <Text size="sm">
              {isMutationScan ? "Score" : "% designs"}: <b>{value}</b>
            </Text>
          </Stack>
        );
      } else if (labelData.type === "annotation") {
        return (
          <Stack gap={0}>
            <Text size="sm">
              Pos: <b>{posDec.pos}</b>
            </Text>
            <Text size="sm">
              Ref: <b>{ref}</b>
            </Text>
          </Stack>
        );
      } else return null;
    };
  }, [matrix, isMutationScan]);
};

export const useHeatmapCellMarks = (
  matrix: MutationMatrix,
  isMutationScan: boolean,
  dataSelection: DataInteractionReducerState,
  designedPositions: Position[],
  activeInstances: SystemInstanceSpecEnhanced[],
  spec: PipelineSpec | SingleMutationScanSpec,
): CellCoords[] =>
  useMemo(() => {
    if (isMutationScan || dataSelection.instances.size !== 1) {
      return [];
    } else {
      // use counts on single selected sequence as indicators to derive heatmap indices
      const countMatrix = instancesToCountMatrix(
        activeInstances,
        null,
        designedPositions,
        0,
        spec.system[0].rep,
        spec.system[0].first_index,
        false,
      );
      const counts = countMatrix.data[countMatrix.names.get("counts")!];

      return counts.map((posArray, posIdx) => {
        const rowIdx = posArray.findIndex(
          (symbolCount) => symbolCount !== null && symbolCount > 0,
        );
        return { column: posIdx, row: rowIdx };
      });
    }
  }, [
    matrix,
    isMutationScan,
    dataSelection.instances,
    designedPositions,
    designedPositions,
    spec,
  ]);

export const useHeatmapYLabels = (matrix: MutationMatrix) =>
  useMemo(() => [...matrix.substitutions.keys()], [matrix.substitutions]);

export const useHeatmapCellSelections = (
  matrix: MutationMatrix,
  isMutationScan: boolean,
  dataSelection: DataInteractionReducerState,
) =>
  useMemo(() => {
    const sourceSelection = isMutationScan
      ? dataSelection.instances
      : dataSelection.mutations;

    return [...sourceSelection].map((mutStr) => {
      const mutDecoded = decodeMutation(mutStr);
      return {
        column: matrix.positions.get(
          encodePosition({ entity: mutDecoded.entity, pos: mutDecoded.pos }),
        ),
        row: matrix.substitutions.get(mutDecoded.to)!,
      } as CellCoords;
    });
  }, [matrix, dataSelection.mutations, dataSelection.instances]);

/**
 * Select one representative effect per position in the mutation matrix, either
 * by aggregating values or selecting one global substitution
 * @param mutations Full mutation matrix
 * @param mutationPredictionType Selected submatrix
 * @param aggFunc Aggregation function to apply
 * @param substitution Selected global substitution, will override aggregation function if defined
 * @returns Position-wise effect (aggregated or fixed substitution)
 */
export const computePositionEffect = (
  mutations: MutationMatrix,
  mutationPredictionType: string,
  aggFunc: AggregationFunc,
  substitution: string | undefined,
) => {
  // selected substitution overrides aggregation function
  if (substitution) {
    return mutations.data[mutations.names.get(mutationPredictionType)!]!.map(
      (posVector) => posVector[mutations.substitutions.get(substitution)!],
    );
  } else {
    return aggregateMutationMatrix(mutations, mutationPredictionType, aggFunc);
  }
};

/**
 * Derive colormap based on score specification
 * @param mutations Full mutation matrix
 * @param verifiedMutationPredictionType Currently selected prediction score
 * @param defaultColorMap Default color map
 * @param overrideWithDefault If true, override score-specific colormap with defaultColorMap
 * @param scoreParams Prediction-score specific settings (used to extract score-specific colormap)
 * @returns Mapping function from value to color
 */
export const deriveColorMap = (
  mutations: MutationMatrix,
  verifiedMutationPredictionType: string,
  defaultColorMap: ColorMapParams,
  overrideWithDefault = false,
  scoreParams?: ScoreParameters[],
) => {
  // extract params for currently selected score (if available)
  const selectedScoreParams = scoreParams
    ?.filter((p) => p.key === verifiedMutationPredictionType)
    .at(0);

  const selectedColorMap =
    selectedScoreParams && selectedScoreParams.colorMap && !overrideWithDefault
      ? selectedScoreParams.colorMap
      : defaultColorMap;

  // helper function to avoid code repetition
  const getBoundary = (boundaryType: ColorMapBoundaryType, boundary: number) =>
    boundaryType === "fixed"
      ? boundary
      : effectPercentile(mutations, verifiedMutationPredictionType, boundary);

  // derive colorbar information first, if settings for it are present
  let colorBarSpec = undefined;
  if (selectedColorMap.colorBarParams) {
    if (
      selectedColorMap.colorBarParams.maxBoundary === undefined ||
      selectedColorMap.colorBarParams.maxBoundaryType === undefined ||
      selectedColorMap.colorBarParams.minBoundary === undefined ||
      selectedColorMap.colorBarParams.minBoundaryType === undefined
    ) {
      throw new Error("Colorbar specification is incomplete");
    }

    colorBarSpec = {
      ...selectedColorMap.colorBarParams,
      minBoundaryValue: getBoundary(
        selectedColorMap.colorBarParams.minBoundaryType,
        selectedColorMap.colorBarParams.minBoundary,
      ),
      maxBoundaryValue: getBoundary(
        selectedColorMap.colorBarParams.maxBoundaryType,
        selectedColorMap.colorBarParams.maxBoundary,
      ),
      // determine data min/max in any case
      minDataValue: getBoundary("percentile", 0),
      maxDataValue: getBoundary("percentile", 1),
    } as ColorBarSpec;
  }

  // check if we got supplied with a mapping function or need to derive the colormap ourselves
  if (typeof selectedColorMap.colorScale === "function") {
    // if function, return right away (range etc. expected to be specified by user outisde)
    return {
      colorMap: selectedColorMap.colorScale,
      colorBarSpec: colorBarSpec,
    };
  } else {
    // check if all necessary attributes are defined
    if (
      selectedColorMap.maxBoundary === undefined ||
      selectedColorMap.maxBoundaryType === undefined ||
      selectedColorMap.minBoundary === undefined ||
      selectedColorMap.minBoundaryType === undefined ||
      selectedColorMap.invert === undefined
    ) {
      throw new Error("Colormap specification is incomplete");
    }
    // derive min/max values for color map range
    const rangeMin = getBoundary(
      selectedColorMap.minBoundaryType,
      selectedColorMap.minBoundary,
    );

    const rangeMax = getBoundary(
      selectedColorMap.maxBoundaryType,
      selectedColorMap.maxBoundary,
    );

    // create colormap
    return {
      colorMap: colorMapFromNameOrList(
        selectedColorMap.colorScale,
        rangeMin,
        rangeMax,
        selectedColorMap.invert,
      ),
      colorBarSpec: colorBarSpec,
    };
  }
};

// default color map (if not specified on a per-score basis)
const COLOR_MAP_SETTINGS_SCAN: ColorMapParams = {
  colorScale: "viridis",
  minBoundaryType: "percentile",
  minBoundary: 0.05,
  maxBoundaryType: "percentile",
  maxBoundary: 0.95,
  invert: false,
  colorBarParams: {
    minBoundaryType: "percentile",
    minBoundary: 0.05,
    maxBoundaryType: "percentile",
    maxBoundary: 0.95,
    displayDataRange: false,
  },
};

const COLOR_MAP_SETTINGS_PIPELINE: ColorMapParams = {
  colorScale: "blues",
  // minBoundaryType: "percentile",
  // minBoundary: 0.05,
  // maxBoundaryType: "percentile",
  // maxBoundary: 0.95,
  minBoundaryType: "fixed",
  minBoundary: 0,
  maxBoundaryType: "fixed",
  maxBoundary: 0.7,
  invert: true,
  colorBarParams: {
    minBoundaryType: "percentile",
    minBoundary: 0.05,
    maxBoundaryType: "percentile",
    maxBoundary: 0.95,
    displayDataRange: false,
  },
};

export const useColorMap = (
  matrix: MutationMatrix,
  isMutationScan: boolean,
  naColor: number,
) => {
  return useMemo(() => {
    const { colorMap, colorBarSpec } = deriveColorMap(
      matrix,
      isMutationScan ? "scores" : "freqs",
      isMutationScan ? COLOR_MAP_SETTINGS_SCAN : COLOR_MAP_SETTINGS_PIPELINE,
      false,
      undefined, // specify this parameter to dynamically derive color map params from object
    );

    return {
      // wrap for null/NA value handling
      colorMap: ((value: number | null): Color => {
        if (value === null) {
          return Color(naColor);
        } else {
          return colorMap(value);
        }
      }) as ColorMapCallbackWithNull,
      colorBarSpec: colorBarSpec,
    };
  }, [matrix, isMutationScan]);
};

export const useHeatmapColorMap = (
  matrix: MutationMatrix,
  isMutationScan: boolean,
  dataSelection: DataInteractionReducerState,
  colorMapCallback: ColorMapCallback,
) =>
  // TODO: apply log for design runs?
  useMemo(() => {
    // only use last selected mutation position for now
    const mutPos = new Set(
      mutationsToMutatedPositions(dataSelection.mutations).slice(-1),
    );

    return (value: number | null, i?: number, _j?: number) => {
      // const valueTransformed = isMutationScan ? value : Math.log2(value + 0.0001);
      // console.log(valueTransformed, Math.log2(0.0001));
      const valueTransformed = value!;

      const pos = matrix.indexToPositions.get(i!)!;
      const color = colorMapCallback(valueTransformed!);
      if (!isMutationScan && mutPos.has(pos)) {
        return toHexString(toGrayScale(color));
      } else {
        return toHexString(color);
      }
    };
  }, [isMutationScan, dataSelection, matrix]);

export const aggregateMatrixToPositions = (
  matrix: MutationMatrix,
  matrixEntry: string,
  _dataSelection: DataInteractionReducerState,
) => {
  const subMat = matrix.data[matrix.names.get(matrixEntry)!];
  // TODO: skip na values
  // TODO: apply log for design runs?
  // TODO: best way to average? how done for popEVE?
  // TODO: greying out last position?
  return subMat.map((_posVec, posIdx) => posIdx / 263);
};

export const useStructureStyles = (
  matrix: MutationMatrix,
  isMutationScan: boolean,
  dataSelection: DataInteractionReducerState,
  activeInstances: SystemInstanceSpecEnhanced[],
  colorMapCallback: ColorMapCallbackWithNull,
) => {
  // compute positional averages of scores for coloring (all or subset of symbols)
  // TODO: allow flexible aggregation type?
  const matrixEntry = isMutationScan ? "scores" : "freqs";

  const matrixAgg = aggregateMatrixToPositions(
    matrix,
    matrixEntry,
    dataSelection,
  );

  // show spheres for any clicked mutation (encoded by instances for mutation scan)
  const highlightPos = new Set(
    mutationsToMutatedPositions(
      isMutationScan ? dataSelection.instances : dataSelection.mutations,
    ),
  );

  // TODO: need to average selection for color
  // discarding entity information here for now
  const selectedPosStyling = [...highlightPos].map((posEnc) => {
    const posDec = decodePosition(posEnc);
    return {
      pos: posDec.pos,
      representationId: `${posDec.pos}_sphere`,
      props: {
        type: "spacefill",
        color: "uniform",
        colorParams: {
          value: colorMapCallback(matrixAgg[matrix.positions.get(posEnc)!]),
        },
      },
    };
  });

  // highlight changed positions as ball and sticks for single selected sequence
  let mutatedPosStyling: SiteHighlightTargetPos[] = [];
  if (!isMutationScan && dataSelection.instances.size === 1) {
    mutatedPosStyling = activeInstances[0].mutant.map((mutation) => ({
      pos: mutation.pos,
      representationId: `${mutation.pos}_ballandstick`,
      props: {
        type: "ball-and-stick",
        color: "uniform",
        colorParams: {
          value: colorMapCallback(
            matrixAgg[
              matrix.positions.get(
                encodePosition({ entity: mutation.entity, pos: mutation.pos }),
              )!
            ],
          ),
        },
      },
    }));
  }

  // note that pos parameter for structure colormap callbcak currently implies entity == 0
  const colorMap = (pos: number | null) => {
    if (pos === null) {
      return toHexString(colorMapCallback(null));
    } else {
      // map position to matrix index
      const posIdx = matrix.positions.get(
        encodePosition({ entity: 0, pos: pos }),
      )!;
      return toHexString(colorMapCallback(matrixAgg[posIdx]));
    }
  };

  return {
    siteHighlights: [
      ...selectedPosStyling,
      ...mutatedPosStyling,
    ] as SiteHighlightTargetPos[],
    structureColorMap: colorMap,
  };
};
