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
import { PipelineSpec, SingleMutationScanSpec } from "../../models/design.ts";
import { DEFAULT_STYLE, StructurePanel } from "../../features/structurepanel";
import { ModifiersKeys } from "molstar/lib/mol-util/input/input-observer";
import { AtomInfo } from "../../components/structureviewer/molstar-utils.tsx";
import { PositionColorCallback } from "../../utils/colormap.ts";
import { SiteHighlightTargetPos } from "../../features/structurepanel/data.ts";
import { AutowrapHeatmap } from "../../components/autowrapheatmap";

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

const handleClick = (
  pos: number | null,
  modifiers: ModifiersKeys,
  _a: number,
  _b: number,
  ai: AtomInfo[],
) => console.log("clicked", pos, modifiers, ai);

const colorPos: PositionColorCallback = (pos: number | null) => {
  if (pos === null) {
    return "#aaaaaa";
  } else {
    if (pos > 30) {
      return "#ff0000";
    } else {
      return "#00ff00";
    }
  }
};

const exampleSiteHighlights: SiteHighlightTargetPos[] = [
  // {
  //   pos: 100,
  //   representationId: "100_sphere",
  //   props: {
  //     type: "spacefill",
  //     color: "uniform",
  //     colorParams: { value: Color(0xfffff) },
  //   },
  // },
  // {
  //   pos: 50,
  //   representationId: "50_sphere",
  //   props: {
  //     type: "spacefill",
  //     color: "uniform",
  //     colorParams: { value: Color(0xaaaaaa) },
  //   },
  // },
];

// @ts-ignore
const heatmapColorMap = (value: number | null, i?: number, j?: number) =>
  "#aa0000";

export const ResultViewer = ({ results, id }: ResultViewerProps) => {
  const [downloadFormat, setDownloadFormat] = useState<string | null>(null);
  // create download conditionally to avoid using to many resources in browser
  const downloadButton = useDownloadButton(results, downloadFormat, id);

  const theme = useMantineTheme();
  const computedColorScheme = useComputedColorScheme("light", {
    getInitialValueInEffect: true,
  });

  const isDesignJob =
    results.spec?.key === "pipeline" ||
    results.spec?.key === "single_mutation_scan";

  let viewer = null;
  if (isDesignJob) {
    const spec = results.spec as SingleMutationScanSpec | PipelineSpec;
    viewer = spec.metadata?.structure_search_result ? (
      <div
        style={{
          height: "35vh",
          width: "100%",
          position: "relative",
          resize: "both",
          overflow: "auto",
        }}
      >
        <StructurePanel
          structureStyle={DEFAULT_STYLE}
          structureHits={spec.metadata.structure_search_result}
          firstIndex={spec.system[0].first_index}
          backgroundColor={
            computedColorScheme === "dark"
              ? theme.colors.dark[7] // cf. https://mantine.dev/styles/css-variables-list/
              : "#000000" // cf. https://mantine.dev/styles/css-variables-list/
          }
          useFullStructureModel={true}
          useStructureAssembly={true}
          handleClick={handleClick}
          colorCallback={colorPos}
          siteHighlights={exampleSiteHighlights}
        />
      </div>
    ) : (
      <div>Old job - no structure info available</div>
    );
  }

  // if single mutation matrix, create temp visual
  let matrix = null;
  if (results.spec?.key === "single_mutation_scan") {
    // TODO: careful about div
    matrix = (
      <div
        style={{
          height: "100%",
          overflow: "auto",
          position: "relative",
          fontFamily: "Arial",
        }}
      >
        <AutowrapHeatmap
          data={[
            [1, 1, 1, 1, 1],
            [2, 2, 2, 2, 2],
          ]}
          colorMap={heatmapColorMap}
          yLabels={["a", "b", "c", "d", "e"]}
          labelRenderer={(labelData) => <span>{labelData.value}</span>}
        />
      </div>
    );
  }

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
          <Button disabled={true}>
            Analyze and cluster designs (coming soon)
          </Button>
          <Space />
          <Button component={Link} href={`/results/${id}/dna`}>
            Generate DNA sequences...
          </Button>
          {viewer}
          {matrix}
        </>
      ) : null}
    </Stack>
  );
};
