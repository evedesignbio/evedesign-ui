import { useEffect, useMemo, useState } from "react";
import { ColorVariableSelector, useColorMapForInstances } from "./elements.tsx";
import { Plot } from "../../components/plotly";
import {
  ColorMapVariable,
  NATURAL_SEQ_PREFIX,
  SeqSpaceProjections,
} from "./data.ts";
import {
  DataInteractionReducerDispatchFunc,
  DataInteractionReducerState,
  useScatterPlotSelectionHandler,
} from "./reducers.ts";
import { useComputedColorScheme, useMantineTheme } from "@mantine/core";
import { NA_COLOR, NO_COLORMAP_COLOR } from "./viewer.tsx";
import { Color } from "molstar/lib/mol-util/color";
import toHexStyle = Color.toHexStyle;

export interface SeqSpaceViewerProps {
  projections: SeqSpaceProjections;
  dataSelection: DataInteractionReducerState;
  dispatchDataSelection: DataInteractionReducerDispatchFunc;
  activeIds: Set<string>;
}

const PLOTLY_SCATTER_PLOT_TYPE = "scattergl";
const TARGET_SEQUENCE_COLOR = "red";
const SELECTED_SEQUENCE_COLOR = "red";

export const SeqSpaceViewer = ({
  projections,
  dataSelection,
  dispatchDataSelection,
  activeIds,
}: SeqSpaceViewerProps) => {
  const theme = useMantineTheme();
  const computedColorScheme = useComputedColorScheme("light", {
    getInitialValueInEffect: true,
  });

  // @ts-ignore
  const scatterplotClickHandler = useScatterPlotSelectionHandler(
    dispatchDataSelection,
  );

  const [seqSpaceColorVariable, setSeqSpaceColorVariable] =
    useState<ColorMapVariable>("score");

  const { colorMap } = useColorMapForInstances(
    projections.instances,
    seqSpaceColorVariable,
    NA_COLOR,
    NO_COLORMAP_COLOR,
  );

  const naturalSeqColor = computedColorScheme === "dark" ? "#444" : "#CCC";

  // natural sequences
  const naturalPoints = useMemo(() => {
    // reverse order so target seq is on top
    const rev = [...projections.system].reverse();
    const numPoints = rev.length;

    // TODO: add hover labels
    return {
      x: rev.map((seq) => seq.metadata!.seqspace_projection![0]),
      y: rev.map((seq) => seq.metadata!.seqspace_projection![1]),
      ids: rev.map((_, idx) => `${NATURAL_SEQ_PREFIX}${numPoints - idx - 1}`),
      type: PLOTLY_SCATTER_PLOT_TYPE,
      mode: "markers",
      marker: {
        color: rev.map((_, idx) =>
          idx === numPoints - 1 ? TARGET_SEQUENCE_COLOR : naturalSeqColor,
        ),
        opacity: rev.map((_, idx) => (idx === numPoints - 1 ? 1 : 0.2)),
      },
    };
  }, [projections.system, naturalSeqColor]);

  // designed instances
  // TODO: add hover labels
  const instancePoints = useMemo(() => {
    // instance points (actual designs, can be selected)
    const instancesToShow = new Set(
      dataSelection.filteredInstances.map((instance) => instance.id),
    );

    // filter to current instance set, then put selections within that set at end so clearly visible
    const instancesFilt = projections.instances
      .filter((inst) => instancesToShow.has(inst.id))
      .sort(
        (a, b) => (activeIds.has(a.id) ? 1 : 0) - (activeIds.has(b.id) ? 1 : 0),
      );

    return {
      x: instancesFilt.map((inst) => inst.metadata!.seqspace_projection![0]),
      y: instancesFilt.map((inst) => inst.metadata!.seqspace_projection![1]),
      ids: instancesFilt.map((inst) => inst.id),
      type: PLOTLY_SCATTER_PLOT_TYPE,
      mode: "markers",
      marker: {
        color: instancesFilt.map((inst) => toHexStyle(colorMap(inst))),
        opacity: 0.8,

        line: {
          color: SELECTED_SEQUENCE_COLOR,
          width: instancesFilt.map((inst) =>
            activeIds.size < dataSelection.filteredInstances.length &&
            activeIds?.has(inst.id)
              ? 2
              : 0,
          ),
        },
      },
    };
  }, [
    projections.instances,
    dataSelection.filteredInstances,
    activeIds,
    colorMap,
  ]);

  // merge traces for rendering bunt only if either one changed
  const allPoints = useMemo(() => {
    return [naturalPoints, instancePoints];
  }, [naturalPoints, instancePoints]);

  const [_dataRevision, setDataRevision] = useState(1);
  //useEffect(() => {
  //  setDataRevision((rev) => rev + 1);
  //}, [seqSpaceProjectionPoints]);

  // const [selectionMode, { toggle: toggleSelectionMode }] = useDisclosure(false);
  const [selectionMode, setSelectionMode] = useState(false);

  // TODO: track shift key
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
  const bgColor =
    computedColorScheme === "dark"
      ? theme.colors.dark[7] // cf. https://mantine.dev/styles/css-variables-list/
      : "#ffffff";

  return (
    <div className="resizable-viewer-box" style={{ display: "flex" }}>
      <ColorVariableSelector
        colorVariable={seqSpaceColorVariable}
        setColorVariable={setSeqSpaceColorVariable}
      />
      <Plot
        data={allPoints}
        // data={[
        //   {
        //     x: seqSpaceProjectionPoints.map((point) => point.x),
        //     y: seqSpaceProjectionPoints.map((point) => point.y),
        //     ids: seqSpaceProjectionPoints.map((point) => point.id),
        //     type: "scattergl",
        //     mode: "markers",
        //     marker: {
        //       color: seqSpaceProjectionPoints.map((point) => point.color),
        //       opacity: seqSpaceProjectionPoints.map((point) =>
        //         point.id.startsWith(NATURAL_SEQ_PREFIX) ? 0.2 : 1,
        //       ),
        //       line: {
        //         color: seqSpaceProjectionPoints.map(
        //           (point) => point.outlineColor,
        //         ),
        //         width: seqSpaceProjectionPoints.map((point) =>
        //           point.outlineColor ? 2 : 0,
        //         ),
        //       },
        //     },
        //   },
        // ]}
        layout={{
          plot_bgcolor: bgColor,
          paper_bgcolor: bgColor,
          dragmode: selectionMode ? "select" : "pan",
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
          // TODO: return if no points
          scatterplotClickHandler(
            event.points?.map((point: any) => point.id),
            {
              alt: event.event.alKey,
              shift: event.event.shiftKey,
              ctrl: event.event.ctrlKey,
              meta: event.event.metaKey,
            },
          );
          setDataRevision((rev) => rev + 1);
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
  );
};
