import {
  Alert,
  Button,
  Group,
  Modal,
  Select,
  Space,
  Stack,
} from "@mantine/core";
import { useJobData } from "../../api/backend.ts";
import { AnalysisViewer } from "./viewer.tsx";
import {
  DesignJobApiResult,
  PipelineApiResult,
  ProteinToDnaApiResult,
  SingleMutationScanApiResult,
} from "../../models/api.ts";
import { DNAGenerationDialog } from "./dna.tsx";
import { useState } from "react";
import {
  BoxedLayout,
  ErrorView,
  JobStatusBadge,
  LoadingView,
  useDownloadButton,
} from "./helpers.tsx";
import { useViewportProperties } from "../../utils/ui.ts";
import { useInstances } from "./data.ts";
import { useDisclosure } from "@mantine/hooks";
import { InstanceDownloadMenu } from "./elements.tsx";
import { InputSpecTypeKeys } from "../../models/design.ts";

export interface FinishedResultsWrapperProps {
  id: string;
  name: string | null;
  results:
    | PipelineApiResult
    | SingleMutationScanApiResult
    | ProteinToDnaApiResult;
  jobType: InputSpecTypeKeys;
  projectId: string | null;
  isPublic: boolean;
}

export interface DownloadViewerProps {
  id: string;
  name: string | null;
  results:
    | PipelineApiResult
    | SingleMutationScanApiResult
    | ProteinToDnaApiResult;
  message?: string;
  projectId: string | null;
  isPublic: boolean;
}

interface InstanceDownloadProps {
  results: PipelineApiResult | SingleMutationScanApiResult;
  id: string;
  projectId: string | null;
  isPublic: boolean;
}

export const InstanceDownload = ({
  id,
  results,
  projectId = null,
  isPublic = false,
}: InstanceDownloadProps) => {
  const [dnaOpen, { toggle: toggleDnaOpen }] = useDisclosure(false);
  const enhancedInstances = useInstances(results);

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
          system={results.spec.system}
          instances={enhancedInstances.instances}
          parentJobId={id}
          projectId={projectId}
          isPublic={isPublic}
        />
      </BoxedLayout>
    </Modal>
  );

  return (
    <>
      {dnaModal}
      <InstanceDownloadMenu
        id={id}
        instances={enhancedInstances.instances}
        basket={null}
      />
      <Space />
      <Button onClick={toggleDnaOpen}>Build DNA sequences...</Button>
    </>
  );
};

interface NucleotidesDownloadProps {
  results: ProteinToDnaApiResult;
  id: string;
}

export const NucleotidesDownload = ({
  results,
  id,
}: NucleotidesDownloadProps) => {
  const [downloadFormat, setDownloadFormat] = useState<string | null>(null);
  // create download conditionally to avoid using to many resources in browser
  const downloadButton = useDownloadButton(results, downloadFormat, id);

  return (
    <Group>
      <Select
        placeholder="Select a file format"
        data={["csv", "fasta", "json"].filter((option) => option !== "fasta")}
        value={downloadFormat}
        onOptionSubmit={setDownloadFormat}
      />
      {downloadButton}
    </Group>
  );
};

export const DownloadOnlyViewer = ({
  results,
  id,
  name,
  message,
  isPublic = false,
  projectId = null,
}: DownloadViewerProps) => {
  const isDesignJob =
    results.spec?.key === "pipeline" ||
    results.spec?.key === "single_mutation_scan";

  // build instances for DNA generation
  // let instances: SystemInstanceSpec[] | null = useMemo(() => {
  //   // gather instances if available
  //   if (results.spec?.key === "pipeline") {
  //     return (results as PipelineApiResult).instances;
  //   } else if (results.spec?.key === "single_mutation_scan") {
  //     return singleMutationScanToInstances(
  //       results.spec.system,
  //       results.spec.system_instance,
  //       (results as SingleMutationScanApiResult).scores,
  //     );
  //   }
  //
  //   // otherwise no instances available
  //   return null;
  // }, [results]);

  return (
    <>
      <BoxedLayout id={id} name={name} title={"Job result"}>
        <JobStatusBadge
          label={"finished"}
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
          {isDesignJob ? (
            <InstanceDownload
              id={id}
              results={results as DesignJobApiResult}
              projectId={projectId}
              isPublic={isPublic}
            />
          ) : (
            <NucleotidesDownload
              id={id}
              results={results as ProteinToDnaApiResult}
            />
          )}
        </Stack>
      </BoxedLayout>
    </>
  );
};

export const FinishedResultsPageWrapper = ({
  id,
  name,
  results,
  jobType,
  projectId = null,
  isPublic = false,
}: FinishedResultsWrapperProps) => {
  // render result view depending on screen size; only display
  // full result viewer when minimal width is available, otherwise display download view only
  const viewportProps = useViewportProperties();

  // const jobType = results.spec.key;

  // design or codon job?
  const isDesignJob =
    jobType === "pipeline" || jobType === "single_mutation_scan";

  // don't render anything until we have a defined width
  if (viewportProps.screenSize.width === 0) return <></>;

  if (isDesignJob && viewportProps.isDesktop) {
    return (
      <AnalysisViewer
        id={id}
        results={results! as DesignJobApiResult}
        name={name}
        projectId={projectId}
        isPublic={isPublic}
      />
    );
  } else {
    return (
      <DownloadOnlyViewer
        results={results!}
        id={id}
        name={name}
        message={
          isDesignJob
            ? "Use a device with a larger screen or resize your browser window to display full analysis viewer"
            : undefined
        }
        projectId={projectId}
        isPublic={isPublic}
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

  if (qJob.isSuccess) {
    const jobType = qJob.data.type;
    const status = qJob.data.status;
    const name = qJob.data.name;

    // finished jobs have different rendering requirements (full page width etc.)
    // so defer full rendering to finished result page in this case
    if (status === "finished") {
      return (
        <FinishedResultsPageWrapper
          results={qJob.data.results!}
          id={id}
          name={qJob.data.name}
          jobType={jobType}
          projectId={qJob.data.project_id}
          isPublic={qJob.data.public}
        />
      );
    } else {
      // otherwise render different flavors of standard view
      let label = qJob.data.status as string;
      return (
        <BoxedLayout title={"Job result"} id={id} name={name}>
          <JobStatusBadge label={label} jobType={jobType} />
        </BoxedLayout>
      );
    }
  } else if (qJob.isPending) {
    return <LoadingView />;
  } else if (qJob.isError) {
    return <ErrorView id={id} />;
  }
};
