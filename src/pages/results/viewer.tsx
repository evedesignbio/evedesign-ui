import {
  Badge,
  Button,
  Group,
  Modal,
  Title,
  useComputedColorScheme,
  useMantineTheme,
} from "@mantine/core";
import {
  PipelineApiResult,
  SingleMutationScanApiResult,
} from "../../models/api.ts";
import { DEFAULT_STYLE, StructurePanel } from "../../features/structurepanel";
import { AutowrapHeatmap } from "../../components/autowrapheatmap";
import "./viewer.css";
import {
  ColorMapVariable,
  NATURAL_SEQ_PREFIX,
  useInstances,
  useMatrix,
  useSeqSpaceProjection,
} from "./data.ts";
import { InstanceTable, renderSequenceLabel } from "./table.tsx";
import { useDisclosure } from "@mantine/hooks";
import { DNAGenerationDialog } from "./dna.tsx";
import { BoxedLayout } from "./helpers.tsx";
import {
  dataInteractionReducer,
  emptyDataInteractionState,
  useActiveInstances,
  useBasketInstances,
  useHeatmapClickHandler,
  useReset,
  useScatterPlotSelectionHandler,
  useStructureClickHandler,
} from "./reducers.ts";
import { useEffect, useReducer, useState } from "react";
import {
  ColorVariableSelector,
  InstanceDownloadMenu,
  renderStructureSelectionMenu,
  StructureErrorOverlay,
  StructureLoadingOverlay,
  useAnnotationTracks,
  useColorMapForInstances,
  useColorMapForMatrix,
  useHeatmapCellMarks,
  useHeatmapCellSelections,
  useHeatmapColorMap,
  useHeatmapYLabels,
  useLabelRenderer,
  useStructureHoverLabelRenderer,
  useStructureStyles,
  useTooltipStyle,
} from "./elements.tsx";
import { Tooltip as ReactTooltip } from "react-tooltip";
import { ellipsis } from "../../utils/helpers.ts";
import { Plot } from "../../components/plotly";

export interface AnalysisViewerProps {
  id: string;
  name: string | null;
  results: PipelineApiResult | SingleMutationScanApiResult;
  projectId: string | null;
  isPublic: boolean;
}

const NA_COLOR = 0xaaaaaa;
const NO_COLORMAP_COLOR = 0x008080;
const MAX_NAME_LENGTH = 40;

