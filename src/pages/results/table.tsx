import { ListRange, TableVirtuoso, TableVirtuosoHandle } from "react-virtuoso";
import {
  PipelineSpec,
  SingleMutationScanSpec,
  SystemInstanceSpecEnhanced,
  Mutation,
} from "../../models/design.ts";
import {
  ActionIcon,
  Container,
  CopyButton,
  Flex,
  Table,
  ThemeIcon,
  Tooltip,
} from "@mantine/core";
import {
  forwardRef,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { extractModifiers } from "../../utils/events.tsx";
import {
  DataInteractionReducerDispatchFunc,
  DataInteractionReducerState,
} from "./reducers.ts";
import { decodeMutation } from "./data.ts";
import {
  ColorMapCallbackWithNull,
  highContrastColor,
} from "../../utils/colormap.ts";
import { Color } from "molstar/lib/mol-util/color";
import toHexStyle = Color.toHexStyle;
import {
  IconCopy,
  IconCheck,
  IconBasketCheck,
  IconEye,
} from "@tabler/icons-react";
import { ChildrenType } from "react-tooltip";
import { SequenceViewer } from "../../components/sequenceviewer";

// export type InstanceTableEventHandler = (
//   instance: SystemInstanceSpec,
//   index: number,
//   modifiers: Modifiers,
// ) => void;

export interface InstanceTableProps {
  instances: SystemInstanceSpecEnhanced[];
  dataSelection: DataInteractionReducerState;
  dispatchDataSelection?: DataInteractionReducerDispatchFunc;
  isMutationScan: boolean;
  basket: Set<string>;
  colorMap: ColorMapCallbackWithNull;
  spec: PipelineSpec | SingleMutationScanSpec;
}

export const DEFAULT_SORT_KEY = "default_NONE";
export const ASCENDING = "ASC";
export const DESCENDING = "DESC";

export const encodeSortKey = (sortKey: string, direction: string) => {
  return sortKey + "_" + direction;
};

export const decodeSortKey = (sortKeyDirection: string) => {
  const [key, direction] = sortKeyDirection.split("_");
  return { sortKey: key, direction: direction };
};

export const computeNextSortKey = (
  currentKeyDirection: string,
  clickedKey: string,
) => {
  const decoded = decodeSortKey(currentKeyDirection);
  let newKey;
  if (clickedKey !== decoded.sortKey) {
    // new key, always start ascending
    newKey = encodeSortKey(clickedKey, ASCENDING);
  } else {
    // if currently at ascending position, switch to descending
    if (decoded.direction === ASCENDING) {
      newKey = encodeSortKey(clickedKey, DESCENDING);
    } else {
      // if at descending position, switch to default key
      newKey = DEFAULT_SORT_KEY;
    }
  }

  return newKey;
};

export const renderSortIcon = (targetKey: string, sortKey: string) => {
  const decoded = decodeSortKey(sortKey);
  if (decoded.sortKey === targetKey) {
    if (decoded.direction === ASCENDING) {
      return <span>&nbsp;▲</span>; //▲ ▴
    } else {
      return <span>&nbsp;▼</span>; // ▼▾
    }
  } else {
    // enforce same spacing using invisible character
    return <span style={{ visibility: "hidden" }}>&nbsp;▲</span>;
  }
};

const SORTING_FUNCS = {
  SCORE: (a: SystemInstanceSpecEnhanced, b: SystemInstanceSpecEnhanced) =>
    (a.score !== null ? a.score : 0) - (b.score !== null ? b.score : 0),
  MUTS: (a: SystemInstanceSpecEnhanced, b: SystemInstanceSpecEnhanced) =>
    a.mutant.length - b.mutant.length,
  POS: (a: SystemInstanceSpecEnhanced, b: SystemInstanceSpecEnhanced) =>
    a.mutant[0].pos - b.mutant[0].pos,
  REF: (a: SystemInstanceSpecEnhanced, b: SystemInstanceSpecEnhanced) =>
    a.mutant[0].ref === b.mutant[0].ref
      ? 0
      : a.mutant[0].ref > b.mutant[0].ref
        ? 1
        : -1,
  SUBS: (a: SystemInstanceSpecEnhanced, b: SystemInstanceSpecEnhanced) =>
    a.mutant[0].to === b.mutant[0].to
      ? 0
      : a.mutant[0].to > b.mutant[0].to
        ? 1
        : -1,
};

interface ColumnRenderSpec {
  header: string;
  sortKey: string | null;
  render: (
    instance: SystemInstanceSpecEnhanced,
    spec: SingleMutationScanSpec | PipelineSpec,
    basket: Set<string>,
    colorMap: ColorMapCallbackWithNull,
  ) => ReactNode;
}

const AUX_COLUMNS: ColumnRenderSpec[] = [
  {
    header: "",
    sortKey: null,
    render: (instance, spec, basket) => {
      return (
        <Flex>
          <ActionIcon
            color={"gray"}
            variant="subtle"
            data-tooltip-content={JSON.stringify({
              instance: instance,
              firstIndex: spec.system.entities[0].first_index,
            })}
            data-tooltip-id="tableViewer"
            onClick={(e) => e.stopPropagation()}
          >
            <IconEye size={16} />
          </ActionIcon>

          <CopyButton value={instance.entity_instances[0].rep} timeout={2000}>
            {({ copied, copy }) => (
              <Tooltip
                label={copied ? "Copied sequence" : "Copy sequence"}
                withArrow
                position="right"
              >
                <ActionIcon
                  color={copied ? "teal" : "gray"}
                  variant="subtle"
                  onClick={(e) => {
                    copy();
                    e.stopPropagation();
                  }}
                >
                  {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                </ActionIcon>
              </Tooltip>
            )}
          </CopyButton>

          <ThemeIcon
            color="primary"
            variant="subtle"
            style={{
              visibility: basket.has(instance.id) ? "visible" : "hidden",
            }}
          >
            <IconBasketCheck size={16} />
          </ThemeIcon>
        </Flex>
      );
    },
  },
];

const PIPELINE_COLUMNS: ColumnRenderSpec[] = [
  {
    header: "ID",
    sortKey: null,
    render: (instance) => <div style={{ minWidth: "40px" }}>{instance.id}</div>,
  },
  {
    header: "Score",
    sortKey: "SCORE",
    render: (instance) => {
      const scoreStr =
        `${instance.score?.toFixed(2)}`.padStart(6, "\u2007") + "\u2007\u2007";
      return <div style={{ textAlign: "center" }}>{scoreStr}</div>;
    },
  },
  {
    header: "Muts",
    sortKey: "MUTS",
    render: (instance) => <>{instance.mutant.length}</>,
  },
  ...AUX_COLUMNS,
];

const MUTATION_SCAN_COLUMNS: ColumnRenderSpec[] = [
  // {
  //   header: "ID",
  //   sortKey: null,
  //   render: (instance) => {
  //     const mutDec = decodeMutation(instance.id);
  //     return <>{`${mutDec.ref}${mutDec.pos}${mutDec.to}`}</>;
  //   },
  // },
  {
    header: "Ref",
    sortKey: "REF",
    render: (instance) => <>{decodeMutation(instance.id).ref}</>,
  },
  {
    header: "Pos",
    sortKey: "POS",
    render: (instance) => <>{decodeMutation(instance.id).pos}</>,
  },
  {
    header: "Subs",
    sortKey: "SUBS",
    render: (instance) => <>{decodeMutation(instance.id).to}</>,
  },
  {
    header: "Score",
    sortKey: "SCORE",
    render: (instance, _spec, _basket, colorMap) => {
      const bgColor = toHexStyle(colorMap(instance.score));
      const fontColor = highContrastColor(bgColor, "white", "black");
      return (
        <div
          style={{
            backgroundColor: bgColor,
            color: fontColor,
            textAlign: "center",
            borderRadius: "2px",
          }}
        >
          {instance.score?.toFixed(2)}
        </div>
      );
    },
  },
  ...AUX_COLUMNS,
];

export const renderSequenceLabel = (render: {
  content: string | null;
  activeAnchor: HTMLElement | null;
}): ChildrenType => {
  if (render.content === null) return;

  const dec = JSON.parse(render.content);
  const mutatedPos = new Set<number>(
    dec.instance.mutant
      .filter((mut: Mutation) => mut.entity === 0)
      .map((mut: Mutation) => mut.pos),
  );
  return (
    <Container mt={20} size={350}>
      <SequenceViewer
        seq={dec.instance.entity_instances[0].rep}
        firstIndex={dec.firstIndex}
        handleClick={() => {
          return;
        }}
        chunkSize={10}
        getPosStyle={(pos) => (mutatedPos.has(pos) ? "selected" : "")}
      />
    </Container>
  );
};

export const InstanceTable = ({
  instances,
  dataSelection,
  isMutationScan,
  basket,
  colorMap,
  spec,
  dispatchDataSelection = undefined,
}: InstanceTableProps) => {
  // handle for imperative scrolling
  const virtuoso = useRef<TableVirtuosoHandle>(null);
  const selectedIds = dataSelection.instances;
  const [sortKey, setSortKey] = useState(DEFAULT_SORT_KEY);

  const displayedRange = useRef<ListRange | null>(null);

  // state tracking for multi-select behaviour, cf.
  // https://stackoverflow.com/questions/2959887/algorithm-for-shift-clicking-items-in-a-collection-to-select-them
  const anchor = useRef<string | null>(null);
  const focus = useRef<string | null>(null);

  // sort instances based on selected key and sorting order
  const instancesSorted = useMemo(() => {
    if (sortKey === DEFAULT_SORT_KEY) {
      return instances;
    } else {
      const decodedKey = decodeSortKey(sortKey);
      // cf key access typing: https://stackoverflow.com/questions/41993515/access-object-key-using-variable-in-typescript
      const sortingFunc =
        SORTING_FUNCS[decodedKey.sortKey as keyof typeof SORTING_FUNCS];
      const sign = decodedKey.direction === ASCENDING ? 1 : -1;
      return instances.slice().sort((a, b) => sortingFunc(a, b) * sign);
    }
  }, [sortKey, instances]);

  // mapping from instance ID to index in table (after resorting)
  const instancesToIndex = useMemo(() => {
    return new Map<string, number>(
      instancesSorted.map((inst, idx) => [inst.id, idx]),
    );
  }, [instancesSorted]);

  // track scrolling position as state rather than scrolling directly,
  // as this will miss some scrolls when instance set is updated
  const [scrollPos, setScrollPos] = useState<number | null>();

  useEffect(() => {
    if (!virtuoso.current || scrollPos === null || scrollPos === undefined)
      return;

    virtuoso.current.scrollIntoView({
      index: scrollPos,
      align: "start",
      behavior: "auto",
    });
  }, [scrollPos]);

  useEffect(() => {
    // only scroll in the case of direct single instance selection
    if (dataSelection.instances.size === 1) {
      // find index in list to scroll to
      const targetId = [...dataSelection.instances][0];
      const targetIdx = instancesSorted.findIndex(
        (instance) => instance.id === targetId,
      );

      // "indirect scroll" via state to get around missing scrolls when instances update
      // (eg after resetting list)

      // only call if element not currently visible
      if (
        displayedRange.current === null ||
        targetIdx < displayedRange.current.startIndex ||
        targetIdx >= displayedRange.current.endIndex
      ) {
        setScrollPos(targetIdx);
      }
    }
  }, [instancesSorted, dataSelection.instances, virtuoso]);

  // if single instance selected from the outside, also use it as new anchor
  if (dataSelection.lastEventSource !== "TABLE") {
    if (dataSelection.instances.size === 1) {
      const targetId = [...dataSelection.instances][0];
      anchor.current = targetId;
      focus.current = targetId;
    } else {
      anchor.current = null;
      focus.current = null;
    }
  }

  const clickHandler = (event: any, instance: SystemInstanceSpecEnhanced) => {
    if (dispatchDataSelection) {
      const modifiers = extractModifiers(event);

      if (
        modifiers.shift &&
        dataSelection.instances.size > 0 &&
        anchor.current !== null
      ) {
        // map current selection to index in table
        let selectionIndices: number[] = [...dataSelection.instances].sort().map(
          (id) => instancesToIndex.get(id)!,
        );

        // map anchor index
        let anchorIdx = instancesToIndex.get(anchor.current)!;

        // check if anchor is still part of selection (may have been deselected
        // in the meantime), handle otherwise
        if (!dataSelection.instances.has(anchor.current)) {
          // search forward for next highest selected element
          const higherIndices = selectionIndices.filter(
            (idx) => idx > anchorIdx,
          );
          if (higherIndices.length > 0) {
            anchorIdx = higherIndices[0];
          } else {
            // search backwards
            const lowerIndices = selectionIndices.filter(
              (idx) => idx < anchorIdx,
            );

            if (lowerIndices.length > 0) {
              anchorIdx = lowerIndices[lowerIndices.length - 1];
            } else {
              anchorIdx = instancesToIndex.get(instance.id)!;
            }
          }

          // update anchor value
          anchor.current = instancesSorted[anchorIdx].id;
        }


        // revert previous selection from anchor to focus (note this is inclusive!)
        if (focus.current !== null) {
          const focusIdx = instancesToIndex.get(focus.current)!;
          selectionIndices = selectionIndices.filter(
            (idx) =>
              idx < Math.min(anchorIdx, focusIdx) ||
              idx > Math.max(anchorIdx, focusIdx),
          );
        }

        // add any elements between anchor and new focus
        const newFocusIdx = instancesToIndex.get(instance.id)!;
        for (
          let idx = Math.min(anchorIdx, newFocusIdx);
          idx <= Math.max(anchorIdx, newFocusIdx);
          idx++
        ) {
          selectionIndices.push(idx);
        }

        const newSelection = selectionIndices.map(
          (idx) => instancesSorted[idx].id,
        );

        // update focus (i.e. last item selected while shift key pressed)
        focus.current = instance.id;

        // dispatch selection in its entirety, override other modifiers
        dispatchDataSelection({
          type: "SELECT_INSTANCES",
          payload: newSelection,
          source: "TABLE",
          modifiers: {
            meta: false,
            control: false,
            shift: false,
            alt: false,
          },
        });
      } else {
        // update anchor and focus to reset multi-select behaviour to now
        // start from currently selected item
        anchor.current = instance.id;
        focus.current = instance.id;

        // dispatch as is, leave multi-select handling for single clicks to reducer
        dispatchDataSelection({
          type: "SELECT_INSTANCES",
          payload: [instance.id],
          source: "TABLE",
          modifiers: modifiers,
        });
      }
    }
  };

  const columns = isMutationScan ? MUTATION_SCAN_COLUMNS : PIPELINE_COLUMNS;

  return (
    <>
      <TableVirtuoso
        ref={virtuoso}
        style={{ height: "100%", width: "100%" }}
        data={instancesSorted}
        rangeChanged={(range) => (displayedRange.current = range)}
        components={{
          Table: (props) => (
            <Table
              {...{
                ...props,
                withRowBorders: false,
                highlightOnHover: true,
                verticalSpacing: 7,
                style: { ...props.style },
              }}
            />
          ),
          TableRow: ({ ...props }) => {
            return (
              <Table.Tr
                {...props}
                onClick={(event) => {
                  clickHandler(event, props.item);
                }}
                data-striped={
                  props["data-item-index"] % 2 === 1 ? "mark" : "not"
                }
              />
            );
          },
          TableHead: Table.Thead,
          TableBody: forwardRef((props, ref) => (
            <Table.Tbody {...props} ref={ref} className={"tbody-striped"} />
          )),
        }}
        fixedHeaderContent={() => (
          <Table.Tr bg={"var(--mantine-color-body)"}>
            {columns.map((column, idx) => {
              const sortIcon =
                column.sortKey !== null
                  ? renderSortIcon(column.sortKey, sortKey)
                  : undefined;

              const handleSort =
                column.sortKey !== null
                  ? () =>
                      setSortKey(computeNextSortKey(sortKey, column.sortKey!))
                  : undefined;

              return (
                <Table.Th key={idx} onClick={handleSort}>
                  {column.header}
                  {sortIcon}
                </Table.Th>
              );
            })}
          </Table.Tr>
        )}
        itemContent={(_index, instance) => {
          // change background on td so we still get hover effect
          const bg = selectedIds?.has(instance.id)
            ? "var(--mantine-color-blue-light)"
            : undefined;

          return (
            <>
              {columns.map((column, idx) => (
                <Table.Td key={idx} bg={bg}>
                  {column.render(instance, spec, basket, colorMap)}
                </Table.Td>
              ))}
            </>
          );
        }}
      />
    </>
  );
};
