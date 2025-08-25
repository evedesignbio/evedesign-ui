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
import ScatterPlot from "../../components/scatterplot";
import "./viewer.css";
import { useInstances, useMatrix } from "./data.ts";
import { InstanceTable, renderSequenceLabel } from "./table.tsx";
import { useDisclosure } from "@mantine/hooks";
import { DNAGenerationDialog } from "./dna.tsx";
import { BoxedLayout } from "./helpers.tsx";
import {
  dataInteractionReducer,
  emptyDataInteractionState,
  NATURAL_SEQ_PREFIX,
  useActiveInstances,
  useBasketInstances,
  useHeatmapClickHandler,
  useReset,
  useScatterPlotSelectionHandler,
  useStructureClickHandler,
} from "./reducers.ts";
import { useMemo, useReducer, useState } from "react";
import {
  InstanceDownloadMenu,
  renderStructureSelectionMenu,
  StructureErrorOverlay,
  StructureLoadingOverlay,
  useAnnotationTracks,
  useColorMap,
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

export interface AnalysisViewerProps {
  id: string;
  name: string | null;
  results: PipelineApiResult | SingleMutationScanApiResult;
  projectId: string | null;
  isPublic: boolean;
}

const NA_COLOR = 0xaaaaaa;
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
  const { colorMap } = useColorMap(matrix, isMutationScan, NA_COLOR);

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

  const scatterplotClickHandler = useScatterPlotSelectionHandler(
    dispatchDataSelection,
  );

  // TODO: move this to its own hook eventually
  const seqSpacePoints = useMemo(() => {
    // nothing interesting to show for single mutation scans as all mutants have same distance
    if (isMutationScan) {
      return null;
    }

    // TODO: active instance handling
    // TODO: selection handling
    // TODO: show natural sequences, but they can't be selected
    const instPoints = enhancedInstances.instances.map((instance) => ({
      id: instance.id,
      x: instance.metadata?.seqspace_projection![0]!, // TODO proper defined checking here
      y: instance.metadata?.seqspace_projection![1]!, // TODO proper defined checking here
      color: activeIds.has(instance.id) ? "#ffff00" : "#ffffff",
      shape: "circle",
      size: 1,
      transparency: 0.5,
      // outlineColor: "#ff0000",
      tooltipData: { ID: instance.id },
    }));

    // TODO: needs to have much better checking of whether things are defined
    const naturalPoints = spec.system[0].sequences.seqs.map(
      (seq, idx: number) => ({
        id: `${NATURAL_SEQ_PREFIX}_${idx}`,
        x: seq.metadata!.seqspace_projection![0]!,
        y: seq.metadata!.seqspace_projection![1]!,
        color: "#555",
        shape: "circle",
        size: 1,
        transparency: 0.5,
        // outlineColor: "#ff0000",
        tooltipData: { ID: seq.id },
      }),
    );

    return [...naturalPoints, ...instPoints];
  }, [isMutationScan, enhancedInstances]);

  // TODO: only render when we have projection, need to handle div below properly
  const scatterplotPanel =
    seqSpacePoints !== null ? (
      <ScatterPlot
        points={seqSpacePoints}
        showHistogram={false}
        handleEvent={scatterplotClickHandler}
      />
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
          {scatterplotPanel ? (
            <div className="resizable-viewer-box">{scatterplotPanel}</div>
          ) : null}
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
