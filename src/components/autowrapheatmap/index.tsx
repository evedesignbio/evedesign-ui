/*
  Interactive heatmap visualization that wraps vertically to multiple lines based on available space
  (rather than having one very long heatmap that needs to be scrolled horizontally)
*/
import {
  useRef,
  useLayoutEffect,
  useState,
  useEffect,
  useMemo,
  CSSProperties,
  ReactNode,
} from "react";

import { useResizeObserver, useDebouncedCallback } from "@mantine/hooks";
import { Tooltip, ChildrenType } from "react-tooltip";
import { extractModifiers, Modifiers } from "../../utils/events";
import { highContrastColor } from "../../utils/colormap.ts";

type LabelRenderFunc = (render: {
  content: string | null;
  activeAnchor: HTMLElement | null;
}) => ChildrenType;

export type HeatmapProps = {
  data: NullableArray2D;
  colorMap: HeatmapColorMap;
  yLabels: string[];
  selectedCells?: CellCoords[];
  markedCells?: CellCoords[];
  selectedRows?: number[];
  selectedColumns?: number[];
  handleEvent?: HeatmapClickHandler;
  labelRenderer?: LabelRenderer;
  cellWidth?: string;
  cellHeight?: string;
  yLabelSpacing?: string;
  annotationTracks?: AnnotationTrack[];
  selectionStyles?: SelectionStyles;
  resizeDebounceTime?: number;
  scrollToElement?: number;
  containerStyle?: CSSProperties;
  tooltipStyle?: CSSProperties;
};

export type CellCoords = {
  row: number;
  column: number;
};

export type TrackRenderer = (i: number, selected: boolean) => ReactNode;

export type AnnotationTrack = {
  id: string;
  above: boolean;
  height: string;
  yLabel?: string;
  render?: TrackRenderer;
};

export type NullableArray1D = (number | null)[];
export type NullableArray2D = (number | null)[][];

export type ClickEvent = {
  locationType:
    | "data"
    | "data_ylabel"
    | "annotation"
    | "annotation_ylabel"
    | "outside";
  payload: any;
  modifiers: Modifiers;
};
export type HeatmapClickHandler = (event: ClickEvent) => void;

export type LabelData = {
  type: "data" | "annotation";
  row?: number;
  column?: number;
  value?: number | null;
  trackId?: string;
};
export type LabelRenderer = (data: LabelData) => ReactNode;

// map from value/location in heatmap to hex color string
export type HeatmapColorMap = (
  value: number | null,
  i?: number,
  j?: number,
) => string;

const DEFAULT_DEBOUNCE_TIME = 1;

// custom properties for outer flexbox
const DEFAULT_CONTAINER_STYLE = {
  // include padding in box size
  // https://stackoverflow.com/questions/5219175/how-to-make-an-element-width-100-minus-padding
  boxSizing: "border-box",
  width: "100%",
  paddingLeft: "2em",
  paddingRight: "2em",
};

export type SelectionStyles = {
  // properties applied on the cell level
  cellSelectedCell?: CSSProperties;
  cellMarkedCell?: CSSProperties;
  cellSelectedRow?: CSSProperties;
  cellSelectedColumn?: CSSProperties;
  columnSelectedColumn?: CSSProperties;
  labelSelectedRowStart: CSSProperties;
  labelSelectedRowEnd: CSSProperties;
};

