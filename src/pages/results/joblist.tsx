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
import { useViewportProperties } from "../../utils/ui.ts";

export const JobListPage = () => {
  const qJobList = useJobList();
  const { isDesktop } = useViewportProperties();

  if (qJobList.isPending) {
    return <LoadingView />;
  }

  if (qJobList.isError) {
    return <ErrorView />;
  }

  const rows = qJobList.data.jobs.map((job: JobSummary, index: number) => {
    const jobTitle = (
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
    );

    const typeBadge = (
      <Badge variant={"outline"}>
        {job.type?.replace("_", " ").replace("_", " ")}
      </Badge>
    );

    const statusBadge = <JobStatusBadge label={job.status} hideText={true} />;

    const createdAt = (
      <Text size={"sm"} c={"dimmed"}>
        {`${job.created_at}`.replace("T", " (").split(".")[0] + ")"}
      </Text>
    );

    if (isDesktop) {
      return (
        <Table.Tr key={index}>
          <Table.Td>{jobTitle}</Table.Td>
          <Table.Td>{typeBadge}</Table.Td>
          <Table.Td>{statusBadge}</Table.Td>
          <Table.Td>{createdAt}</Table.Td>
        </Table.Tr>
      );
    } else {
      return (
        <Table.Tr key={index}>
          <Table.Td>
            <Stack>
              {typeBadge}
              {jobTitle}
            </Stack>
          </Table.Td>
          <Table.Td>
            <Stack>
              {statusBadge}
              {createdAt}
            </Stack>
          </Table.Td>
        </Table.Tr>
      );
    }
  });

  const headings = isDesktop ? (
    <>
      <Table.Th>Job Name/ID</Table.Th>
      <Table.Th>Type</Table.Th>
      <Table.Th>Status</Table.Th>
      <Table.Th>Submission date</Table.Th>
    </>
  ) : (
    <>
      <Table.Th>Job Name/ID</Table.Th>
      <Table.Th>Type</Table.Th>
    </>
  );

  return (
    <BoxedLayout title={"Job results"} size={"md"}>
      <Table>
        <Table.Thead>
          <Table.Tr>{headings}</Table.Tr>
        </Table.Thead>
        <Table.Tbody>{rows}</Table.Tbody>
      </Table>
    </BoxedLayout>
  );
};
