import { useMemo, useState } from "react";
import {
  Button,
  Group,
  Select,
  Space,
  Stack,
  useComputedColorScheme,
  useMantineTheme,
} from "@mantine/core";
import {
  PipelineApiResult,
  ProteinToDnaApiResult,
  SingleMutationScanApiResult,
} from "../../models/api.ts";
import { Link } from "wouter";
import { validTranslation } from "../../utils/bio.ts";
import {
  Molstar,
  RawStructure,
  Representation,
} from "../../components/structureviewer/molstar.tsx";
import { Color } from "molstar/lib/mol-util/color";
import { useQuery } from "@tanstack/react-query";

// TODO: improve props, receive list of instances/scores + spec
export interface ResultViewerProps {
  id: string;
  results:
    | PipelineApiResult
    | SingleMutationScanApiResult
    | ProteinToDnaApiResult;
}

const SCORE_NUM_DIGITS = 3;

const useDownloadButton = (
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

      if (format === "json") {
        dataOut = JSON.stringify(dnaResult.dna_sequences);
      } else if (format === "csv") {
        dataOut = dnaResult.dna_sequences
          .map((x, index) => {
            if (!validTranslation(x.dna, x.rep))
              throw new Error(
                "DNA sequence does not translate into AA sequence, this should never happen",
              );
            return `${index + 1},${upstream + x.dna + downstream},${x.rep},${x.score?.toFixed(SCORE_NUM_DIGITS)}`;
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

const DEFAULT_STYLE: Representation[] = [
  {
    component: "protein",
    props: {
      type: "cartoon",
      // color: "sequencemap-custom",
      // color: "secondary-structure",
      // colorParams: { default: Color(0xff0000) },
      //
      // color: "sequence-id",
      // colorParams: def,
    },
    // props: { type: "cartoon", color: "residue-id", colorParams: def },
  },
  {
    component: "ligand",
    props: {
      type: "ball-and-stick",
      color: "uniform",
      colorParams: { value: Color(0x676767) },
    },
  },
];

export const ResultViewer = ({ results, id }: ResultViewerProps) => {
  const [downloadFormat, setDownloadFormat] = useState<string | null>(null);
  // create download conditionally to avoid using to many resources in browser
  const downloadButton = useDownloadButton(results, downloadFormat, id);

  // TODO: dummy molstar visual
  // TODO: reenable debounced resizing
  const theme = useMantineTheme();
  const computedColorScheme = useComputedColorScheme("light", {
    getInitialValueInEffect: true,
  });

  const qs = useQuery({
    queryKey: ["structure"],
    queryFn: () =>
      // axios
      fetch("https://files.rcsb.org/view/6gj7.cif")
        .then((res) => res.text())
        .then((res): RawStructure[] => [
          { id: "6gj7_custom", data: res, format: "mmcif", visible: true },
        ]),
    staleTime: Infinity,
  });

  const structure = (
    <div
      style={{
        height: "35vh",
        width: "100%",
        position: "relative",
        resize: "both",
        overflow: "auto",
      }}
    >
      <Molstar
        structures={qs.isSuccess ? qs.data : []}
        representations={DEFAULT_STYLE}
        siteHighlights={[]}
        pairHighlights={[]}
        showAxes={false}
        backgroundColor={
          computedColorScheme === "dark"
            ? Color.fromHexStyle(theme.colors.dark[7]) // cf. https://mantine.dev/styles/css-variables-list/
            : Color(0x000000)  // cf. https://mantine.dev/styles/css-variables-list/
        }
      />
    </div>
  );
  // TODO: end dummy molstar wrapper

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
      {results.spec?.key === "pipeline" ||
      results.spec?.key === "single_mutation_scan" ? (
        <>
          <Space />
          <Button disabled={true}>
            Analyze and cluster designs (coming soon)
          </Button>
          <Space />
          <Button component={Link} href={`/results/${id}/dna`}>
            Generate DNA sequences...
          </Button>
        </>
      ) : null}
      {structure}
    </Stack>
  );
};