// default styles for selections (cells, rows, columns);
// first part of name is what type of item style is applied to,
// second part is what type of selection will cause the style to be applied to it
export const DEFAULT_SELECTION_STYLES = {
  cellSelectedCell: {
    // border: "3px solid gold",
    // boxShadow: "0px 5px 10px 0px rgba(0, 0, 0, 0.5)",
    // boxShadow: "0px 0px 0px 3px gold, 0px 0px 5px 3px rgba(0, 0, 0, 0.9)",
    boxShadow: "0px 0px 0px 1px red",
    zIndex: 99,
  } as CSSProperties,

  cellMarkedCell: {
    fontSize: "3pt",
  } as CSSProperties,

  // cellSelectedRow: {
  //   boxShadow: "3pt 0px 4px 2pt gold",
  //   // boxShadow: "3pt 0px 5px 2pt #333",
  //   zIndex: 99,
  // } as CSSProperties,
  // cellSelectedColumn: { backgroundColor: "green" } as CSSProperties,
  columnSelectedColumn: { backgroundColor: "#333333" } as CSSProperties,

  labelSelectedRowStart: {
    backgroundColor: "#333333",
    color: "white",
    boxShadow: "+5pt 0pt 0pt 0pt black",
    // borderLeft: "5pt solid black",
  } as CSSProperties,

  labelSelectedRowEnd: {
    backgroundColor: "#333333",
    color: "white",
    boxShadow: "-5pt 0pt 0pt 0pt black",
    // borderLeft: "5pt solid black",
  } as CSSProperties,
};

type RowBoundaries = {
  xFirst: number;
  xLast: number | undefined;
  y: number;
  cellIndexFirst: number;
  cellIndexLast: number | undefined;
};

type ElementCoords = {
  x: number;
  y: number;
};

// identify coordinates of first and last flexbox item in each row of heatmap
// (e.g., to attach row-wise labels at beginning and end of row)
const getRowBoundaries = (ref: HTMLDivElement | null) => {
  if (!ref) return [];

  // console.log("-- GET BOUNDARIES ------------ ");
  let cellIdx = 0;
  // let curRow = 0;
  // y coordinate of currently visited row
  let curY: number | undefined = undefined;

  // reference to previous element coordinates
  let prev: ElementCoords | undefined = undefined;
  const rowBoundaries: RowBoundaries[] = [];

  for (const child of ref.children) {
    // const br = child.getBoundingClientRect();
    const childCast = child as HTMLElement;
    const br: ElementCoords = {
      x: childCast.offsetLeft,
      y: childCast.offsetTop,
    };

    // check if we have an element with a different y value (this indicates a new row),
    // special handling for first row
    if (curY === undefined || curY !== br.y) {
      // means we now know end of previous row, update accordingly (if we visit at least 2nd row);
      // condition is equivalent to prev !== undefined, and to curY !== undefined
      if (rowBoundaries.length > 0) {
        const last = rowBoundaries.length - 1;
        rowBoundaries[last] = {
          ...rowBoundaries[last],
          xLast: prev!.x,
          cellIndexLast: cellIdx - 1,
        };
      }

      // update to current y value;
      // example: DOMRect {x: 421.328125, y: 443.15625, width: 10, height: 60, top: 443.15625, …}
      curY = br.y;

      // store new row
      rowBoundaries.push({
        xFirst: br.x,
        xLast: undefined, // will be set when reaching end of row
        y: curY,
        cellIndexFirst: cellIdx,
        cellIndexLast: undefined, // will be set when reaching end of row
      });

      // console.log("newrow:", rowBoundaries[rowBoundaries.length - 1]);
    }

    // update handle to previous cell rect
    prev = br;

    // console.log(cellIdx, br);
    cellIdx++;
  }

  // update last element
  if (rowBoundaries.length > 0) {
    const last = rowBoundaries.length - 1;
    rowBoundaries[last] = {
      ...rowBoundaries[last],
      xLast: prev!.x,
      cellIndexLast: cellIdx - 1,
    };
  }

  return rowBoundaries;

  // console.log(rowBoundaries);
};

// render containing element of each heatmap data column
const renderColumnBase = (
  key: number | string,
  columnContent: any,
  cellWidth: string,
  styleOverride?: CSSProperties,
) => {
  return (
    <div
      key={key}
      style={{
        display: "flex",
        flexDirection: "column",
        width: cellWidth,
        ...styleOverride,
      }}
    >
      {columnContent}
    </div>
  );
};

