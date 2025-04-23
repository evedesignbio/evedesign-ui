import { useState } from "react";
import {
  Button,
  Collapse,
  MultiSelect,
  NumberInput,
  RangeSlider,
  Select,
  Space,
  Stack,
  Switch,
  Text,
  Textarea,
  Title,
} from "@mantine/core";
import {
  PipelineApiResult,
  SingleMutationScanApiResult,
} from "../../models/api.ts";
import { RESTRICTION_SITES, validTranslation } from "../../utils/bio.ts";
import { useDisclosure } from "@mantine/hooks";

export const DNA_SEQ_REGEXP = RegExp("^[ACGT]+$");

// TODO: improve props, receive list of instances
export interface DNAGenerationDialogProps {
  id: string;
  results: PipelineApiResult | SingleMutationScanApiResult;
}

const DEFAULT_MIN_GC_CONTENT = 40;
const DEFAULT_MAX_GC_CONTENT = 60;
const GC_CONTENT_MIN_RANGE = 20;
const GC_CONTENT_WINDOW_SIZE = 20;
const MAX_HOMOPOLYMER_LENGTH = 5;
const MAX_REPEAT_LENGTH = 9;

const CODON_TARGET_SPECIES = [
  "e_coli",
  "h_sapiens",
  "s_cerevisiae",
  "b_subtilis",
  "d_melanogaster",
  // "m_musculus_domesticus",
  "m_musculus",
  "g_gallus",
  "c_elegans",
];

const normalizeDnaSeq = (seq: string) => seq.replace(/\s/g, "").toUpperCase();
const isValidDnaSeq = (seq: string): boolean => {
  return seq === "" || DNA_SEQ_REGEXP.test(seq);
};

