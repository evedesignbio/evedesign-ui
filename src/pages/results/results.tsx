import {
  Badge,
  Button,
  Container,
  Group,
  Loader,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useJobData } from "../../api/modal.ts";
import { useQueryClient } from "@tanstack/react-query";
import { ResultViewer } from "./viewer.tsx";

interface ResultsWrapperProps {
  id: string;
}

export const ResultsPageWrapper = ({ id }: ResultsWrapperProps) => {
  // status options: initialized, running, failed, finished, invalid
  const qJob = useJobData(id);

  const queryClient = useQueryClient();

  let content;
  if (qJob.isSuccess) {
    let color;
    let label = qJob.data.status as string;
    let resultView = null;

    switch (qJob.data.status) {
      case "finished":
        color = "green";
        resultView = <ResultViewer results={qJob.data.results!} id={id} />;
        break;
      case "running":
        color = "orange";
        break;
      case "failed":
        color = "red";
        break;
      case "initialized":
        color = "orange";
        break;
      case "invalid":
        color = "red";
        label = "Invalid job ID";
        break;
      default:
        color = "gray";
    }
    content = (
      <>
        <Group>
          <Text>Job status:</Text>
          <Badge color={color}>{label}</Badge>
        </Group>
        {resultView}
      </>
    );
  } else if (qJob.isPending) {
    content = (
      <Group>
        <Loader type={"dots"} size={"xl"} />
      </Group>
    );
  } else if (qJob.isError) {
    content = (
      <>
        <Text>
          Something went wrong while trying to retrieve your job results.
        </Text>
        <Button onClick={() => queryClient.invalidateQueries()}>Retry</Button>
      </>
    );
  }

  return (
    <Container size="sm" pt="xl">
      <Stack>
        <Title order={1}>Job result</Title>
        <Title order={4} c="blue">
          ID: {id}
        </Title>
        {content}
      </Stack>
    </Container>
  );
};
