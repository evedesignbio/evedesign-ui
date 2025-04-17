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

  return (
    <Container size="sm" pt="xl">
      <Stack>
        <Title order={1}>Previously submitted jobs</Title>
        <Text c="dimmed">
          Only jobs submitted in the same browser will be listed here
        </Text>
        <Space h="md" />
        <Stack>
          {[...jobList].reverse().map((job, index) => (
            <Group key={index}>
              <Anchor component={Link} href={"/results/" + job.jobId}>
                {job.jobId}
              </Anchor>
              <Text>{job.submissionDate}</Text>
            </Group>
          ))}
        </Stack>
      </Stack>
    </Container>
  );
};