export const DNAGenerationDialog = ({
  results,
  id,
}: DNAGenerationDialogProps) => {
  const [upstreamDna, setUpstreamDna] = useState<string>("");
  const [downstreamDna, setDownstreamDna] = useState<string>("");
  const [refEnabled, setRefEnabled] = useState(false);
  const [refDna, setRefDna] = useState<string>("");
  const [optimizationMethod, setOptimizationMethod] =
    useState<string>("match_codon_usage");
  const [targetSpecies, setTargetSpecies] = useState<string>("e_coli");
  const [expertOpen, { toggle: toggleExpert }] = useDisclosure(false);
  const [gcWindowSize, setGcWindowSize] = useState<number>(
    GC_CONTENT_WINDOW_SIZE,
  );
  const [gcWindowEnabled, setgcWindowEnabled] = useState<boolean>(true);
  const [maxHomopolymerLengthEnabled, setMaxHomopolymerLengthEnabled] =
    useState<boolean>(true);
  const [maxHomopolymerLength, setMaxHomopolymerLength] = useState<number>(
    MAX_HOMOPOLYMER_LENGTH,
  );
  const [maxRepeatLengthEnabled, setMaxRepeatLengthEnabled] =
    useState<boolean>(true);
  const [maxRepeatLength, setMaxRepeatLength] =
    useState<number>(MAX_REPEAT_LENGTH);

  const [avoidSites, setAvoidSites] = useState<string[]>([]);
  const [gcContentRange, setGcContentRange] = useState<[number, number]>([
    DEFAULT_MIN_GC_CONTENT,
    DEFAULT_MAX_GC_CONTENT,
  ]);

  console.log(results.spec.key, id); // TODO: Remove

  // input sequence normalization and validation
  const upstreamDnaNorm = normalizeDnaSeq(upstreamDna);
  const downstreamDnaNorm = normalizeDnaSeq(downstreamDna);
  const refDnaNorm = normalizeDnaSeq(refDna);
  const isValidUpstream = isValidDnaSeq(upstreamDnaNorm);
  const isValidDownstream = isValidDnaSeq(downstreamDnaNorm);
  const isValidRef = isValidDnaSeq(refDnaNorm);
  const isValidTranslation =
    refDnaNorm === "" ||
    validTranslation(refDnaNorm, results.spec.system[0].rep);

  return (
    <Stack>
      <Space />
      <Title order={4} c="blue">
        Define your nucleotide vector
      </Title>
      <Textarea
        label="Upstream DNA sequence"
        description="Sequence upstream from start of your library DNA insert to include during codon optimization"
        placeholder="Enter DNA sequence (optional, e.g. 20 bp)"
        autosize
        value={upstreamDna}
        onChange={(e) => setUpstreamDna(e.target.value)}
        error={isValidUpstream ? undefined : "Invalid DNA sequence"}
      />
      <Textarea
        label="Downstream DNA sequence"
        description="Sequence downstream from end of your library DNA insert to include during codon optimization"
        placeholder="Enter DNA sequence (optional, e.g. 20 bp)"
        autosize
        value={downstreamDna}
        onChange={(e) => setDownstreamDna(e.target.value)}
        error={isValidDownstream ? undefined : "Invalid DNA sequence"}
      />

      <Space />
      <Switch
        checked={refEnabled}
        onChange={(event) => setRefEnabled(event.currentTarget.checked)}
        label="Optimize sequences relative to target sequence"
        description="If enabled, codons will be kept fixed for positions with same amino acid as target sequence"
      />
      {refEnabled ? (
        <Textarea
          label="Reference DNA sequence"
          description="DNA sequence translating into your target protein; if empty, will create new reference DNA on the fly"
          placeholder="Enter coding DNA sequence (optional)"
          autosize
          value={refDna}
          onChange={(e) => setRefDna(e.target.value)}
          error={
            isValidRef
              ? isValidTranslation
                ? undefined
                : "DNA sequence does not translate into reference sequence"
              : "Invalid DNA sequence"
          }
        />
      ) : null}

      <Space />
      <Title order={4} c="blue">
        Specify codon optimization strategy
      </Title>
      <Select
        label={"Optimization method"}
        description={
          "Determines whether most frequent codons or balanced distribution will be preferred"
        }
        value={optimizationMethod}
        onOptionSubmit={setOptimizationMethod}
        data={[
          {
            value: "match_codon_usage",
            label: "Match codon usage profile of target organism",
          },
          {
            value: "use_best_codon",
            label: "Prefer most frequent codons (codon adaption index)",
          },
        ]}
      />
      <Select
        label={"Target species"}
        description={
          "Sequence will be optimized based on codon frequency distribution for this species"
        }
        value={targetSpecies}
        onOptionSubmit={setTargetSpecies}
        data={CODON_TARGET_SPECIES.map((species) => ({
          value: species,
          label:
            species.charAt(0).toUpperCase() +
            species.slice(1).replace("_", ". "),
        }))}
      />
      <MultiSelect
        label="Avoid sites"
        description="Selected restriction enzyme motifs will be avoided on both strands"
        placeholder={avoidSites.length === 0 ? "Select sites..." : ""}
        value={avoidSites}
        onChange={setAvoidSites}
        data={RESTRICTION_SITES}
        searchable={true}
        clearable={true}
      />
      <Stack gap={0}>
        <Text size={"sm"}>GC content</Text>
        <Text size={"xs"} c={"dimmed"}>
          Minimum and maximum acceptable GC content in sliding window
        </Text>
      </Stack>
      <RangeSlider
        min={0}
        max={100}
        value={gcContentRange}
        onChange={setGcContentRange}
        minRange={GC_CONTENT_MIN_RANGE}
        marks={[0, 20, 40, 60, 80, 100].map((pct) => ({
          value: pct,
          label: `${pct}%`,
        }))}
      />
      <Space />
      <Button onClick={toggleExpert} variant="subtle">
        {expertOpen ? "Hide" : "Show"} expert settings
      </Button>
      <Collapse in={expertOpen}>
        <Stack>
          <Switch
            checked={gcWindowEnabled}
            onChange={(event) =>
              setgcWindowEnabled(event.currentTarget.checked)
            }
            label="Compute GC content using local sliding window instead of full sequence"
            // description="If inactive, GC content will be calculated across entire DNA sequence"
          />
          {gcWindowEnabled ? (
            <>
              <NumberInput
                label="GC content sliding window size"
                description="Increasing window may help to resolve optimization issues if GC content range is narrow"
                min={20}
                step={10}
                value={gcWindowSize}
                onChange={(value) => {
                  if (typeof value === "string") return;
                  setGcWindowSize(value);
                }}
                thousandSeparator={true}
                allowDecimal={false}
              />
              <Space />
            </>
          ) : null}

          <Switch
            checked={maxHomopolymerLengthEnabled}
            onChange={(event) =>
              setMaxHomopolymerLengthEnabled(event.currentTarget.checked)
            }
            label="Constrain homopolymer occurrences"
          />
          {maxHomopolymerLengthEnabled ? (
            <>
              <NumberInput
                label="Maximum homopolymer length"
                description="Upper limit on acceptable length of homopolymers (e.g. AAAAA)"
                min={4}
                step={1}
                value={maxHomopolymerLength}
                onChange={(value) => {
                  if (typeof value === "string") return;
                  setMaxHomopolymerLength(value);
                }}
                thousandSeparator={true}
                allowDecimal={false}
              />
              <Space />
            </>
          ) : null}

          <Switch
            checked={maxRepeatLengthEnabled}
            onChange={(event) =>
              setMaxRepeatLengthEnabled(event.currentTarget.checked)
            }
            label="Constrain arbitrary repeat occurrences"
          />
          {maxRepeatLengthEnabled ? (
            <NumberInput
              label="Maximum repeat length"
              description="Upper limit on acceptable length of arbitrary repeated sequence motifs"
              min={4}
              step={1}
              value={maxRepeatLength}
              onChange={(value) => {
                if (typeof value === "string") return;
                setMaxRepeatLength(value);
              }}
              thousandSeparator={true}
              allowDecimal={false}
            />
          ) : null}
        </Stack>
      </Collapse>
      <Space h="xl" />
      <Button
        disabled={
          !isValidUpstream ||
          !isValidDownstream ||
          !isValidRef ||
          !isValidTranslation
        }
      >
        Generate DNA sequences
      </Button>
    </Stack>
  );
};