// type DataColumnProps = {
//   column: NullableArray1D;
//   i: number;
//   colorMap: HeatmapColorMap;
//   cellWidth: string;
//   cellHeight: string;
//   annotationTracks: AnnotationTrack[];
//   selectedCells: CellCoords[];
//   selectedColumns: number[];
//   selectedRows: number[];
//   selectionStyles: SelectionStyles;
//   handleEvent?: HeatmapClickHandler;
// };

// const DataColumn = ({
//   column,
//   i,
//   colorMap,
//   cellWidth,
//   cellHeight,
//   annotationTracks,
//   selectedCells,
//   selectedColumns,
//   selectedRows,
//   selectionStyles,
//   handleEvent,
// }: DataColumnProps) => {
//   // check if current column is selected
//   const colSelected = selectedColumns.filter((si) => si === i).length > 0;

//   // prefilter cell selections to current position
//   const cellSelectionFilt = selectedCells.filter((sc) => sc.column === i);

//   // render annotation tracks
//   const annotations = annotationTracks.map((track) => (
//     <div
//       key={`annotation_${i}_${track.id}`}
//       data-tip={JSON.stringify({
//         type: "annotation",
//         column: i,
//         trackId: track.id,
//       })}
//       data-for="heatmapLabel"
//       style={{
//         width: cellWidth,
//         height: track.height,
//         // TODO: remove
//         //  backgroundColor: track.id === "xlabel" ? "#222222" : "#444444",
//         position: "relative",
//       }}
//       onClick={(event) => {
//         if (handleEvent) {
//           handleEvent({
//             locationType: "annotation",
//             payload: { trackId: track.id, column: i },
//             modifiers: extractModifiers(event),
//           });
//         }
//         event.stopPropagation();
//       }}
//     >
//       {track.render ? track.render(i, colSelected) : null}
//     </div>
//   ));

//   // split into tracks above and below matrix
//   const annotationsAbove = annotations.filter(
//     (anno, i) => annotationTracks[i].above
//   );

//   const annotationsBelow = annotations.filter(
//     (anno, i) => !annotationTracks[i].above
//   );

//   // render heatmap column
//   const columnContent = column.map((cellValue, j) => {
//     // check if current cell and row are selected
//     const cellSelected =
//       cellSelectionFilt.filter((scf) => scf.row === j).length > 0;
//     const rowSelected = selectedRows.filter((sj) => sj === j).length > 0;

//     return (
//       <div
//         key={`cell_${i}_${j}`}
//         data-tip={JSON.stringify({
//           type: "data",
//           column: i,
//           row: j,
//           value: cellValue,
//         })}
//         data-for="heatmapLabel"
//         style={{
//           width: cellWidth,
//           height: cellHeight,
//           // textAlign: "justify", // TODO: needed?
//           backgroundColor: colorMap(cellValue, i, j),
//           ...(rowSelected ? selectionStyles.cellSelectedRow : null),
//           ...(colSelected ? selectionStyles.cellSelectedColumn : null),
//           ...(cellSelected ? selectionStyles.cellSelectedCell : null),
//         }}
//         onClick={(event) => {
//           if (handleEvent) {
//             handleEvent({
//               locationType: "data",
//               payload: {
//                 column: i,
//                 row: j,
//                 value: cellValue,
//               },
//               modifiers: extractModifiers(event),
//             });
//           }
//           event.stopPropagation();
//         }}
//       />
//     );
//   });

//   return renderColumnBase(
//     `column_${i}`,
//     annotationsAbove.concat(columnContent, annotationsBelow),
//     cellWidth,
//     colSelected ? selectionStyles.columnSelectedColumn : undefined
//   );
// };

const MARKER_SYMBOL = "⬤";

