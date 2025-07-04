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
import { Button, Menu, Stack, Text } from "@mantine/core";
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
  mutationsToPosMap,
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
import { PosAndAtomInfo } from "../../features/structurepanel";
import { downloadInstances } from "./helpers.tsx";

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
  maxBoundary: 0.99,
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
  maxBoundary: 1.0,
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

const reduceVector = (vec: number[], aggFunc: AggregationFunc) => {
  if (vec.length === 0) {
    return null;
  }

  switch (aggFunc) {
    case "sum":
      return vec.reduce((sum, x) => sum + x);
    case "avg":
      return vec.reduce((sum, x) => sum + x) / vec.length;
    case "min":
      return Math.min(...vec);
    case "max":
      return Math.max(...vec);
    case "entropy":
      // use same calculation (normalized case) as here:
      // https://github.com/debbiemarkslab/EVcouplings/blob/75bfc9677fc9412ddb7089a9f26c7a01f65bfa12/evcouplings/utils/calculations.py#L11
      //     X_ = X[X > 0]
      //     H = -np.sum(X_ * np.log2(X_))
      //
      //     if normalize:
      //         return 1 - (H / np.log2(len(X)))
      //     else:
      //         return H

      // TODO: handle subset/single element case, just return x?
      const X_ = vec.filter((x) => x > 0);
      const H = -X_.map((x) => x * Math.log2(x)).reduce((sum, x) => sum + x);
      return 1 - H / Math.log2(vec.length);
    default:
      throw new Error("Invalid aggregation function selected");
  }
};

export const aggregateMatrixToPositions = (
  matrix: MutationMatrix,
  matrixEntry: string,
  mutations: Set<string>,
  aggFunc: AggregationFunc,
): (number | null)[] => {
  const subMat = matrix.data[matrix.names.get(matrixEntry)!];

  // create mapping from position to any mutation filters to apply
  const slicedPos = mutationsToPosMap(mutations);

  return subMat.map((posVec, posIdx) => {
    // get full position info corresponding to index
    const pos = matrix.indexToPositions.get(posIdx)!;

    let posVecFilt: number[];
    if (slicedPos.has(pos)) {
      const acceptable = slicedPos.get(pos)!;
      // filter vector down to selected symbols and non-null entries
      posVecFilt = posVec.filter(
        (value, symbolIdx) =>
          value !== null &&
          acceptable.includes(matrix.indexToSubstitutions.get(symbolIdx)!),
      ) as number[];
    } else {
      // in case of summation (only for frequencies), only use non-WT scores
      if (aggFunc === "sum") {
        posVecFilt = posVec.filter((value, symbolIdx) => {
          const ref = matrix.ref.get(pos);
          return (
            value !== null &&
            matrix.indexToSubstitutions.get(symbolIdx)! !== ref
          );
        }) as number[];
      } else {
        // otherwise only filter null values
        posVecFilt = posVec.filter((value) => value !== null);
      }
    }

    return reduceVector(posVecFilt, aggFunc);
  });
};

