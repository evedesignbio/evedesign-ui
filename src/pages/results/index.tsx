import {
  Alert,
  Button,
  Group,
  Loader,
  Modal,
  Select,
  Space,
  Stack,
  Text,
} from "@mantine/core";
import { useJobData } from "../../api/modal.ts";
import { useQueryClient } from "@tanstack/react-query";
import { AnalysisViewer } from "./viewer.tsx";
import {
  DesignJobApiResult,
  PipelineApiResult,
  ProteinToDnaApiResult,
  SingleMutationScanApiResult,
} from "../../models/api.ts";
import { DNAGenerationDialog } from "./dna.tsx";
import { SystemInstanceSpec } from "../../models/design.ts";
import { useMemo, useState } from "react";
import { BoxedLayout, JobStatusBadge, useDownloadButton } from "./helpers.tsx";
import { useViewportProperties } from "../../utils/ui.ts";
import { singleMutationScanToInstances } from "./data.ts";
import { useDisclosure } from "@mantine/hooks";

export interface FinishedResultsWrapperProps {
  id: string;
  results:
    | PipelineApiResult
    | SingleMutationScanApiResult
    | ProteinToDnaApiResult;
}

export interface DownloadViewerProps {
  id: string;
  results:
    | PipelineApiResult
    | SingleMutationScanApiResult
    | ProteinToDnaApiResult;
  message?: string;
}

export const DownloadOnlyViewer = ({
  results,
  id,
  message,
}: DownloadViewerProps) => {
  const [dnaOpen, { toggle: toggleDnaOpen }] = useDisclosure(false);
  const [downloadFormat, setDownloadFormat] = useState<string | null>(null);
  // create download conditionally to avoid using to many resources in browser
  const downloadButton = useDownloadButton(results, downloadFormat, id);

  const isDesignJob =
    results.spec?.key === "pipeline" ||
    results.spec?.key === "single_mutation_scan";

  // build instances for DNA generation
  let instances: SystemInstanceSpec[] | null = useMemo(() => {
    // gather instances if available
    if (results.spec?.key === "pipeline") {
      return (results as PipelineApiResult).instances;
    } else if (results.spec?.key === "single_mutation_scan") {
      return singleMutationScanToInstances(
        results.spec.system,
        results.spec.system_instance,
        (results as SingleMutationScanApiResult).scores,
      );
    }

    // otherwise no instances available
    return null;
  }, [results]);

  const dnaModal = (
    <Modal
      opened={dnaOpen}
      onClose={toggleDnaOpen}
      size={"auto"}
      overlayProps={{
        blur: 3,
      }}
      fullScreen={true}
      transitionProps={{ transition: "fade", duration: 200 }}
    >
      <BoxedLayout title={"DNA library generation"}>
        <DNAGenerationDialog
          id={id}
          system={(results as DesignJobApiResult).spec.system}
          instances={instances!}
        />
      </BoxedLayout>
    </Modal>
  );

  return (
    <>
      {dnaModal}
      <BoxedLayout id={id} title={"Job result"}>
        <JobStatusBadge
          label={"finished"}
          color={"green"}
          jobType={results.spec.key}
        />
        <Stack>
          {message ? (
            <>
              <Space />
              <Alert>{message}</Alert>
            </>
          ) : null}
          <Space />
          <Group>
            <Select
              placeholder="Select a file format"
              data={["csv", "fasta", "json"].filter(
                (option) =>
                  results.spec?.key === "pipeline" || option !== "fasta",
              )}
              value={downloadFormat}
              onOptionSubmit={setDownloadFormat}
            />
            {downloadButton}
          </Group>
          {isDesignJob ? (
            <>
              <Space />
              <Button onClick={toggleDnaOpen}>Build DNA sequences...</Button>
            </>
          ) : null}
        </Stack>
      </BoxedLayout>
    </>
  );
};

export const FinishedResultsPageWrapper = ({
  id,
  results,
}: FinishedResultsWrapperProps) => {
  // TODO: temporary lock on showing result viewer in productino

  // render result view depending on screen size; only display
  // full result viewer when minimal width is available, otherwise display download view only
  const viewportProps = useViewportProperties();

  const jobType = results.spec.key;

  // design or codon job?
  const isDesignJob =
    jobType === "pipeline" || jobType === "single_mutation_scan";

  // don't render anything until we have a defined width
  if (viewportProps.screenSize.width === 0) return <></>;

  if (isDesignJob && viewportProps.isDesktop) {
    return <AnalysisViewer id={id} results={results! as DesignJobApiResult} />;
  } else {
    return (
      <DownloadOnlyViewer
        results={results!}
        id={id}
        message={
          isDesignJob
            ? "Use a device with a larger screen or resize your browser window to display full analysis viewer"
            : undefined
        }
      />
    );
  }
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