const renderDataColumn = (
  column: NullableArray1D,
  i: number,
  colorMap: HeatmapColorMap,
  cellWidth: string,
  cellHeight: string,
  annotationTracks: AnnotationTrack[],
  selectedCells: CellCoords[],
  markedCells: CellCoords[],
  selectedColumns: number[],
  selectedRows: number[],
  selectionStyles: SelectionStyles,
  handleEvent?: HeatmapClickHandler,
  // setAnchorId?: any
) => {
  // check if current column is selected
  const colSelected = selectedColumns.filter((si) => si === i).length > 0;

  // prefilter cell selections to current position
  const cellSelectionFilt = selectedCells.filter((sc) => sc.column === i);

  const cellMarkedFilt = markedCells.filter((sc) => sc.column === i);

  // render annotation tracks
  const annotations = annotationTracks.map((track) => (
    <div
      key={`annotation_${i}_${track.id}`}
      data-tooltip-content={JSON.stringify({
        type: "annotation",
        column: i,
        trackId: track.id,
      })}
      data-tooltip-id="heatmapLabel"
      style={{
        width: cellWidth,
        height: track.height,
        // TODO: remove
        //  backgroundColor: track.id === "xlabel" ? "#222222" : "#444444",
        position: "relative",
      }}
      onClick={(event) => {
        if (handleEvent) {
          handleEvent({
            locationType: "annotation",
            payload: { trackId: track.id, column: i },
            modifiers: extractModifiers(event),
          });
        }
        event.stopPropagation();
      }}
    >
      {track.render ? track.render(i, colSelected) : null}
    </div>
  ));

  // split into tracks above and below matrix
  const annotationsAbove = annotations.filter(
    (_anno, i) => annotationTracks[i].above,
  );

  const annotationsBelow = annotations.filter(
    (_anno, i) => !annotationTracks[i].above,
  );

  // render heatmap column
  const columnContent = column.map((cellValue, j) => {
    // check if current cell and row are selected
    const cellSelected =
      cellSelectionFilt.filter((scf) => scf.row === j).length > 0;
    const cellMarked = cellMarkedFilt.filter((scf) => scf.row === j).length > 0;
    const rowSelected = selectedRows.filter((sj) => sj === j).length > 0;
    const cellId = `cell_${i}_${j}`;
    const bgColor = colorMap(cellValue, i, j);
    return (
      <div
        key={cellId}
        id={cellId}
        // onMouseEnter={() => (setAnchorId ? setAnchorId(cellId) : null)}
        // data-tooltip-content={cellId}
        // data-tooltip-html={""}
        // data-tooltip-content="some label"
        data-tooltip-content={JSON.stringify({
          type: "data",
          column: i,
          row: j,
          value: cellValue,
        })}
        data-tooltip-id="heatmapLabel"
        style={{
          // fontSize: "2pt",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          // color: "lightgrey",
          width: cellWidth,
          height: cellHeight,
          // textAlign: "justify", // TODO: needed?
          backgroundColor: bgColor,
          ...(rowSelected ? selectionStyles.cellSelectedRow : null),
          ...(colSelected ? selectionStyles.cellSelectedColumn : null),
          ...(cellSelected ? selectionStyles.cellSelectedCell : null),
          ...(cellMarked ? selectionStyles.cellMarkedCell : null),
          ...(cellMarked
            ? { color: highContrastColor(bgColor, "white", "black") }
            : null),
        }}
        onClick={(event) => {
          if (handleEvent) {
            handleEvent({
              locationType: "data",
              payload: {
                column: i,
                row: j,
                value: cellValue,
              },
              modifiers: extractModifiers(event),
            });
          }
          event.stopPropagation();
        }}
      >
        {cellMarked ? MARKER_SYMBOL : null}
      </div>
    );
  });

  return renderColumnBase(
    `column_${i}`,
    annotationsAbove.concat(columnContent, annotationsBelow),
    cellWidth,
    colSelected ? selectionStyles.columnSelectedColumn : undefined,
  );
};

