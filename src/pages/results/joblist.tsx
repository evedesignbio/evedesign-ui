import { useJobList } from "../../api/local.ts";
import {
  Anchor,
  Badge,
  Container,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { Link } from "wouter";

export const JobListPage = () => {
  const [jobList] = useJobList();
  return (
    <Container size="sm" pt="xl">
      <Stack>
        <Title order={1}>Previously submitted jobs</Title>
        <Text c="dimmed">
          Only jobs submitted in the same browser will be listed here
        </Text>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Job ID</Table.Th>
              <Table.Th>Job type</Table.Th>
              <Table.Th>Submission date</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {[...jobList].reverse().map((job, index) => (
              <Table.Tr key={index}>
                <Table.Td>
                  <Anchor component={Link} href={"/results/" + job.jobId}>
                    {job.jobId}
                  </Anchor>
                </Table.Td>
                <Table.Td>
                  <Badge variant={"outline"}>
                    {job.specType?.replace("_", " ").replace("_", " ")}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size={"sm"} c={"dimmed"}>
                    {job.submissionDate.replace("T", " (").split(".")[0] + ")"}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Stack>
    </Container>
  );
};
