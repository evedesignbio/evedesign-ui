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
import { Route, Switch, useRoute } from "wouter";
import {
  PipelineApiResult,
  ProteinToDnaApiResult,
  SingleMutationScanApiResult,
} from "../../models/api.ts";
import { DNAGenerationDialog } from "./dna.tsx";
import {
  EntitySpec,
  SingleMutationScanResult,
  SystemInstanceSpec,
} from "../../models/design.ts";
import { useMemo } from "react";

export interface FinishedResultsWrapperProps {
  id: string;
  results:
    | PipelineApiResult
    | SingleMutationScanApiResult
    | ProteinToDnaApiResult;
}

const singleMutationScanToInstances = (
  system: EntitySpec[],
  systemInstance: SystemInstanceSpec,
  scores: SingleMutationScanResult[],
): SystemInstanceSpec[] => {
  const instances: SystemInstanceSpec[] = [];

  scores.forEach((row: SingleMutationScanResult) => {
    row.subs.forEach((mut) => {
      // skip deletion for now
      if (mut.to === "-") {
        return;
      }

      // skip self substitution, otherwise would include once per position
      if (mut.to === row.ref) {
        return;
      }

      // make deep copy of instance to be safe
      const curInstance: SystemInstanceSpec = JSON.parse(
        JSON.stringify(systemInstance),
      );

      // mutate instance, add mutant as metadata
      const rep = curInstance.entity_instances[row.entity].rep;
      const mutIndex = row.pos - system[row.entity].first_index;

      if (rep.charAt(mutIndex) !== row.ref) {
        throw new Error(
          "Invalid reference character, this should never happen",
        );
      }

      curInstance.entity_instances[row.entity].rep =
        rep.substring(0, mutIndex) + mut.to + rep.substring(mutIndex + 1);

      curInstance.metadata = {
        mutant: `${row.entity}:${row.ref}${row.pos}${mut.to}`,
      };

      // attach to instance list
      instances.push(curInstance);
    });
  });

  return instances;
};

export const FinishedResultsPageWrapper = ({
  id,
  results,
}: FinishedResultsWrapperProps) => {
  // note that nested routes create problems with links and trailing slash, so use absolute routes here again
  const isDesignJob =
    results.spec.key === "pipeline" ||
    results.spec.key === "single_mutation_scan";

  const system = isDesignJob
    ? (results as PipelineApiResult | SingleMutationScanApiResult).spec.system
    : (results as ProteinToDnaApiResult).spec.args.system;

  let instances: SystemInstanceSpec[] | null = useMemo(() => {
    // gather instances if available
    if (results.spec.key === "pipeline") {
      return (results as PipelineApiResult).instances;
    } else if (results.spec.key === "single_mutation_scan") {
      return singleMutationScanToInstances(
        system,
        results.spec.system_instance,
        (results as SingleMutationScanApiResult).scores,
      );
    }

    // otherwise no instances available
    return null;
  }, [results]);

  // TODO: eventually render based on type of results, separate page for DNA download...
  return (
    <Switch>
      <Route path="/results/:id/dna">
        {isDesignJob && system !== null && instances !== null ? (
          <DNAGenerationDialog id={id} system={system} instances={instances} />
        ) : (
          <Text>Error: Invalid route</Text>
        )}
      </Route>
      <Route path="/results/:id">
        <ResultViewer results={results!} id={id} />
      </Route>
      <Route>
        <Text>Error: Invalid route</Text>
      </Route>
    </Switch>
  );
};

interface ResultsWrapperProps {
  id: string;
}

export const ResultsPageWrapper = ({ id }: ResultsWrapperProps) => {
  // status options: initialized, running, failed, finished, invalid
  const qJob = useJobData(id);
  const queryClient = useQueryClient();
  const [isDnaView, _] = useRoute("*/dna");

  let content;
  if (qJob.isSuccess) {
    let color;
    let label = qJob.data.status as string;
    let resultView = null;
    let jobType = qJob.data.results?.spec.key;

    switch (qJob.data.status) {
      case "finished":
        color = "green";
        resultView = (
          <FinishedResultsPageWrapper results={qJob.data.results!} id={id} />
        );
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
          {jobType ? (
            <Badge variant={"outline"}>
              {jobType.replace("_", " ").replace("_", " ")}
            </Badge>
          ) : null}
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
        <Title order={1}>
          {isDnaView ? "DNA library generation" : "Job result"}
        </Title>
        <Title order={4} c="blue">
          ID: {id}
        </Title>
        {content}
      </Stack>
    </Container>
  );
};
