import { Anchor, Badge, Stack, Table, Text } from "@mantine/core";
import { Link } from "wouter";
import { useJobList } from "../../api/backend.ts";
import {
  BoxedLayout,
  ErrorView,
  JobStatusBadge,
  LoadingView,
} from "./helpers.tsx";
import { JobSummary } from "../../models/api.ts";

export const JobListPage = () => {
  const qJobList = useJobList();

  if (qJobList.isPending) {
    return <LoadingView />;
  }

  if (qJobList.isError) {
    return <ErrorView />;
  }

  return (
    <BoxedLayout title={"Job results"} size={"md"}>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Job Name/ID</Table.Th>
            <Table.Th>Type</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Submission date</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {qJobList.data.jobs.map((job: JobSummary, index: number) => (
            <Table.Tr key={index}>
              <Table.Td>
                <Anchor component={Link} href={"/results/" + job.id}>
                  {job.name ? (
                    <Stack gap={0}>
                      <Text>{job.name}</Text>
                      <Text size={"xs"}>{job.id}</Text>
                    </Stack>
                  ) : (
                    job.id
                  )}
                </Anchor>
              </Table.Td>
              <Table.Td>
                <Badge variant={"outline"}>
                  {job.type?.replace("_", " ").replace("_", " ")}
                </Badge>
              </Table.Td>
              <Table.Td>
                <JobStatusBadge label={job.status} hideText={true} />
              </Table.Td>
              <Table.Td>
                <Text size={"sm"} c={"dimmed"}>
                  {`${job.created_at}`.replace("T", " (").split(".")[0] + ")"}
                </Text>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </BoxedLayout>
  );
};
