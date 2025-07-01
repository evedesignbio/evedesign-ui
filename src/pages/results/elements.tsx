import {
  decodeMutation,
  decodePosition,
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
import { colorMapFromNameOrList, toHexString } from "../../utils/colormap.ts";
import { Color } from "molstar/lib/mol-util/color";

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

export const useHeatmapColorMap = (
  matrix: MutationMatrix,
  isMutationScan: boolean,
  dataSelection: DataInteractionReducerState,
) =>
  useMemo(() => {
    const cmap = isMutationScan
      ? colorMapFromNameOrList("viridis", -10, 0, false)
      : colorMapFromNameOrList(
          // [0x000000, 0x701069, 0x207fdf, 0x20c9df, 0xffd080,] as ColorListEntry[],
          "blues",
          0,
          1,
          true,
        );

    // only use last selected mutation position for now
    const mutPos = new Set(
      mutationsToMutatedPositions(dataSelection.mutations).slice(-1),
    );

    return (value: number | null, i?: number, _j?: number) => {
      if (value === null) {
        return "#aaaaaa";
      } else {
        const pos = matrix.indexToPositions.get(i!)!;
        if (!isMutationScan && mutPos.has(pos)) {
          // TODO: move to own function
          const [r, g, b] = Color.toRgb(cmap(value!));
          const grey = 0.299 * r + 0.587 * g + 0.114 * b;
          return toHexString(Color.fromRgb(grey, grey, grey));
        } else {
          return toHexString(cmap(value!));
        }
      }
    };
  }, [isMutationScan, dataSelection, matrix]);

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

// export const useHeatmapColumnSelections = (
//   matrix: MutationMatrix,
//   dataSelection: DataInteractionReducerState,
// ) =>
//   useMemo(() => {
//     return [...dataSelection.positions].map(
//       (posEnc) => matrix.positions.get(posEnc)!,
//     );
//   }, [matrix, dataSelection.positions]);
