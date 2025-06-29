import {
  Badge,
  Button,
  Group,
  Modal,
  Text,
  useComputedColorScheme,
  useMantineTheme,
} from "@mantine/core";
import {
  PipelineApiResult,
  SingleMutationScanApiResult,
} from "../../models/api.ts";
import { DEFAULT_STYLE, StructurePanel } from "../../features/structurepanel";
import {
  colorMapFromNameOrList,
  PositionColorCallback,
  toHexString,
} from "../../utils/colormap.ts";
import { SiteHighlightTargetPos } from "../../features/structurepanel/data.ts";
import {
  AutowrapHeatmap,
  CellCoords,
  ClickEvent,
} from "../../components/autowrapheatmap";
import "./viewer.css";
import {
  decodeMutation,
  decodePosition,
  encodePosition,
  useInstances,
  useMatrix,
} from "./data.ts";
import { InstanceTable } from "./table.tsx";
import { useDisclosure } from "@mantine/hooks";
import { DNAGenerationDialog } from "./dna.tsx";
import { BoxedLayout } from "./helpers.tsx";
import {
  dataInteractionReducer,
  emptyDataInteractionState,
  useReset,
  useStructureClickHandler,
} from "./reducers.ts";
import { useMemo, useReducer, useState } from "react";

export interface AnalysisViewerProps {
  id: string;
  results: PipelineApiResult | SingleMutationScanApiResult;
}

const colorPos: PositionColorCallback = (pos: number | null) => {
  if (pos === null) {
    return "#aaaaaa";
  } else {
    if (pos > 30) {
      return "#ff0000";
    } else {
      return "#00ff00";
    }
  }
};

const exampleSiteHighlights: SiteHighlightTargetPos[] = [
  // {
  //   pos: 100,
  //   representationId: "100_sphere",
  //   props: {
  //     type: "spacefill",
  //     color: "uniform",
  //     colorParams: { value: Color(0xfffff) },
  //   },
  // },
  // {
  //   pos: 50,
  //   representationId: "50_sphere",
  //   props: {
  //     type: "spacefill",
  //     color: "uniform",
  //     colorParams: { value: Color(0xaaaaaa) },
  //   },
  // },
];

// https://stackoverflow.com/questions/1484506/random-color-generator
// TODO: remove again once actual data shown
// export function getRandomColor() {
//   var letters = "0123456789ABCDEF";
//   var color = "#";
//   for (var i = 0; i < 6; i++) {
//     color += letters[Math.floor(Math.random() * 16)];
//   }
//   return color;
// }

// // @ts-ignore
// const heatmapColorMap = (value: number | null, i?: number, j?: number) => {
//   return getRandomColor();
//   // const cmap = colorMapFromNameOrList("blues", 0, 1, true);
//   // return toHexString(cmap(value!));
// };

// const heatmapClickHandler = ({
//   locationType,
//   payload,
//   modifiers,
// }: ClickEvent) => {
//   console.log("heatmap click", locationType, payload, modifiers);
// };

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

const annotationTracks = [
  // {
  //   id: "secstruct",
  //   above: true,
  //   height: "45pt",
  //   yLabel: "SS",
  //   render: () => <span>x</span>,
  // },
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
      // if (!mutations.data) return null;

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
            // color: selected ? "white" : "black",  // TODO: dynamic based on color theme
            writingMode: "vertical-lr",
            // verticalAlign: "top",
            transform: "rotate(180deg)",
            cursor: "default",
            // backgroundColor: "yellow",
          }}
        >
          {/*<span>{`${wt[i]} ${*/}
          {/*    positionAlias ? positionAlias(pos[i]) : pos[i]*/}
          {/*}`}</span>*/}
          <span>{i}</span>
        </div>
      );
    },
  },
];

