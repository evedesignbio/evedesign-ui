import { decodePosition, MutationMatrix } from "./data.ts";
import { useMemo } from "react";
import { Stack, Text } from "@mantine/core";
import { LabelData } from "../../components/autowrapheatmap";

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

// const labelRenderer = (labelData: LabelData) => {
//   if (labelData.type === "data") {
//     if (!mutations.data) return null;
//
//     const i = labelData.column!;
//     const j = labelData.row!;
//
//     // guard clauses against label being out of sync with data
//     if (i >= mutations.data[typeIndex].length) {
//       return;
//     }
//
//     const rawEffect = mutations.data[typeIndex][i][j];
//     const effect =
//         rawEffect !== undefined && rawEffect !== null
//             ? rawEffect.toFixed(2)
//             : "n/a";
//
//     // rounding trick: https://stackoverflow.com/questions/11832914/how-to-round-to-at-most-2-decimal-places-if-necessary
//     return (
//         <span>
//           Mutant: <b>{`${wt[i!]} ${pos[i!]} ${subs[j!]}`}</b>
//           <br />
//           Effect: <b>{effect}</b>
//         </span>
//     );
//   } else {
//     return null;
//   }
// };
