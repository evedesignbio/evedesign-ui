import {
  Badge,
  Button,
  Group,
  Modal,
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
  encodeMutation,
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
  mutationsToMutatedPositions,
  useActiveInstances,
  useBasketInstances,
  useReset,
  useStructureClickHandler,
} from "./reducers.ts";
import { useMemo, useReducer, useState } from "react";
import { Color } from "molstar/lib/mol-util/color";
import toRgb = Color.toRgb;
import fromRgb = Color.fromRgb;
import {
  useAnnotationTracks,
  useLabelRenderer,
  useTooltipStyle,
} from "./elements.tsx";

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

  // current set of active instances: dataSelection.filteredInstances with any
  // potential selections applied
  const { activeInstances, activeIds } = useActiveInstances(dataSelection);

  const [basket, setBasket] = useState(new Set<string>());
  const basketInstances = useBasketInstances(
    enhancedInstances.instances,
    dnaOpen,
    basket,
  );

  const resetSelection = useReset(dispatchDataSelection);
  const structureClickHandler = useStructureClickHandler(dispatchDataSelection);

  // compute positional symbol counts/frequencies for heatmaps from instances;
  // if mutation scan, always use full data matrix
  const matrix = useMatrix(
    dataSelection,
    activeInstances, // supply as argument to avoid recomputation (could be derived again from dataSelection)
    enhancedInstances.designedPositions,
    isMutationScan,
    spec,
  );

  const heatmapAnnotationTracks = useAnnotationTracks(matrix);
  const heatmapTooltipStyle = useTooltipStyle(computedColorScheme);
  const heatmapLabelRenderer = useLabelRenderer(matrix, isMutationScan);

  // TODO: clean this up and derive heatmap properly
  const heatmapColorMap = useMemo(() => {
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
          const [r, g, b] = toRgb(cmap(value!));
          const grey = 0.299 * r + 0.587 * g + 0.114 * b;
          return toHexString(fromRgb(grey, grey, grey));
        } else {
          return toHexString(cmap(value!));
        }
      }
    };
  }, [isMutationScan, dataSelection, matrix]);

  const heatmapClickHandler = useMemo(
    () =>
      ({ locationType, payload, modifiers }: ClickEvent) => {
        if (locationType === "data") {
          const posMapped = matrix.indexToPositions.get(payload.column)!;
          const symbolMapped = matrix.indexToSubstitutions.get(payload.row)!;
          const ref = matrix.ref.get(posMapped)!;

          const mutation = {
            ...decodePosition(posMapped),
            ref: ref,
            to: symbolMapped,
          };

          // for mutation scans, each cell corresponds to a single instance which we can directly select;
          // for regular design runs, we select a mutation filter on the active instance set since
          // we don't have a 1:1 correspondence between mutation and instance
          if (isMutationScan) {
            // curInstance.id = `${row.entity}:${row.ref}${row.pos}${mut.to}`;
            dispatchDataSelection({
              type: "SELECT_INSTANCES",
              source: "MATRIX",
              modifiers: modifiers,
              payload: [encodeMutation(mutation)],
            });
          } else {
            // do not allow to click empty cells
            if (payload.value <= 0) return;

            dispatchDataSelection({
              type: "SELECT_MUTATIONS",
              source: "MATRIX",
              modifiers: modifiers,
              payload: [mutation],
            });
          }
        } else if (locationType === "annotation") {
          // TODO: refactor so we can also reuse for structure click handling
          const posMapped = matrix.indexToPositions.get(payload.column)!;
          const ref = matrix.ref.get(posMapped)!;
          const availableSubs = isMutationScan
            ? [...matrix.substitutions.keys()]
            : [...matrix.substitutions.keys()].filter((subs) => {
                const count =
                  matrix.data[matrix.names.get("counts")!][
                    matrix.positions.get(posMapped)!
                  ][matrix.substitutions.get(subs)!];
                return count !== null && count > 0;
              });

          dispatchDataSelection({
            type: "SELECT_POSITIONS",
            source: "MATRIX",
            modifiers: modifiers,
            payload: [
              {
                ...decodePosition(posMapped),
                ref: ref,
                availableSubs: availableSubs,
              },
            ],
          });
        }
      },
    [matrix, dispatchDataSelection, isMutationScan],
  );

  const heatmapCellSelections = useMemo(() => {
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

  const heatmapColumnSelections = useMemo(() => {
    return [...dataSelection.positions].map(
      (posEnc) => matrix.positions.get(posEnc)!,
    );
  }, [matrix, dataSelection.positions]);

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
          instances={basketInstances}
        />
      </BoxedLayout>
    </Modal>
  );

  // table only shows active instances if selecting from outside panel, otherwise full filteredSet
  const tablePanel = (
    <InstanceTable
      instances={
        !dataSelection.lastEventSource ||
        dataSelection.lastEventSource === "TABLE"
          ? dataSelection.filteredInstances
          : activeInstances
      }
      dataSelection={dataSelection}
      basket={basket}
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
      data={matrix.data[isMutationScan ? 0 : 1]}
      colorMap={heatmapColorMap}
      yLabels={[...matrix.substitutions.keys()]}
      cellWidth="7pt"
      cellHeight="7pt"
      yLabelSpacing="5pt"
      annotationTracks={heatmapAnnotationTracks}
      handleEvent={heatmapClickHandler}
      labelRenderer={heatmapLabelRenderer}
      tooltipStyle={heatmapTooltipStyle}
      selectedCells={heatmapCellSelections}
      selectedColumns={heatmapColumnSelections}
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
            disabled={basket.size === 0}
            onClick={() => {
              dispatchDataSelection({
                type: "SELECT_BASKET",
                source: "BASKET",
                modifiers: null,
                payload: [...basket],
              });
            }}
          >
            Basket
          </Button>
          <Button
            variant={"default"}
            disabled={
              activeInstances.length === 0 ||
              basket.size === enhancedInstances.instances.length
            }
            onClick={() => {
              setBasket(new Set([...basket, ...activeIds]));
            }}
          >
            Add
          </Button>
          <Button
            variant={"default"}
            disabled={basket.size === 0}
            onClick={() => {
              setBasket(
                new Set([...basket].filter((id) => !activeIds.has(id))),
              );
            }}
          >
            Remove
          </Button>
        </Button.Group>
        <Button onClick={toggleDnaOpen} disabled={basket.size === 0}>
          Build DNA...
        </Button>
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