// render y-axis labels on each row (before first and and after last column);
const renderLabels = (
  row: RowBoundaries,
  rowIndex: number,
  endOfRow: boolean,
  yLabels: string[],
  cellWidth: string,
  cellHeight: string,
  annotationTracks: AnnotationTrack[],
  yLabelSpacing: string,
  selectedRows: number[],
  selectionStyles: SelectionStyles,
  handleEvent?: HeatmapClickHandler,
  fontSizeMultiplier = 0.95,
) => {
  const baseLabel = `row_label_${endOfRow ? "end" : "start"}_${rowIndex}`;

  // render heatmap y labels
  const columnContent = yLabels.map((label, j) => {
    const rowSelected = selectedRows.filter((sj) => sj === j).length > 0;

    return (
      <div
        key={`${baseLabel}_y${j}`}
        style={{
          height: cellHeight,
          // width: cellWidth,
          // backgroundColor: endOfRow ? "yellow" : "red",
          fontSize: `calc(${cellHeight} * ${fontSizeMultiplier})`,
          display: "flex",
          alignItems: "center",
          justifyContent: endOfRow ? "left" : "right",
          cursor: "default",
          ...(rowSelected
            ? endOfRow
              ? selectionStyles.labelSelectedRowEnd
              : selectionStyles.labelSelectedRowStart
            : null),
        }}
        onClick={(event) => {
          if (handleEvent) {
            handleEvent({
              locationType: "data_ylabel",
              payload: {
                row: j,
                yLabel: label,
                endOfRow: endOfRow,
                rowIndex: rowIndex,
              },
              modifiers: extractModifiers(event),
            });
          }
          event.stopPropagation();
        }}
      >
        {label}
      </div>
    );
  });

  // render annotation tracks
  const annotations = annotationTracks.map((track) => (
    <div
      key={`${baseLabel}_${track.id}`}
      style={{
        width: cellWidth,
        height: track.height,
        position: "relative",
        fontSize: `calc(${cellHeight} * ${fontSizeMultiplier})`,
        display: "flex",
        alignItems: "center",
        justifyContent: endOfRow ? "left" : "right",
      }}
      onClick={(event) => {
        if (handleEvent) {
          handleEvent({
            locationType: "annotation_ylabel",
            payload: {
              trackId: track.id,
              label: track.yLabel,
              endofRow: endOfRow,
              rowIndex: rowIndex,
            },
            modifiers: extractModifiers(event),
          });
        }
        event.stopPropagation();
      }}
    >
      {track.yLabel}
    </div>
  ));

  // split into tracks above and below matrix
  const annotationsAbove = annotations.filter(
    (_anno, i) => annotationTracks[i].above,
  );

  const annotationsBelow = annotations.filter(
    (_anno, i) => !annotationTracks[i].above,
  );

  const styleOverride = {
    position: "absolute",
    top: row.y,
    left: endOfRow
      ? `calc(${row.xLast}px + ${cellWidth} + ${yLabelSpacing})`
      : `calc(${row.xFirst}px - ${cellWidth} - ${yLabelSpacing})`,
  };

  return renderColumnBase(
    baseLabel,
    annotationsAbove.concat(columnContent, annotationsBelow),
    cellWidth,
    styleOverride as CSSProperties,
  );
};

// DONE: scroll to selection function?
// DONE: - zooming doesn't sync automatically -> need to find way to trigger observer
// DONE: margins, page zooming don't work; small offset to other container
// DONT: don't use inline styles where possible
// DONE: how to color cells - via inline style as previously? using color variable or colormap function?
// DONE: integrate tooltips
// DONE: allow different cell heights and widths
// DONE: allow to specify different annotation tracks
// DONE: note component needs to be wrapped correctly so absolute positioning of labels works!
// DONE useMemo to optimize performance for cell rendering
// DONE: click handler for cells and labels (finalize with proper datatypes)

// const values for default argument... defined outside to avoid retriggering useMemo
// do not modify default params below!
const EMPTY_SELECTION: number[] = [];
const EMPTY_CELL_SELECTION: CellCoords[] = [];
const EMPTY_TRACKS: AnnotationTrack[] = [];

