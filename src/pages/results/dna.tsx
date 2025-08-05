import { useState } from "react";
import {
  Alert,
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
  Textarea, TextInput,
  Title,
} from "@mantine/core";
import { RESTRICTION_SITES, validTranslation } from "../../utils/bio.ts";
import { useDisclosure } from "@mantine/hooks";
import { useSubmission } from "../../api/modal.ts";
import {
  CodonOptimizationMethod,
  EntitySpec,
  ProteinToDnaSpec,
  systemInstanceFromSystem,
  SystemInstanceSpec,
} from "../../models/design.ts";
import { SubmissionModal } from "../../components/submission/modal.tsx";

export const DNA_SEQ_REGEXP = RegExp("^[ACGT]+$");

export interface DNAGenerationDialogProps {
  id: string;
  system: EntitySpec[];
  instances: SystemInstanceSpec[];
}

const DEFAULT_MIN_GC_CONTENT = 40;
const DEFAULT_MAX_GC_CONTENT = 60;
const GC_CONTENT_MIN_RANGE = 20;
const GC_CONTENT_WINDOW_SIZE = 40;
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

const isStartCodon = (codon: string) => codon === "ATG";
const isStopCodon = (codon: string) =>
  codon === "TAA" || codon === "TGA" || codon === "TAG";

const validOpenOrf = (upstreamDnaNorm: string) => {
  // walk from end of sequence and look for in-frame start codon; there shouldn't be any stop codons on the way
  for (let i = upstreamDnaNorm.length; i >= 0; i = i - 3) {
    const currentCodon = upstreamDnaNorm.substring(i - 3, i);
    if (isStartCodon(currentCodon)) {
      return true;
    }
    if (isStopCodon(currentCodon)) {
      return false;
    }
  }
  return false;
};

const validCloseOrf = (downstreamDnaNorm: string) => {
  // walk from start of sequence and look for in-frame stop codon
  for (let i = 0; i < downstreamDnaNorm.length; i = i + 3) {
    const currentCodon = downstreamDnaNorm.substring(i, i + 3);
    if (isStopCodon(currentCodon)) {
      return true;
    }
  }
  return false;
};

const buildSpec = (
  system: EntitySpec[],
  instances: SystemInstanceSpec[],
  upstreamDna: string,
  downstreamDna: string,
  refEnabled: boolean,
  refDna: string,
  optimizationMethod: CodonOptimizationMethod,
  targetSpecies: string,
  avoidSites: string[],
  gcContentRange: number[],
  gcWindowSize: number | null,
  maxHomopolymerLength: number | null,
  maxRepeatLength: number | null,
  includeTarget: boolean,
): ProteinToDnaSpec => {
  // reference instance based on target sequence
  const referenceInstance: SystemInstanceSpec | null = refEnabled
    ? systemInstanceFromSystem(system)
    : null;

  const finalInstances = includeTarget
    ? [systemInstanceFromSystem(system)].concat(instances)
    : instances;

  return {
    key: "protein_to_dna",
    schema_version: "0.1",
    optimizer: {
      key: "dnachisel",
      variant: "default",
      args: {
        method: optimizationMethod,
        codon_usage_table: targetSpecies,
        avoid_sites: avoidSites,
        gc_min: gcContentRange[0] / 100.0,
        gc_max: gcContentRange[1] / 100.0,
        gc_window: gcWindowSize,
        max_homopolymer_length: maxHomopolymerLength,
        max_repeat_length: maxRepeatLength,
        avoid_hairpins: true,
        genetic_code: "Standard",
      },
    },
    args: {
      system: system,
      system_instances: finalInstances,
      entity: 0,
      upstream_dna: upstreamDna,
      downstream_dna: downstreamDna,
      reference: referenceInstance,
      reference_dna: refEnabled && refDna.length > 0 ? refDna : null,
    },
  };
};

