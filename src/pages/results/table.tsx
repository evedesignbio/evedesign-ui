import { TableVirtuoso } from "react-virtuoso";
import {
  SystemInstanceSpec,
  SystemInstanceSpecEnhanced,
} from "../../models/design.ts";
import { Table } from "@mantine/core";
import { forwardRef } from "react";
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

  const instancesDisplay = instances;
  // const instancesDisplay = useMemo(() => {
  //   if (
  //     !dataSelection.lastEventSource ||
  //     dataSelection.lastEventSource === "TABLE"
  //   ) {
  //     // if selection happens from inside table panel, show all instances
  //     return instances;
  //   } else {
  //     // if selection happens from outside table panel, filter down what will be displayed;
  //     // for now, only one of these filters will be active by convention
  //     // TODO: revisit this for sequence space plot - will need to filter by instance too unless single instance?
  //     // TODO: scroll if single instance selected
  //     if (dataSelection.mutations.size > 0) {
  //       return filterByMutationSelection(instances, dataSelection.mutations);
  //     } else if (dataSelection.positions.size > 0) {
  //       return filterByPositionSelection(instances, dataSelection.positions);
  //     } else if (dataSelection.instances.size > 1) {
  //       return filterByInstanceSelection(instances, dataSelection.instances);
  //     } else {
  //       return instances;
  //     }
  //   }
  // }, [instances, dataSelection]);

  // TODO: revisit this for sequence space plot - will need to filter by instance too unless single instance?
  const selectedIds =
    dataSelection.lastEventSource === "TABLE"
      ? dataSelection.instances
      : dataSelection.instances;

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
