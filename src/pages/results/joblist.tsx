import { useJobList } from "../../api/local.ts";
import {
  Anchor,
  Container,
  Group,
  Space,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { Link } from "wouter";

export const JobListPage = () => {
  const [jobList] = useJobList();

  console.log("JOBS", jobList); // TODO: remove

  return (
    <Container size="sm" pt="xl">
      <Title order={1}>Previously submitted jobs</Title>
      <Text c="dimmed">
        Only jobs submitted in the same browser will be listed here
      </Text>
      <Space h="xl" />
      <Stack>
        {[...jobList].reverse().map((job, index) => (
          <Group>
            <Anchor component={Link} key={index} href={"/results/" + job.jobId}>
              {job.jobId}
            </Anchor>
            <Text>{job.submissionDate}</Text>
          </Group>
        ))}
      </Stack>
    </Container>
  );
};
