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
import { ReactNode, useMemo } from "react";
import {
  PipelineApiResult,
  ProteinToDnaApiResult,
  SingleMutationScanApiResult,
} from "../../models/api.ts";
import { validTranslation } from "../../utils/bio.ts";
import { SystemInstanceSpecEnhanced } from "../../models/design.ts";
import { download } from "../../utils/download.ts";
import { useQueryClient } from "@tanstack/react-query";

const SCORE_NUM_DIGITS = 3;

interface BoxedLayoutProps {
  children: ReactNode;
  title?: string;
  id?: string;
  name?: string | null;
  size?: string;
}

// simple layout wrapper for result/status panels except main result viewer
export const BoxedLayout = ({
  children,
  title,
  id,
  name,
  size = "sm",
}: BoxedLayoutProps) => {
  // {isDnaView ? "DNA library generation" : "Job result"}
  return (
    <Container size={size} pt="xl">
      <Stack>
        {title ? <Title order={1}>{title}</Title> : null}
        {id ? (
          <Title order={4} c="blue">
            ID: {id}
          </Title>
        ) : null}
        {name ? (
          <Title order={4} c="blue">
            {name}
          </Title>
        ) : null}
        {children}
      </Stack>
    </Container>
  );
};

export const LoadingView = () => (
  <BoxedLayout>
    <Group justify="center">
      <Loader type={"dots"} size={"xl"} />
    </Group>
  </BoxedLayout>
);

interface ErrorViewProps {
  id?: string;
}

export const ErrorView = ({ id }: ErrorViewProps) => {
  const queryClient = useQueryClient();
  return (
    <BoxedLayout title={"Error"} id={id}>
      <Text>
        Something went wrong while trying to retrieve your job results.
      </Text>
      <Button onClick={() => queryClient.invalidateQueries()}>Retry</Button>
    </BoxedLayout>
  );
};

interface JobStatusBadgeProps {
  label: string;
  jobType?: string;
  hideText?: boolean;
}

export const JobStatusBadge = ({
  label,
  jobType,
  hideText,
}: JobStatusBadgeProps) => {
  let color;
  switch (label) {
    case "running":
      color = "orange";
      break;
    case "failed":
      color = "red";
      break;
    case "terminated":
      color = "red";
      break;
    case "paused":
      color = "red";
      break;
    case "initialized":
      color = "orange";
      break;
    case "pending":
      color = "orange";
      break;
    case "finished":
      color = "green";
      break;
    case "invalid":
      color = "red";
      label = "Invalid job ID";
      break;
    default:
      color = "gray";
  }

  return (
    <Group>
      {!hideText ? <Text>Status:</Text> : null}
      <Badge color={color}>{label}</Badge>
      {jobType ? (
        <Badge variant={"outline"}>
          {jobType.replace("_", " ").replace("_", " ")}
        </Badge>
      ) : null}
    </Group>
  );
};
export const useDownloadButton = (
  results:
    | PipelineApiResult
    | SingleMutationScanApiResult
    | ProteinToDnaApiResult,
  format: string | null,
  id: string,
) => {
  return useMemo(() => {
    if (format === null) {
      return (
        <Button variant="default" disabled={true}>
          Download
        </Button>
      );
    }

    let dataOut = "";
    if (results.spec.key === "pipeline") {
      const instances = (results as PipelineApiResult).instances;
      if (format === "json") {
        dataOut = JSON.stringify(instances);
      } else if (format === "csv") {
        dataOut = instances
          .map(
            (x, index) =>
              `${index + 1},${x.score?.toFixed(SCORE_NUM_DIGITS)},${x.entity_instances[0].rep}`,
          )
          .join("\n");
        dataOut = "id,score,sequence\n" + dataOut;
      } else if (format === "fasta") {
        dataOut = instances
          .map(
            (x, index) =>
              `>${index + 1} score=${x.score?.toFixed(SCORE_NUM_DIGITS)}\n${x.entity_instances[0].rep}\n`,
          )
          .join("");
      } else {
        throw new Error("Unsupported format");
      }
    } else if (results.spec.key === "single_mutation_scan") {
      const scores = (results as SingleMutationScanApiResult).scores;
      if (format === "json") {
        dataOut = JSON.stringify(scores);
      } else if (format === "csv") {
        // header first, exclude gaps for now
        const aaOrdered = scores[0].subs
          .filter((s) => s.to !== "-")
          .map((s) => s.to);
        dataOut = ["pos", "ref"].concat(aaOrdered).join(",") + "\n";

        // then data rows
        dataOut += scores
          .map((row) =>
            [row.pos, row.ref]
              .concat(
                row.subs
                  .filter((s) => s.to !== "-") // exclude gaps for now
                  .map((s, index) => {
                    if (aaOrdered[index] !== s.to) {
                      throw new Error(
                        "Mutations out of order, need better implementation of file writing",
                      );
                    }
                    return s.score.toFixed(SCORE_NUM_DIGITS);
                  }),
              )
              .join(","),
          )
          .join("\n");
      } else {
        throw new Error("Unsupported format");
      }
    } else if (results.spec.key === "protein_to_dna") {
      const dnaResult = results as ProteinToDnaApiResult;
      const upstream = dnaResult.spec.args.upstream_dna;
      const downstream = dnaResult.spec.args.downstream_dna;
      const instances = dnaResult.spec.args.system_instances;

      if (format === "json") {
        dataOut = JSON.stringify(dnaResult.dna_sequences);
      } else if (format === "csv") {
        dataOut = dnaResult.dna_sequences
          .map((x, index) => {
            if (!validTranslation(x.dna, x.rep))
              throw new Error(
                "DNA sequence does not translate into AA sequence, this should never happen",
              );
            return `${index === 0 && instances[index].id === null ? "target" : instances[index].id},${upstream + x.dna + downstream},${x.rep},${x.score?.toFixed(SCORE_NUM_DIGITS)}`;
          })
          .join("\n");
        dataOut = "id,dna_seq,aa_seq,codon_optimization_score\n" + dataOut;
      }
    } else {
      throw new Error("invalid spec key");
    }

    const blob = new Blob([dataOut], { type: "text/plain" });
    const url = URL.createObjectURL(blob);

    return (
      <Button
        variant="default"
        component="a"
        href={url}
        download={`${id}.${format}`}
      >
        Download
      </Button>
    );
  }, [results, format, id]);
};

export const downloadInstances = (
  enhancedInstances: SystemInstanceSpecEnhanced[],
  basket: Set<String> | null,
  fileName: string,
  format: "csv" | "fasta",
) => {
  // filter instances to basket selection
  const instFilt = enhancedInstances.filter(
    (inst) => basket === null || basket.has(inst.id),
  );

  let dataOut = "";
  if (format === "csv") {
    dataOut = instFilt
      .map(
        (x) =>
          `${x.id},${x.score?.toFixed(SCORE_NUM_DIGITS)},${x.entity_instances[0].rep}`,
      )
      .join("\n");
    dataOut = "id,score,sequence\n" + dataOut;
  } else if (format === "fasta") {
    dataOut = instFilt
      .map(
        (x) =>
          `>${x.id} score=${x.score?.toFixed(SCORE_NUM_DIGITS)}\n${x.entity_instances[0].rep}\n`,
      )
      .join("");
  } else {
    throw new Error("Unsupported format");
  }

  download(dataOut, `${fileName}.${format}`, "text/plain");
};
