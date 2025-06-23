import {
  Button,
  Group,
  Loader,
  Select,
  Space,
  Stack,
  Text,
} from "@mantine/core";
import { useJobData } from "../../api/modal.ts";
import { useQueryClient } from "@tanstack/react-query";
import { AnalysisViewer, ResultViewerProps } from "./viewer.tsx";
import { Link, Route, Switch } from "wouter";
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
import { useMemo, useState } from "react";
import { BoxedLayout, JobStatusBadge, useDownloadButton } from "./helpers.tsx";
import { useViewportSize } from "@mantine/hooks";

const MIN_WIDTH_FOR_FULL_VIEWER = 800;

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

      curInstance.score = mut.score;
      curInstance.metadata = {
        mutant: `${row.entity}:${row.ref}${row.pos}${mut.to}`,
      };

      // attach to instance list
      instances.push(curInstance);
    });
  });

  return instances;
};

export const DownloadOnlyViewer = ({ results, id }: ResultViewerProps) => {
  const [downloadFormat, setDownloadFormat] = useState<string | null>(null);
  // create download conditionally to avoid using to many resources in browser
  const downloadButton = useDownloadButton(results, downloadFormat, id);

  const isDesignJob =
    results.spec?.key === "pipeline" ||
    results.spec?.key === "single_mutation_scan";

  return (
    <Stack>
      <Space />
      <Group>
        <Select
          placeholder="Select a file format"
          data={["csv", "fasta", "json"].filter(
            (option) => results.spec?.key === "pipeline" || option !== "fasta",
          )}
          value={downloadFormat}
          onOptionSubmit={setDownloadFormat}
        />
        {downloadButton}
      </Group>
      {isDesignJob ? (
        <>
          <Space />
          <Button component={Link} href={`/results/${id}/dna`}>
            Generate DNA sequences...
          </Button>
        </>
      ) : null}
    </Stack>
  );
};
export const FinishedResultsPageWrapper = ({
  id,
  results,
}: FinishedResultsWrapperProps) => {
  // render result view depending on screen size; only display
  // full result viewer when minimal width is available, otherwise display download view only
  const { width } = useViewportSize();

  const jobType = results.spec.key;

  // design or codon job?
  const isDesignJob =
    jobType === "pipeline" || jobType === "single_mutation_scan";

  const system = isDesignJob
    ? (results as PipelineApiResult | SingleMutationScanApiResult).spec.system
    : (results as ProteinToDnaApiResult).spec.args.system;

  // build instances for DNA generation - TODO eventually move this somewhere else together with DNA submission form?
  let instances: SystemInstanceSpec[] | null = useMemo(() => {
    // gather instances if available
    if (jobType === "pipeline") {
      return (results as PipelineApiResult).instances;
    } else if (jobType === "single_mutation_scan") {
      return singleMutationScanToInstances(
        system,
        results.spec.system_instance,
        (results as SingleMutationScanApiResult).scores,
      );
    }

    // otherwise no instances available
    return null;
  }, [results]);

  // don't render anything until we have a defined width
  if (width === 0) return <></>;

  const showFullInstanceViewer = isDesignJob && width >= MIN_WIDTH_FOR_FULL_VIEWER;

  // TODO: eventually render based on type of results, separate page for DNA download...
  // TODO: display message if screen size too small for protein viewer

  // note that nested routes create problems with links and trailing slash, so use absolute routes here again
  return (
    <Switch>
      <Route path="/results/:id/dna">
        {isDesignJob && system !== null && instances !== null ? (
          <BoxedLayout title={"DNA library generation"}>
            <DNAGenerationDialog
              id={id}
              system={system}
              instances={instances}
            />
          </BoxedLayout>
        ) : (
          <Text>Error: Invalid route</Text>
        )}
      </Route>
      <Route path="/results/:id">
        {showFullInstanceViewer ? (
          <AnalysisViewer
            id={id}
            results={
              results! as PipelineApiResult | SingleMutationScanApiResult
            }
          />
        ) : (
          <BoxedLayout id={id} title={"Job result"}>
            <JobStatusBadge
              label={"finished"}
              color={"green"}
              jobType={jobType}
            />
            <DownloadOnlyViewer results={results!} id={id} />
          </BoxedLayout>
        )}
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

  if (qJob.isSuccess) {
    const jobType = qJob.data.results?.spec.key!;
    const status = qJob.data.status;

    // finished jobs have different rendering requirements (full page width etc.)
    // so defer full rendering to finished result page in this case
    if (status === "finished") {
      return (
        <FinishedResultsPageWrapper results={qJob.data.results!} id={id} />
      );
    } else {
      // otherwise render different flavors of standard view
      let color;
      let label = qJob.data.status as string;
      switch (status) {
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
      return (
        <BoxedLayout title={"Job result"} id={id}>
          <JobStatusBadge label={label} color={color} jobType={jobType} />
        </BoxedLayout>
      );
    }
  } else if (qJob.isPending) {
    return (
      <BoxedLayout>
        <Group justify="center">
          <Loader type={"dots"} size={"xl"} />
        </Group>
      </BoxedLayout>
    );
  } else if (qJob.isError) {
    return (
      <BoxedLayout title={"Error"} id={id}>
        <Text>
          Something went wrong while trying to retrieve your job results.
        </Text>
        <Button onClick={() => queryClient.invalidateQueries()}>Retry</Button>
      </BoxedLayout>
    );
  }
};
