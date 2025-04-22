import { useMemo, useState } from "react";
import { Button, Group, Select, Space, Stack } from "@mantine/core";
import {
  PipelineApiResult,
  SingleMutationScanApiResult,
} from "../../models/api.ts";

export interface ResultViewerProps {
  id: string;
  results: PipelineApiResult | SingleMutationScanApiResult;
}

const SCORE_NUM_DIGITS = 3;

const useDownloadButton = (
  results: PipelineApiResult | SingleMutationScanApiResult,
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
        // header first
        const aaOrdered = scores[0].subs.map((s) => s.to);
        dataOut = ["pos", "ref"].concat(aaOrdered).join(",") + "\n";

        // then data rows
        dataOut += scores
          .map((row) =>
            [row.pos, row.ref]
              .concat(
                row.subs.map((s, index) => {
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

export const ResultViewer = ({ results, id }: ResultViewerProps) => {
  const [downloadFormat, setDownloadFormat] = useState<string | null>(null);
  // create download conditionally to avoid using to many resources in browser
  const downloadButton = useDownloadButton(results, downloadFormat, id);

  return (
    <Stack>
      <Space />
      <Group>
        <Select
          placeholder="Select a file format"
          data={["csv", "fasta", "json"].filter(
            (option) =>
              results.spec.key !== "single_mutation_scan" || option !== "fasta",
          )}
          value={downloadFormat}
          onOptionSubmit={setDownloadFormat}
        />
        {downloadButton}
      </Group>
      <Space />
      <Button disabled={true}>Analyze and cluster designs</Button>
      <Space />
      <Button disabled={true}>Generate DNA sequences</Button>
    </Stack>
  );
};
