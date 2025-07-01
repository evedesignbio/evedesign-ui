import { TableVirtuoso, TableVirtuosoHandle } from "react-virtuoso";
import {
  SystemInstanceSpec,
  SystemInstanceSpecEnhanced,
} from "../../models/design.ts";
import { Table } from "@mantine/core";
import { forwardRef, useEffect, useRef, useState } from "react";
import { extractModifiers, Modifiers } from "../../utils/events.tsx";
import {
  DataInteractionReducerDispatchFunc,
  DataInteractionReducerState,
} from "./reducers.ts";
import { decodeMutation } from "./data.ts";

export type InstanceTableEventHandler = (
  instance: SystemInstanceSpec,
  index: number,
  modifiers: Modifiers,
) => void;

export interface InstanceTableProps {
  instances: SystemInstanceSpecEnhanced[];
  dataSelection: DataInteractionReducerState;
  instanceRenderType: "sequence" | "mutant" | "hide";
  dispatchDataSelection?: DataInteractionReducerDispatchFunc;
  isMutationScan: boolean;
  basket: Set<string>;
}

export const InstanceTable = ({
  instances,
  dataSelection,
  isMutationScan,
  basket,
  instanceRenderType = "hide",
  dispatchDataSelection = undefined,
}: InstanceTableProps) => {
  // TODO: render sequence
  // TODO: color effect score
  // TODO: add sorting
  // TODO: add filtering
  // TODO: memoize rendering as needed
  // TODO: striped background rendering (considering theme)
  // TODO: prop whether to show mutants or sequence of designed positions (with ellipsis)
  // TODO: implement selection of range of designs with shift key (all up or down from last selection)
  // TODO: implement scrolling to selected designs when resetting displayed designs

  // handle for imperative scrolling
  const virtuoso = useRef<TableVirtuosoHandle>(null);

  // TODO: revisit this for sequence space plot - will need to filter by instance too unless single instance?
  // const selectedIds =
  //   dataSelection.lastEventSource === "TABLE"
  //     ? dataSelection.instances
  //     : dataSelection.instances;
  const selectedIds = dataSelection.instances;

  // sort instances
  // TODO implement
  const instancesDisplay = instances;

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
      const targetIdx = instancesDisplay.findIndex(
        (instance) => instance.id === targetId,
      );

      // "indirect scroll" via state to get around missing scrolls when instances update
      // (eg after resetting list)
      setScrollPos(targetIdx);
    }
  }, [instancesDisplay, dataSelection.instances, virtuoso]);

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

  return (
    <TableVirtuoso
      ref={virtuoso}
      style={{ height: "100%", width: "100%" }}
      data={instancesDisplay}
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
          <Table.Th>ID</Table.Th>
          <Table.Th>Muts</Table.Th>
          <Table.Th>Score</Table.Th>
          {instanceRenderType !== "hide" ? <Table.Th>Seq</Table.Th> : null}
        </Table.Tr>
      )}
      itemContent={(_index, instance) => {
        // change background on td so we still get hover effect
        const bg = selectedIds?.has(instance.id)
          ? "var(--mantine-color-blue-light)"
          : undefined;

        let instRep = null;
        if (instanceRenderType !== "hide") {
          let instVisual = null;
          if (instanceRenderType === "sequence") {
            // TODO: only render designed positions
            // TODO: render modified positions relative to ref
            instVisual = (
              <span>
                {instance.entity_instances[0].rep.substring(0, 10) + "..."}
              </span>
            );
          } else {
            // mutant
            // TODO: assemble into string
            instVisual = "mutant";
          }

          instRep = <Table.Td bg={bg}>{instVisual}</Table.Td>;
        }

        let idStr;
        if (isMutationScan) {
          const mutDec = decodeMutation(instance.id);
          idStr = `${mutDec.ref}${mutDec.pos}${mutDec.to}`;
        } else {
          idStr = instance.id;
        }

        return (
          <>
            <Table.Td bg={bg}>
              {idStr + (basket.has(instance.id) ? " X" : "")}
            </Table.Td>
            <Table.Td bg={bg}>{instance.mutant.length}</Table.Td>
            <Table.Td bg={bg}>{instance.score?.toFixed(2)}</Table.Td>
            {instRep}
          </>
        );
      }}
    />
  );
};