export const DNAGenerationDialog = ({
  id,
  system,
  instances,
}: DNAGenerationDialogProps) => {
  // basic settings
  const [includeTarget, setIncludeTarget] = useState(true);
  const [upstreamDna, setUpstreamDna] = useState<string>("");
  const [downstreamDna, setDownstreamDna] = useState<string>("");
  const [refEnabled, setRefEnabled] = useState(false);
  const [refDna, setRefDna] = useState<string>("");
  const [optimizationMethod, setOptimizationMethod] =
    useState<string>("match_codon_usage");
  const [targetSpecies, setTargetSpecies] = useState<string>("e_coli");
  const [avoidSites, setAvoidSites] = useState<string[]>([]);
  const [gcContentRange, setGcContentRange] = useState<[number, number]>([
    DEFAULT_MIN_GC_CONTENT,
    DEFAULT_MAX_GC_CONTENT,
  ]);

  // expert settings
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

  // submission-related
  const [jobName, setJobName] = useState("");
  const submission = useSubmission();
  const [isSubmitting, { open: openSubmitting, close: closeSubmitting }] =
    useDisclosure(false);

  // input sequence normalization and validation
  const upstreamDnaNorm = normalizeDnaSeq(upstreamDna);
  const downstreamDnaNorm = normalizeDnaSeq(downstreamDna);
  const refDnaNorm = normalizeDnaSeq(refDna);
  const isValidUpstream = isValidDnaSeq(upstreamDnaNorm);
  const isValidDownstream = isValidDnaSeq(downstreamDnaNorm);
  const isValidRef = isValidDnaSeq(refDnaNorm);
  const isValidTranslation =
    refDnaNorm === "" || validTranslation(refDnaNorm, system[0].rep);

  const hasStartCodon = validOpenOrf(upstreamDnaNorm);
  const hasStopCodon = validCloseOrf(downstreamDnaNorm);

  return (
    <>
      <SubmissionModal
        isSubmitting={isSubmitting}
        close={closeSubmitting}
        submission={submission}
      />
      <Stack>
        <Space />
        <Title order={4} c="blue">
          Define your library settings
        </Title>
        <Textarea
          label="Upstream DNA sequence"
          description="Sequence upstream from start of your library DNA insert to include as context during codon optimization"
          placeholder="Enter DNA sequence (optional, e.g. 20 bp)"
          autosize
          value={upstreamDna}
          onChange={(e) => setUpstreamDna(e.target.value)}
          error={isValidUpstream ? undefined : "Invalid DNA sequence"}
        />
        {!hasStartCodon ? (
          <Alert variant={"light"}>
            Warning: your upstream sequence does not create a valid ORF (no
            in-frame start codon)
          </Alert>
        ) : null}
        <Textarea
          label="Downstream DNA sequence"
          description="Sequence downstream from end of your library DNA insert to include as context during codon optimization"
          placeholder="Enter DNA sequence (optional, e.g. 20 bp)"
          autosize
          value={downstreamDna}
          onChange={(e) => setDownstreamDna(e.target.value)}
          error={isValidDownstream ? undefined : "Invalid DNA sequence"}
        />
        {!hasStopCodon ? (
          <Alert variant={"light"}>
            Warning: your downstream sequence does not end the ORF (no in-frame
            stop codon)
          </Alert>
        ) : null}
        <Space />
        <Switch
          checked={includeTarget}
          onChange={(event) => setIncludeTarget(event.currentTarget.checked)}
          label="Include target sequence in library"
          description="If enabled, the target sequence will be added as first sequence in the DNA sequence list"
        />
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
        <TextInput
            label="Job name"
            description="Descriptive name that helps you to find your job at a later time"
            placeholder="Enter job name (optional)"
            value={jobName}
            onChange={(event) => setJobName(event.currentTarget.value)}
        />
        <Space />
        <Button
          size={"md"}
          disabled={
            !isValidUpstream ||
            !isValidDownstream ||
            !isValidRef ||
            !isValidTranslation
          }
          onClick={() => {
            const spec = buildSpec(
              system,
              instances,
              upstreamDnaNorm,
              downstreamDnaNorm,
              refEnabled,
              refDnaNorm,
              optimizationMethod as CodonOptimizationMethod,
              targetSpecies,
              avoidSites,
              gcContentRange,
              gcWindowEnabled ? gcWindowSize : null,
              maxHomopolymerLengthEnabled ? maxHomopolymerLength : null,
              maxRepeatLengthEnabled ? maxRepeatLength : null,
              includeTarget,
            );

            // perform submission
            submission.mutate({
              name: jobName !== "" ? jobName : null,
              project_id: null,
              parent_job_id: id,
              public: true,
              spec: spec,
            });

            openSubmitting();
          }}
        >
          Generate DNA sequences
        </Button>
        <Space />
      </Stack>
    </>
  );
};