export const AnalysisViewer = ({ results, id }: AnalysisViewerProps) => {
  const [dnaOpen, { toggle: toggleDnaOpen }] = useDisclosure(false);

  const theme = useMantineTheme();
  const computedColorScheme = useComputedColorScheme("light", {
    getInitialValueInEffect: true,
  });

  const spec = results.spec;
  const enhancedInstances = useInstances(results);
  const isMutationScan = spec.key === "single_mutation_scan";

  // initialize reducer for handling interactions between different data visualizations
  const [dataSelection, dispatchDataSelection] = useReducer(
    dataInteractionReducer,
    emptyDataInteractionState(isMutationScan, enhancedInstances.instances),
  );

  const [basket, _setBasket] = useState(new Set<string>());

  const resetSelection = useReset(dispatchDataSelection);
  const structureClickHandler = useStructureClickHandler(dispatchDataSelection);

  // compute positional symbol counts/frequencies for heatmaps from instances
  const matrix = useMatrix(
    dataSelection.filteredInstances,
    enhancedInstances.designedPositions,
    isMutationScan,
    spec,
    dataSelection,
  );

  console.log("SELECTION", dataSelection);   // TODO: remove
  // TODO: remove
  // console.log("INSTANCES", enhancedInstances.instances.slice(0, 5));
  // console.log(
  //   "INSTANCES APPLIED",
  //   filterByMutationSelection(
  //     enhancedInstances.instances.slice(0, 5),
  //     new Set(["0_24_H_E"]),
  //   ),
  // );

  // TODO: clean this up and derive heatmap properly
  const heatmapColorMap = useMemo(() => {
    const cmap = isMutationScan
      ? colorMapFromNameOrList("viridis", -10, 0, false)
      : colorMapFromNameOrList("blues", 0, 1, true);

    return (value: number | null, _i?: number, _j?: number) => {
      if (value === null) {
        return "#aaaaaa";
      } else {
        return toHexString(cmap(value!));
      }
    };
  }, [isMutationScan]);

  const heatmapClickHandler = useMemo(
    () =>
      ({ locationType, payload, modifiers }: ClickEvent) => {
        if (locationType !== "data") return;
        const posMapped = matrix.indexToPositions.get(payload.column)!;
        const symbolMapped = matrix.indexToSubstitutions.get(payload.row)!;
        const ref = matrix.ref.get(posMapped)!;
        dispatchDataSelection({
          type: "SELECT_MUTATIONS",
          source: "MATRIX",
          modifiers: modifiers,
          payload: [
            { ...decodePosition(posMapped), ref: ref, to: symbolMapped },
          ],
        });
      },
    [matrix, dispatchDataSelection],
  );

  const heatmapCellSelections = useMemo(() => {
    return [...dataSelection.mutations].map((mutStr) => {
      const mutDecoded = decodeMutation(mutStr);
      return {
        column: matrix.positions.get(
          encodePosition({ entity: mutDecoded.entity, pos: mutDecoded.pos }),
        ),
        row: matrix.substitutions.get(mutDecoded.to)!,
      } as CellCoords;
    });
  }, [matrix, dataSelection.mutations]);

  const dnaModal = (
    <Modal
      opened={dnaOpen}
      onClose={toggleDnaOpen}
      size={"auto"}
      overlayProps={{
        blur: 3,
      }}
    >
      <BoxedLayout title={"DNA library generation"}>
        <DNAGenerationDialog
          id={id}
          system={spec.system}
          instances={enhancedInstances.instances}
        />
      </BoxedLayout>
    </Modal>
  );

  const tablePanel = (
    <InstanceTable
      instances={dataSelection.filteredInstances}
      dataSelection={dataSelection}
      isMutationScan={isMutationScan}
      instanceRenderType={"sequence"}
      dispatchDataSelection={dispatchDataSelection}
    />
  );

  const structurePanel = (
    <StructurePanel
      structureStyle={DEFAULT_STYLE}
      structureHits={spec.metadata ? spec.metadata.structure_search_result : []}
      firstIndex={spec.system[0].first_index}
      backgroundColor={
        computedColorScheme === "dark"
          ? theme.colors.dark[7] // cf. https://mantine.dev/styles/css-variables-list/
          : "#ffffff" // cf. https://mantine.dev/styles/css-variables-list/
      }
      useFullStructureModel={true}
      useStructureAssembly={true}
      handleClick={structureClickHandler}
      colorCallback={colorPos}
      siteHighlights={exampleSiteHighlights}
    />
  );

  const heatmapPanel = (
    <AutowrapHeatmap
      data={
        matrix !== null
          ? matrix.data[isMutationScan ? 0 : 1]
          : [
              [1, 1, 1, 1, 1],
              [2, 2, 2, 2, 2],
              [1, 1, 1, 1, 1],
              [2, 2, 2, 2, 2],
              [1, 1, 1, 1, 1],
              [2, 2, 2, 2, 2],
              [1, 1, 1, 1, 1],
              [2, 2, 2, 2, 2],
              [1, 1, 1, 1, 1],
              [2, 2, 2, 2, 2],
              [1, 1, 1, 1, 1],
              [2, 2, 2, 2, 2],
            ]
      }
      colorMap={heatmapColorMap}
      yLabels={
        matrix != null
          ? [...matrix.substitutions.keys()]
          : ["a", "b", "c", "d", "e"]
      }
      cellWidth="7pt"
      cellHeight="7pt"
      yLabelSpacing="5pt"
      annotationTracks={annotationTracks}
      handleEvent={heatmapClickHandler}
      labelRenderer={(labelData) => <Text>{labelData.value}</Text>}
      tooltipStyle={{
        backgroundColor: computedColorScheme === "dark" ? "#fff" : "#000",
        color: computedColorScheme === "dark" ? "#000" : "#fff",
        zIndex: 9999,
      }}
      // TODO: selection styling (label backgrounds dynamic on light/dark theme)
      selectedCells={heatmapCellSelections}
      // selectedColumns={transformedSelections.heatmapPos}
      // selectedRows={transformedSelections.heatmapSubs}
      // scrollToElement={transformedSelections.heatmapJump}
    />
  );

  const menuPanel = (
    <>
      <Badge variant={"outline"}>
        {spec.key.replace("_", " ").replace("_", " ")}
      </Badge>
      <Group>
        <Button
          onClick={resetSelection}
          variant={"default"}
          disabled={
            dataSelection.filteredInstances.length ===
            dataSelection.allInstances.length
          }
        >
          Reset filter
        </Button>
        <Button.Group>
          <Button
            variant={"default"}
            rightSection={<Badge>{basket.size}</Badge>}
          >
            Basket
          </Button>
          <Button
            variant={"default"}
            disabled={basket.size === enhancedInstances.instances.length}
          >
            Add
          </Button>
          <Button variant={"default"} disabled={basket.size === 0}>
            Remove
          </Button>
        </Button.Group>
        <Button onClick={toggleDnaOpen}>Build DNA...</Button>
      </Group>
    </>
  );

  return (
    <>
      {dnaModal}
      <div className="outer-wrapper">
        <div className="menubar-wrapper">{menuPanel}</div>
        <div className="resizable-viewer-wrapper">
          <div className="resizable-viewer-box">{tablePanel}</div>
          <div className="resizable-viewer-box">
            <div className="heatmap-wrapper">{heatmapPanel}</div>
          </div>
          <div className="resizable-viewer-box">{structurePanel}</div>
        </div>
      </div>
    </>
  );
};