export const AnalysisViewer = ({
  results,
  id,
  name,
  projectId = null,
  isPublic = false,
}: AnalysisViewerProps) => {
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

  // compute positional symbol counts/frequencies for heatmaps from instances;
  // if mutation scan, always use full data matrix
  const matrix = useMatrix(
    dataSelection,
    activeInstances, // supply as argument to avoid recomputation (could be derived again from dataSelection)
    enhancedInstances.designedPositions,
    isMutationScan,
    spec,
  );

  // derive global colormap for heatmap / 3D structure coloring (individual colors will
  // be derived from this intermediate object)
  const { colorMap } = useColorMapForMatrix(matrix, isMutationScan, NA_COLOR);

  const heatmapAnnotationTracks = useAnnotationTracks(matrix);
  const heatmapTooltipStyle = useTooltipStyle(computedColorScheme);
  const heatmapLabelRenderer = useLabelRenderer(matrix, isMutationScan);
  const heatmapClickHandler = useHeatmapClickHandler(
    matrix,
    dispatchDataSelection,
    isMutationScan,
  );
  const heatmapCellMarks = useHeatmapCellMarks(
    matrix,
    isMutationScan,
    dataSelection,
    enhancedInstances.designedPositions,
    activeInstances,
    spec,
  );
  const heatmapYLabels = useHeatmapYLabels(matrix);
  const heatmapColorMap = useHeatmapColorMap(
    matrix,
    isMutationScan,
    dataSelection,
    colorMap,
  );

  const heatmapCellSelections = useHeatmapCellSelections(
    matrix,
    isMutationScan,
    dataSelection,
  );

  const structureClickHandler = useStructureClickHandler(
    matrix,
    dispatchDataSelection,
    isMutationScan,
  );

  const { structureColorMap, siteHighlights } = useStructureStyles(
    matrix,
    isMutationScan,
    dataSelection,
    activeInstances,
    colorMap,
  );

  const structureHoverLabelRenderer = useStructureHoverLabelRenderer(
    matrix,
    isMutationScan,
    dataSelection,
    activeInstances,
  );

  // @ts-ignore
  const scatterplotClickHandler = useScatterPlotSelectionHandler(
    dispatchDataSelection,
  );

  const [seqSpaceColorVariable, setSeqSpaceColorVariable] =
    useState<ColorMapVariable>("score");

  const { colorMap: seqSpaceColorMap } = useColorMapForInstances(
    enhancedInstances.instances,
    seqSpaceColorVariable,
    NA_COLOR,
    NO_COLORMAP_COLOR,
  );

  const seqSpaceProjectionPoints = useSeqSpaceProjection(
    spec,
    isMutationScan,
    dataSelection,
    activeIds,
    seqSpaceColorMap,
    computedColorScheme === "dark" ? "#444" : "#CCC",
  );

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
          system={spec.system}
          instances={basketInstances}
          parentJobId={id}
          isPublic={isPublic}
          projectId={projectId}
        />
      </BoxedLayout>
    </Modal>
  );

  // table only shows active instances if selecting from outside panel, otherwise full filteredSet
  const tablePanel = (
    <InstanceTable
      instances={
        !dataSelection.lastEventSource ||
        dataSelection.lastEventSource === "TABLE" ||
        dataSelection.instances.size === 1
          ? dataSelection.filteredInstances
          : activeInstances
      }
      dataSelection={dataSelection}
      basket={basket}
      isMutationScan={isMutationScan}
      dispatchDataSelection={dispatchDataSelection}
      colorMap={colorMap}
      spec={spec}
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
      colorCallback={structureColorMap}
      siteHighlights={siteHighlights}
      hoverOverlayRenderer={structureHoverLabelRenderer}
      loadingOverlay={<StructureLoadingOverlay />}
      errorOverlay={<StructureErrorOverlay />}
      selectionMenuRenderer={renderStructureSelectionMenu}
    />
  );

  const heatmapPanel = (
    <AutowrapHeatmap
      data={
        matrix.data[
          isMutationScan
            ? matrix.names.get("scores")!
            : matrix.names.get("freqs")!
        ]
      }
      colorMap={heatmapColorMap}
      yLabels={heatmapYLabels}
      cellWidth="8pt"
      cellHeight="8pt"
      yLabelSpacing="5pt"
      annotationTracks={heatmapAnnotationTracks}
      handleEvent={heatmapClickHandler}
      labelRenderer={heatmapLabelRenderer}
      tooltipStyle={heatmapTooltipStyle}
      selectedCells={heatmapCellSelections}
      markedCells={heatmapCellMarks}
      scrollToElement={heatmapCellSelections.slice(-1)[0]?.column}
    />
  );

  const [_dataRevision, setDataRevision] = useState(1);
  //useEffect(() => {
  //  setDataRevision((rev) => rev + 1);
  //}, [seqSpaceProjectionPoints]);

  // const [selectionMode, { toggle: toggleSelectionMode }] = useDisclosure(false);
  const [selectionMode, setSelectionMode] = useState(false);

  useEffect(() => {
    // const handler = (x: any) => console.log(x.type, x.key);
    const down = (x: any) => {
      console.log("down");
      if (x.key === "Meta") setSelectionMode(true);
    };
    const up = (x: any) => {
      console.log("up");
      if (x.key === "Meta") setSelectionMode(false);
    };
    document.addEventListener("keydown", down);
    document.addEventListener("keyup", up);

    return () => {
      document.removeEventListener("keydown", down);
      document.removeEventListener("keyup", up);
    };
  }, [setSelectionMode]);

  console.log("mode", selectionMode); // TODO: remove
  // TODO: separate out natural and designed sequences into individual traces?
  // TODO: memoize as needed - check again re exact plotly diffing behaviour
  const scatterplotPanel =
    seqSpaceProjectionPoints !== null ? (
      <div className="resizable-viewer-box" style={{ display: "flex" }}>
        <ColorVariableSelector
          colorVariable={seqSpaceColorVariable}
          setColorVariable={setSeqSpaceColorVariable}
        />
        <Plot
          data={[
            {
              x: seqSpaceProjectionPoints.map((point) => point.x),
              y: seqSpaceProjectionPoints.map((point) => point.y),
              ids: seqSpaceProjectionPoints.map((point) => point.id),
              type: "scattergl",
              mode: "markers",
              marker: {
                color: seqSpaceProjectionPoints.map((point) => point.color),
                opacity: seqSpaceProjectionPoints.map((point) =>
                  point.id.startsWith(NATURAL_SEQ_PREFIX) ? 0.2 : 1,
                ),
                line: {
                  color: seqSpaceProjectionPoints.map(
                    (point) => point.outlineColor,
                  ),
                  width: seqSpaceProjectionPoints.map((point) =>
                    point.outlineColor ? 2 : 0,
                  ),
                },
              },
            },
          ]}
          layout={{
            // TODO: background
            plot_bgcolor:
              computedColorScheme === "dark"
                ? theme.colors.dark[7] // cf. https://mantine.dev/styles/css-variables-list/
                : "#ffffff",
            paper_bgcolor:
              computedColorScheme === "dark"
                ? theme.colors.dark[7] // cf. https://mantine.dev/styles/css-variables-list/
                : "#ffffff",
            dragmode: selectionMode ? "select" : "pan", // "pan"
            autosize: true,
            xaxis: {
              showline: false,
              zeroline: false,
              showgrid: false,
              uirevision: 1,
            },
            yaxis: {
              showline: false,
              zeroline: false,
              showgrid: false,
              uirevision: 1,
            },
            margin: {
              b: 0,
              l: 0,
              r: 0,
              t: 0,
            },
            hovermode: "closest",
            hoverlabel: { bgcolor: "#333333" },
            showlegend: false,
            // modebar: {
              // uirevision: uiRevision,
            // },
            // uirevision: 1, // don't reset on select
            // selections: [],
            // datarevision: dataRevision,  // TODO -------- reset this?!?!
          }}
          useResizeHandler={true}
          style={{ width: "100%", height: "100%" }}
          config={{
            displayModeBar: false,
            scrollZoom: true,
            // doubleClick: false
          }}
          onClick={(event: any) => {
            console.log("CLICK"); // TODO: remove
            scatterplotClickHandler(
              event.points?.map((point: any) => point.id),
              {
                alt: event.event.alKey,
                shift: event.event.shiftKey,
                ctrl: event.event.ctrlKey,
                meta: event.event.metaKey,
              },
            );
            // setDataRevision((rev) => rev + 1);
          }}
          onSelected={(event: any) => {
            if (!event) return;
            console.log("event", event); // TODO: remove

            scatterplotClickHandler(
              event.points?.map((point: any) => point.id),
              {
                // TODO: bring modifiers back in if possible
                alt: false, // event.event.alKey,
                shift: false, // event.event.shiftKey,
                ctrl: false, // event.event.ctrlKey,
                meta: false, // event.event.metaKey,
              },
            );
            // update data revision to reset selection drawing for empty selection
            // TODO - seems like rerender is enough?!
            setDataRevision((rev) => rev + 1);
          }}
          // onSelected={(event: any) => console.log("selected", event)}
        />
      </div>
    ) : null;

  // TODO: factor this out into own component
  const menuPanel = (
    <>
      <Group>
        {name ? (
          <Title order={4}>{ellipsis(name, MAX_NAME_LENGTH)}</Title>
        ) : null}
        <Badge variant={"outline"}>
          {spec.key.replace("_", " ").replace("_", " ")}
        </Badge>
      </Group>
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
        <InstanceDownloadMenu
          id={id}
          instances={enhancedInstances.instances}
          basket={basket}
        />
        <Button onClick={toggleDnaOpen} disabled={basket.size === 0}>
          Build DNA...
        </Button>
      </Group>
    </>
  );

  // note: tooltip rendered here to be on top of other components
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
          {scatterplotPanel}
        </div>
      </div>
      <ReactTooltip
        id="tableViewer"
        render={renderSequenceLabel}
        style={heatmapTooltipStyle}
      />
    </>
  );
};
