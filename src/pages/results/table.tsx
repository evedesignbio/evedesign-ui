import { TableVirtuoso } from "react-virtuoso";
import {
  SystemInstanceSpec,
  SystemInstanceSpecEnhanced,
} from "../../models/design.ts";
import { Table } from "@mantine/core";
import { forwardRef } from "react";
import { extractModifiers, Modifiers } from "../../utils/events.tsx";
import { DataInteractionReducerDispatchFunc } from "./reducers.ts";

export type InstanceTableEventHandler = (
  instance: SystemInstanceSpec,
  index: number,
  modifiers: Modifiers,
) => void;

export interface InstanceTableProps {
  instances: SystemInstanceSpecEnhanced[];
  dispatchDataSelection?: DataInteractionReducerDispatchFunc;
}

export const InstanceTable = ({
  instances,
  dispatchDataSelection = undefined,
}: InstanceTableProps) => {
  // TODO: render number of mutations
  // TODO: render sequence
  // TODO: click handler
  // TODO: color effect score
  // TODO: add sorting/filtering
  // TODO: memoize rendering as needed
  // TODO: striped background rendering (considering theme)
  // TODO: prop whether to show mutants or sequence of designed positions (with ellipsis)
  // TODO: implement selection of range of designs with shift key (all up or down from last selection)

  return (
    <TableVirtuoso
      style={{ height: "100%", width: "100%" }}
      data={instances}
      components={{
        Table: (props) => (
          <Table
            {...{
              ...props,
              highlightOnHover: true,
              verticalSpacing: 5,
              style: { ...props.style },
            }}
          />
        ),
        TableRow: Table.Tr,
        TableHead: Table.Thead,
        TableBody: forwardRef((props, ref) => (
          <Table.Tbody {...props} ref={ref} />
        )),
      }}
      fixedHeaderContent={() => (
        <Table.Tr>
          <Table.Th>ID</Table.Th>
          <Table.Th>#Muts</Table.Th>
          <Table.Th>Score</Table.Th>
        </Table.Tr>
      )}
      itemContent={(_index, instance) => {
        // map current item to general event handler
        const handler = (event: any) => {
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

        // calculate if even or odd cell for striped background (cannot use CSS; see comment above)
        // const evenIndex = index % 2 === 0;
        const style = {
          // backgroundColor: evenIndex ? "var(--table-striped-color)" : undefined,
        };

        return (
          <>
            <Table.Td style={style} onClick={handler}>
              {
                //@ts-ignore  // TODO improve types
                instance.id
              }
            </Table.Td>
            <Table.Td style={style} onClick={handler}>
              {instance.mutant.length}
            </Table.Td>
            <Table.Td style={style} onClick={handler}>
              {instance.score?.toFixed(2)}
            </Table.Td>
          </>
        );
      }}
    />
  );
};
