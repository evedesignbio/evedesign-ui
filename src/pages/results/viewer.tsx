import {
  Badge,
  Button,
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
import { ModifiersKeys } from "molstar/lib/mol-util/input/input-observer";
import { AtomInfo } from "../../components/structureviewer/molstar-utils.tsx";
import { PositionColorCallback } from "../../utils/colormap.ts";
import { SiteHighlightTargetPos } from "../../features/structurepanel/data.ts";
import { AutowrapHeatmap, ClickEvent } from "../../components/autowrapheatmap";
import "./viewer.css";
import { useInstances } from "./data.ts";
import { InstanceTable } from "./table.tsx";
import { useDisclosure } from "@mantine/hooks";
import { DNAGenerationDialog } from "./dna.tsx";
import { BoxedLayout } from "./helpers.tsx";

export interface AnalysisViewerProps {
  id: string;
  results: PipelineApiResult | SingleMutationScanApiResult;
}

const handleClick = (
  pos: number | null,
  modifiers: ModifiersKeys,
  _a: number,
  _b: number,
  ai: AtomInfo[],
) => console.log("clicked", pos, modifiers, ai);

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
function getRandomColor() {
  var letters = "0123456789ABCDEF";
  var color = "#";
  for (var i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

// @ts-ignore
const heatmapColorMap = (value: number | null, i?: number, j?: number) =>
  getRandomColor();

const heatmapClickHandler = ({
  locationType,
  payload,
  modifiers,
}: ClickEvent) => {
  console.log("heatmap click", locationType, payload, modifiers);
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

  // const [downloadFormat, setDownloadFormat] = useState<string | null>(null);
  // create download conditionally to avoid using to many resources in browser
  // const downloadButton = useDownloadButton(results, downloadFormat, id);

  const theme = useMantineTheme();
  const computedColorScheme = useComputedColorScheme("light", {
    getInitialValueInEffect: true,
  });

  const spec = results.spec;
  const isMutationScan = spec.key === "single_mutation_scan";
  const instances = useInstances(results);
  const instancesFilt = instances; // TODO: compute based on selection eventually

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
          instances={instancesFilt}
        />
      </BoxedLayout>
    </Modal>
  );

  const tablePanel = <InstanceTable instances={instances} />;

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
      handleClick={handleClick}
      colorCallback={colorPos}
      siteHighlights={exampleSiteHighlights}
    />
  );

  // if single mutation matrix, create temp visual
  let heatmapPanel = null;
  if (isMutationScan) {
    heatmapPanel = (
      <AutowrapHeatmap
        data={[
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
        ]}
        colorMap={heatmapColorMap}
        yLabels={["a", "b", "c", "d", "e"]}
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
        // selectedCells={transformedSelections.heatmapMuts}
        // selectedColumns={transformedSelections.heatmapPos}
        // selectedRows={transformedSelections.heatmapSubs}
        // scrollToElement={transformedSelections.heatmapJump}
      />
    );
  }

  const menuPanel = (
    <>
      <Badge variant={"outline"}>
        {spec.key.replace("_", " ").replace("_", " ")}
      </Badge>
      <Button onClick={toggleDnaOpen}>Build DNA...</Button>
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