export const useStructureStyles = (
  matrix: MutationMatrix,
  isMutationScan: boolean,
  dataSelection: DataInteractionReducerState,
  activeInstances: SystemInstanceSpecEnhanced[],
  colorMapCallback: ColorMapCallbackWithNull,
) => {
  return useMemo(() => {
    // compute positional averages of scores for coloring (all or subset of symbols)
    const matrixEntry = isMutationScan ? "scores" : "freqs";

    const matrixAgg = aggregateMatrixToPositions(
      matrix,
      matrixEntry,
      isMutationScan ? dataSelection.instances : dataSelection.mutations,
      isMutationScan ? "avg" : "sum",
    );

    // show spheres for any clicked mutation (encoded by instances for mutation scan)
    const highlightPos = new Set(
      mutationsToMutatedPositions(
        isMutationScan ? dataSelection.instances : dataSelection.mutations,
      ),
    );

    // grey out last selected position for mutation selection (not in single mutation scan)
    // grey out last selected pos? - but looks confusing in grey
    // const lastMutPos = new Set(
    //     mutationsToMutatedPositions(dataSelection.mutations).slice(-1),
    // );

    // discarding entity information here for now
    const selectedPosStyling = [...highlightPos].map((posEnc) => {
      const posDec = decodePosition(posEnc);
      let color = colorMapCallback(matrixAgg[matrix.positions.get(posEnc)!]);
      // if (lastMutPos.has(posEnc)) {
      //   color = toGrayScale(color);
      // }
      return {
        pos: posDec.pos,
        representationId: `${posDec.pos}_sphere_${toHexString(color)}`,
        props: {
          type: "spacefill",
          color: "uniform",
          colorParams: {
            value: color,
          },
        },
      };
    });

    // highlight changed positions as ball and sticks for single selected sequence
    let mutatedPosStyling: SiteHighlightTargetPos[] = [];
    if (!isMutationScan && dataSelection.instances.size === 1) {
      mutatedPosStyling = activeInstances[0].mutant.map((mutation) => {
        const color = colorMapCallback(
          matrixAgg[
            matrix.positions.get(
              encodePosition({
                entity: mutation.entity,
                pos: mutation.pos,
              }),
            )!
          ],
        );
        return {
          pos: mutation.pos,
          representationId: `${mutation.pos}_ballandstick_${toHexString(color)}`,
          props: {
            type: "ball-and-stick",
            color: "uniform",
            colorParams: {
              value: color,
            },
          },
        };
      });
    }

    // note that pos parameter for structure colormap callbcak currently implies entity == 0
    const colorMap = (pos: number | null) => {
      if (pos === null) {
        return toHexString(colorMapCallback(null));
      } else {
        // position may be valid structure position but not a data position, so need to check here
        // if position is present in data or return null color
        const posIdx = matrix.positions.get(
          encodePosition({ entity: 0, pos: pos }),
        );
        if (posIdx === undefined) {
          return toHexString(colorMapCallback(null));
        } else {
          return toHexString(colorMapCallback(matrixAgg[posIdx]));
        }
      }
    };

    return {
      siteHighlights: [
        ...selectedPosStyling,
        ...mutatedPosStyling,
      ] as SiteHighlightTargetPos[],
      structureColorMap: colorMap,
    };
  }, [
    matrix,
    isMutationScan,
    dataSelection,
    activeInstances,
    colorMapCallback,
  ]);
};

export const useStructureHoverLabelRenderer = (
  matrix: MutationMatrix,
  isMutationScan: boolean,
  dataSelection: DataInteractionReducerState,
  activeInstances: SystemInstanceSpecEnhanced[],
  valueType: string = "freqs",
) =>
  useMemo(() => {
    return (x: PosAndAtomInfo) => {
      const posEnc = encodePosition({ entity: 0, pos: x.pos! });

      // note: might be undefined already, in this case return right away
      const ref = matrix.ref.get(posEnc);
      if (ref === undefined) return <></>;

      // add substitution info if single instance is selected
      let subsInfo = undefined;
      if (!isMutationScan && dataSelection.instances.size === 1) {
        // check if there is a mutation for the current position, otherwise we have ref symbol here
        const subsMut = activeInstances[0].mutant.filter(
          (mutation) => mutation.entity === 0 && mutation.pos === x.pos,
        );

        const subs = subsMut.length === 1 ? subsMut[0].to : ref;

        // retrieve pos index (we know this has to work given we retrieved ref above)
        const posIdx = matrix.positions.get(posEnc)!;
        const value =
          matrix.data[matrix.names.get(valueType)!][posIdx][
            matrix.substitutions.get(subs)!
          ];

        subsInfo = (
          <>
            <Text>
              Subs: <b>{subs}</b>
            </Text>
            <Text>
              % designs:{" "}
              <b>{value !== null ? (value * 100).toFixed(1) : "n/a"}</b>
            </Text>
          </>
        );
      }

      return (
        <div style={{ position: "absolute", top: "20px", left: "20px" }}>
          <Stack gap={0}>
            <Text>
              Pos: <b>{x.pos}</b>
            </Text>
            <Text>
              Ref: <b>{ref}</b>
            </Text>
            {subsInfo}
          </Stack>
        </div>
      );
    };
  }, [matrix, isMutationScan, activeInstances, dataSelection.instances]);

export interface DownloadMenuProps {
  id: string;
  instances: SystemInstanceSpecEnhanced[];
  basket: Set<String> | null;
}

export const InstanceDownloadMenu = ({
  id,
  instances,
  basket,
}: DownloadMenuProps) => {
  return (
    <Menu shadow="md" width={200} position="bottom-start">
      <Menu.Target>
        <Button
          disabled={basket !== null && basket.size === 0}
          variant={"default"}
        >
          Download
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        {["csv", "fasta"].map((format) => (
          <Menu.Item
            key={format}
            onClick={() =>
              downloadInstances(
                instances,
                basket,
                id,
                format as "csv" | "fasta",
              )
            }
          >
            {format.toUpperCase()} format
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
};
