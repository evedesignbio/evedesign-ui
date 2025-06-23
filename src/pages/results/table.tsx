import { TableVirtuoso } from "react-virtuoso";
import { SystemInstanceSpec } from "../../models/design.ts";
import { Table } from "@mantine/core";
import { forwardRef } from "react";
import { extractModifiers } from "../../utils/events.tsx";

export interface InstanceTableProps {
  instances: SystemInstanceSpec[];
}

export const InstanceTable = ({ instances }: InstanceTableProps) => {
  // TODO: render number of mutations
  // TODO: render sequence
  // TODO: click handler
  // TODO: color effect score
  // TODO: add sorting/filtering
  // TODO: memoize rendering as needed
  // TODO: striped background rendering (considering theme)

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
      itemContent={(index, instance) => {
        // map item to general handler
        const handler = (event: any) => {
          // TODO: attach proper event handler via props
          console.log("TABLE CLICK", index, extractModifiers(event));
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
                instance.metadata?.mutant ? instance.metadata?.mutant : index
              }
            </Table.Td>
            <Table.Td style={style} onClick={handler}>
              1
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