// const EMPTY_CELLS: CellCoords[] = [];
// const EMPTY_ROWS: number[] = [];
// const EMPTY_COLS: number[] = [];

// Open issues:
// TODO: check dependencies for useLayoutEffect (data change, style props change)
// TODO: add option to render colorbar or visualize outside?
// TODO: documentation
export const AutowrapHeatmap = ({
  data,
  colorMap,
  yLabels,
  selectedCells = EMPTY_CELL_SELECTION,
  markedCells = EMPTY_CELL_SELECTION,
  selectedColumns = EMPTY_SELECTION,
  selectedRows = EMPTY_SELECTION,
  handleEvent = undefined,
  labelRenderer = undefined,
  cellWidth = "10px",
  cellHeight = "10px",
  yLabelSpacing = "5px",
  annotationTracks = EMPTY_TRACKS,
  selectionStyles = DEFAULT_SELECTION_STYLES,
  resizeDebounceTime = DEFAULT_DEBOUNCE_TIME,
  scrollToElement = undefined,
  containerStyle = DEFAULT_CONTAINER_STYLE as CSSProperties,
  tooltipStyle = undefined,
}: HeatmapProps) => {
  // const parentRef = useRef<HTMLDivElement | null>(null);
  const [rowBoundaries, setRowBoundaries] = useState<RowBoundaries[]>([]);
  // store if component is currently visible or not (different scrolling behaviour necessary e.g. if used in tabbed mode
  // rather than always visible)
  const [isVisible, setIsVisible] = useState(false);
  // store last index we scrolled to, to avoid repeated scrolling if component is used in tabs
  const lastScrollIdxRef = useRef<number | null>(null);

  // console.log("#### heatmap renders");
  // observe resizes of parent div to trigger label relayout
  // call is debounced to avoid stutter
  const debouncedResize = useDebouncedCallback(({ width, height }) => {
    // only resize if dimensions are defined (e.g., not in tab that gets hidden)
    if (!width || !height) {
      // console.log("!!! NO RESIZE", width, height);
      // if dimensions are undefined, component is hidden (important for scrolling into view)
      setIsVisible(false);
      return;
    }
    // console.log("!!! RESIZE", width, height);
    setRowBoundaries(getRowBoundaries(parentRef.current));
    // if dimensions undefined, component is visible (important for scrolling into view)
    setIsVisible(true);
  }, resizeDebounceTime);

  const [parentRef, rect] = useResizeObserver();
  useEffect(() => {
    debouncedResize(rect);
  }, [parentRef, rect.width, rect.height]);

  // trigger label relayout based on data change (resizing of container handeled using
  // ResizeObserver triggering the same function)
  useLayoutEffect(() => {
    if (parentRef.current) {
      setRowBoundaries(getRowBoundaries(parentRef.current));
    }
  }, [data, cellWidth, cellHeight, yLabelSpacing]);

  // console.log("*** boundaries", rowBoundaries);

  // reset last scroll index if selection changes (e.g., because different mutation was selected
  // - in this case we want to scroll again)
  useEffect(() => {
    lastScrollIdxRef.current = null;
    // console.log("!!! SCROLL A", isVisible, lastScrollIdxRef.current, scrollToElement);
  }, [selectedCells, selectedColumns]);

  // scroll selected matrix row into view;
  // Note that this will not retrigger scrolling if scrolled out of view and changing mutation
  // in desktop mode since switch due to isVisible is not available - leave this behaviour
  // as is to give more flexibility to users in desktop mode
  useEffect(() => {
    // console.log("!!! SCROLL B", isVisible, lastScrollIdxRef.current, scrollToElement);

    // only scroll if component is shown (otherwise scrolling has no effect)
    if (!isVisible) return;

    // don't scroll again to same element if we already did
    if (scrollToElement === lastScrollIdxRef.current) return;

    if (parentRef.current && scrollToElement !== undefined) {
      // could also use Array.from(htmlCollection) but probably no gain over just iterating
      let curIdx = 0;
      for (const child of parentRef.current.children) {
        if (curIdx === scrollToElement) {
          // https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollIntoView
          // https://stackoverflow.com/questions/67443946/javascript-scrollintoview-vs-scrollintoviewifneeded
          // (nearest option only scrolls if necessary)
          child.scrollIntoView({
            block: "nearest",
            inline: "nearest",
            // behavior: "smooth",
          });
          // store that we scrolled to that element (to avoid rescrolling upon visibility changes)
          lastScrollIdxRef.current = scrollToElement;
          // console.log("!!! SCROLL EXEC", isVisible, lastScrollIdxRef.current, scrollToElement);
          break;
        }
        curIdx++;
      }
    }
  }, [scrollToElement, isVisible]);

  // solution for using one tooltip to many anchors, that does not require use of TooltipWrapper around cells
  // const [anchorId, setAnchorId] = useState("cell_1_1");
  // const [isOpen, setIsOpen] = useState(false);

  // Memoize since rendering the full heatmap is expensive (thousands of divs),
  // we don't need to rerun e.g. if the flexbox is just resizing
  const cells = useMemo(() => {
    // console.log("#### FULL render");
    return data.map((column, i) =>
      renderDataColumn(
        column,
        i,
        colorMap,
        cellWidth,
        cellHeight,
        annotationTracks,
        selectedCells,
        markedCells,
        selectedColumns,
        selectedRows,
        selectionStyles,
        handleEvent,
        // setAnchorId
      ),
    );

    // TODO: define key on column
    // return data.map((column, i) => (
    //   <DataColumn
    //     key={i}
    //     column={column}
    //     i={i}
    //     colorMap={colorMap}
    //     cellWidth={cellWidth}
    //     cellHeight={cellHeight}
    //     annotationTracks={annotationTracks}
    //     selectedCells={EMPTY_CELLS}
    //     // selectedCells={selectedCells}
    //     selectedColumns={EMPTY_COLS}
    //     // selectedColumns={selectedColumns}
    //     selectedRows={EMPTY_ROWS}
    //     // selectedRows={selectedRows}
    //     selectionStyles={selectionStyles}
    //     handleEvent={handleEvent}
    //   />
    // ));
  }, [
    data,
    colorMap,
    handleEvent,
    annotationTracks,
    cellWidth,
    cellHeight,
    selectedCells,
    markedCells,
    selectedRows,
    selectedColumns,
    selectionStyles,
  ]);

  const wrappedLabelRenderer = useMemo(() => {
    if (!labelRenderer) {
      return undefined;
    } else {
      return (({ content }) => {
        if (content) {
          const dataParsed: LabelData = JSON.parse(content);
          return labelRenderer(dataParsed);
        } else {
          return null;
        }
      }) as LabelRenderFunc;
    }
  }, [labelRenderer]);

  return (
    <>
      <Tooltip
        id="heatmapLabel"
        render={wrappedLabelRenderer}
        style={tooltipStyle}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "top",
          ...containerStyle,
        }}
        ref={parentRef}
        onClick={(event) => {
          if (handleEvent) {
            handleEvent({
              locationType: "outside",
              payload: {},
              modifiers: extractModifiers(event),
            });
          }
        }}
      >
        {cells}
      </div>
      {rowBoundaries.map((row, j) =>
        renderLabels(
          row,
          j,
          false,
          yLabels,
          cellWidth,
          cellHeight,
          annotationTracks,
          yLabelSpacing,
          selectedRows,
          selectionStyles,
          handleEvent,
        ),
      )}
      {rowBoundaries.map((row, j) =>
        renderLabels(
          row,
          j,
          true,
          yLabels,
          cellWidth,
          cellHeight,
          annotationTracks,
          yLabelSpacing,
          selectedRows,
          selectionStyles,
          handleEvent,
        ),
      )}
      {/* <ReactTooltip
        anchorId={anchorId}
        float={true}
        isOpen={false}
        style={{ zIndex: 101 }}
      /> */}
    </>
  );
};
