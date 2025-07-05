import { TableVirtuoso, TableVirtuosoHandle } from "react-virtuoso";
import {
  SystemInstanceSpec,
  SystemInstanceSpecEnhanced,
} from "../../models/design.ts";
import {
  ActionIcon,
  CopyButton,
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
import { extractModifiers, Modifiers } from "../../utils/events.tsx";
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
import { IconCopy, IconCheck, IconBasketCheck } from "@tabler/icons-react";

export type InstanceTableEventHandler = (
  instance: SystemInstanceSpec,
  index: number,
  modifiers: Modifiers,
) => void;

export interface InstanceTableProps {
  instances: SystemInstanceSpecEnhanced[];
  dataSelection: DataInteractionReducerState;
  dispatchDataSelection?: DataInteractionReducerDispatchFunc;
  isMutationScan: boolean;
  basket: Set<string>;
  colorMap: ColorMapCallbackWithNull;
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
    a.mutant[0].ref > b.mutant[0].ref ? 1 : -1,
  SUBS: (a: SystemInstanceSpecEnhanced, b: SystemInstanceSpecEnhanced) =>
    a.mutant[0].to > b.mutant[0].to ? 1 : -1,
};

interface ColumnRenderSpec {
  header: string;
  sortKey: string | null;
  render: (
    instance: SystemInstanceSpecEnhanced,
    basket: Set<string>,
    colorMap: ColorMapCallbackWithNull,
  ) => ReactNode;
}

const AUX_COLUMNS: ColumnRenderSpec[] = [
  {
    header: "",
    sortKey: null,
    // TODO: render view button and show in sequence viewer
    render: (instance, basket) => {
      return (
        <>
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
            <IconBasketCheck
              style={{
                width: "70%",
                height: "70%",
              }}
            />
          </ThemeIcon>
        </>
      );
    },
  },
];

const PIPELINE_COLUMNS: ColumnRenderSpec[] = [
  {
    header: "ID",
    sortKey: null,
    render: (instance) => <>{instance.id}</>,
  },
  {
    header: "Score",
    sortKey: "SCORE",
    render: (instance) => <>{instance.score?.toFixed(2)}</>,
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
    render: (instance, _basket, colorMap) => {
      const bgColor = toHexStyle(colorMap(instance.score));
      const fontColor = highContrastColor(bgColor, "white", "black");
      return (
        <div
          style={{
            backgroundColor: bgColor,
            color: fontColor,
            textAlign: "center",
          }}
        >
          {instance.score?.toFixed(2)}
        </div>
      );
    },
  },
  ...AUX_COLUMNS,
];

export const InstanceTable = ({
  instances,
  dataSelection,
  isMutationScan,
  basket,
  colorMap,
  dispatchDataSelection = undefined,
}: InstanceTableProps) => {
  // TODO: implement selection of range of designs with shift key (all up or down from last selection)

  // handle for imperative scrolling
  const virtuoso = useRef<TableVirtuosoHandle>(null);

  const selectedIds = dataSelection.instances;

  const [sortKey, setSortKey] = useState(DEFAULT_SORT_KEY);

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
      setScrollPos(targetIdx);
    }
  }, [instancesSorted, dataSelection.instances, virtuoso]);

  const clickHandler = (event: any, instance: SystemInstanceSpecEnhanced) => {
    if (dispatchDataSelection) {
      const modifiers = extractModifiers(event);
      dispatchDataSelection({
        type: "SELECT_INSTANCES",
        payload: [instance.id],
        source: "TABLE",
        modifiers: modifiers,
      });
    }
  };

  const columns = isMutationScan ? MUTATION_SCAN_COLUMNS : PIPELINE_COLUMNS;

  return (
    <TableVirtuoso
      ref={virtuoso}
      style={{ height: "100%", width: "100%" }}
      data={instancesSorted}
      components={{
        Table: (props) => (
          <Table
            {...{
              ...props,
              withRowBorders: false,
              highlightOnHover: true,
              // verticalSpacing: 5,
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
              data-striped={props["data-item-index"] % 2 === 1 ? "mark" : "not"}
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
                ? () => setSortKey(computeNextSortKey(sortKey, column.sortKey!))
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
                {column.render(instance, basket, colorMap)}
              </Table.Td>
            ))}
          </>
        );
      }}
    />
  );
};
