import { decodePosition, MutationMatrix } from "./data.ts";
import { useMemo } from "react";

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
