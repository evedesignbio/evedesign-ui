import { TableVirtuoso } from "react-virtuoso";
import {
  SystemInstanceSpec,
  SystemInstanceSpecEnhanced,
} from "../../models/design.ts";
import { Table } from "@mantine/core";
import { forwardRef, useMemo } from "react";
import { extractModifiers, Modifiers } from "../../utils/events.tsx";
import {
  DataInteractionReducerDispatchFunc,
  DataInteractionReducerState,
  filterInstancesByReducerSelection,
} from "./reducers.ts";

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
}

export const InstanceTable = ({
  instances,
  dataSelection,
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

  // TODO: hoist this as hook to viewer component?
  const instancesFilt = useMemo(() => {
    if (
      !dataSelection.lastEventSource ||
      dataSelection.lastEventSource === "TABLE"
    ) {
      // if selection happens from inside table panel, show all instances
      return instances;
    } else {
      // if selection happens from outside table panel, filter down what will be displayed;
      // for now, only one of these filters will be active by convention
      return filterInstancesByReducerSelection(instances, dataSelection);
    }
  }, [instances, dataSelection]);

  const selectedIds =
    dataSelection.lastEventSource === "TABLE" ? dataSelection.instances : null;

  console.log("DATA SELECTION", dataSelection); // TODO: remove
  console.log("INSTANCES", instances); // TODO: remove
  console.log("INSTANCES FILT", instancesFilt); // TODO: remove

  // sort instances
  // TODO implement

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
      style={{ height: "100%", width: "100%" }}
      data={instancesFilt}
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
            />
          );
        },
        TableHead: Table.Thead,
        TableBody: forwardRef((props, ref) => (
          <Table.Tbody {...props} ref={ref} />
        )),
      }}
      fixedHeaderContent={() => (
        <Table.Tr>
          <Table.Th>ID</Table.Th>
          <Table.Th>#Muts</Table.Th>
          {instanceRenderType !== "hide" ? <Table.Th>Seq</Table.Th> : null}
          <Table.Th>Score</Table.Th>
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
            // TODO: render with ellipsis, and hover for full sequence
            // TODO: (could use sequence panel)
            instVisual =
              instance.entity_instances[0].rep.substring(0, 10) + "...";
          } else {
            // mutant
            // TODO: assemble into string
            instVisual = "mutant";
          }

          instRep = <Table.Td bg={bg}>{instVisual}</Table.Td>;
        }

        return (
          <>
            <Table.Td bg={bg}>
              {
                //@ts-ignore  // TODO improve types
                instance.id.replace("0:", "")
              }
            </Table.Td>
            <Table.Td bg={bg}>{instance.mutant.length}</Table.Td>
            {instRep}
            <Table.Td bg={bg}>{instance.score?.toFixed(2)}</Table.Td>
          </>
        );
      }}
    />
  );
};
