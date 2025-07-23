import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CloseButton,
  Collapse,
  Group,
  NumberInput,
  PasswordInput,
  SegmentedControl,
  Select,
  Space,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import {
  PipelineSpec,
  Sequence,
  SingleMutationScanSpec,
  systemInstanceFromSystem,
} from "../../models/design.ts";
import { SeqWithRegion } from "./sequence.tsx";
import { SequenceViewer } from "../../components/sequenceviewer";
import { range } from "../../utils/helpers.ts";
import { useDisclosure, useViewportSize } from "@mantine/hooks";
import { useSubmission } from "../../api/modal.ts";
import { SubmissionModal } from "../../components/submission/modal.tsx";
import { TaxoviewModal } from "./taxoview.tsx";

const MIN_NUM_DESIGNS = 1;
const MAX_NUM_DESIGNS = 20000;
const DEFAULT_NUM_DESIGNS = 32; // TODO: increase again

// maximum FoldSeek structure hits forwarded to API
const MAX_NUM_STRUCTURE_HITS = 100;

// Gibbs sampler params
const MIN_NUM_SWEEPS = 1; // TODO: raise to minimum sensible value
const MAX_NUM_SWEEPS = 1000;
const DEFAULT_NUM_SWEEPS = 50;
const DEFAULT_TEMPERATURE_FACTOR = 1;
const MIN_TEMPERATURE_FACTOR = 1;
const MAX_TEMPERATURE_FACTOR = 1000;

export interface DesignSpecProps {
  targetSeq: SeqWithRegion;
  msa: Sequence[];
  structures: object;
  seqSearchId: string;
  structSearchId: string;
}

interface RestraintSpec {
  key: string;
  variant: string;
  weight: number;
  args: object | null;
  data: object | null;
}

interface RestraintListProps {
  restraints: RestraintSpec[];
  setRestraints: (restraints: RestraintSpec[]) => void;
}

const RestraintList = ({ restraints, setRestraints }: RestraintListProps) => {
  const updateAndSet = (index: number, newValue: RestraintSpec) => {
    setRestraints(
      restraints
        .slice(0, index)
        .concat(newValue)
        .concat(restraints.slice(index + 1, restraints.length)),
    );
  };

  // TODO: add proper mapping of restriant key to name once there is more than one
  //  restraint type implementation
  return restraints.map((restraint, index) => (
    <Card key={index}>
      <Group justify="space-between">
        <Text size={"sm"}>
          {restraint.key === "linear_seq_dist_restraint"
            ? "Mutation distance to target sequence" // TODO: eventually also will have arbitrary mutation distance
            : "Not yet implemented"}
        </Text>
        <Group gap={"xs"}>
          <Text size={"sm"}>Weight</Text>
          <NumberInput
            size="xs"
            value={restraint.weight}
            suffix={
              restraint.weight > 0
                ? "  (make dissimilar)"
                : restraint.weight < 0
                  ? "   (make similar)"
                  : ""
            }
            onChange={(value) => {
              if (typeof value === "string") return;
              updateAndSet(index, {
                ...restraint,
                weight: value,
              });
            }}
            step={0.1}
          />
        </Group>
        <CloseButton
          onClick={() =>
            setRestraints(restraints.filter((_, index2) => index2 !== index))
          }
          variant={"transparent"}
        />
      </Group>
    </Card>
  ));
};

const buildSpec = (
  targetSeqCut: string,
  firstIndex: number,
  lastIndex: number,
  msa: Sequence[],
  numDesigns: number,
  temperature: string,
  model: string,
  sampler: string,
  restraints: RestraintSpec[],
  posSelection: number[],
  temperatureFactor: number,
  numSweeps: number,
  initStrategy: string,
  seqSearchId: string,
  structSearchId: string,
  structSearchResult: object,
): PipelineSpec | SingleMutationScanSpec => {
  const temperatureNumeric = parseFloat(temperature);
  // instantiate core molecular model (used for any type of pipeline)
  let modelSpec;
  if (model === "evmutation2") {
    modelSpec = {
      key: "evmutation2",
      variant: "msa-only-small",
      args: {
        encoder_num_samples: 1,
        decoder_batch_size: Math.min(numDesigns, 512),
      },
    };
  } else if (model === "evmutation2_ensembled") {
    modelSpec = {
      key: "evmutation2",
      variant: "msa-only-small",
      args: {
        encoder_num_samples: 4,
        decoder_batch_size: Math.min(numDesigns, 512),
      },
    };
  } else if (model === "esm2_650m") {
    modelSpec = {
      key: "esm2",
      variant: "esm2_t33_650M_UR50D",
      args: {
        batch_size: Math.min(numDesigns, 512),
      },
    };
  } else {
    throw new Error("Model not yet implemented");
  }

  // also instantiate system
  const system = [
    {
      type: "protein",
      rep: targetSeqCut,
      id: "1",
      first_index: firstIndex,
      sequences: {
        seqs: msa,
        aligned: true,
        type: "protein",
        weights: null,
        format: "a3m",
      },
    },
  ];

  // pass MMseqs and FoldSeek IDs, as well as top structure hits
  // TODO: add proper typing here
  // @ts-ignore
  const topStructures = structSearchResult.results
    .map(
      // @ts-ignore
      (dbHits) =>
        dbHits.alignments[0].slice(0, MAX_NUM_STRUCTURE_HITS).map(
          // @ts-ignore
          (ali) => ({ db: dbHits.db, ...ali }),
        ),
    )
    .flat();

  const metadata = {
    msa_search_job_id: seqSearchId,
    structure_search_job_id: structSearchId,
    structure_search_result: topStructures,
  };

  if (sampler === "single_mutation_scan") {
    return {
      key: "single_mutation_scan",
      schema_version: "0.1",
      system: system,
      system_instance: systemInstanceFromSystem(system),
      scorer: modelSpec,
      entity: 0,
      positions: null,
      metadata: metadata,
    } as SingleMutationScanSpec;
  } else {
    let generator;
    if (sampler === "model") {
      generator = modelSpec;
    } else {
      // const restraintAsObj = restraints as object[];
      // remove weight attribute
      const restraintAsObj = restraints.map((r) => {
        const { weight, ...filtObject } = r;
        return filtObject;
      });
      // work around TS complaints
      let scorers: object[] = [modelSpec];
      if (scorers.length > 0) {
        scorers = scorers.concat(restraintAsObj);
      }
      const weights = [1.0].concat(restraints.map((r) => r.weight));

      // use linear schedule by default, set temperatureFactor to 1 for constant temperature;
      // note we do not update temperature in first step so use numSweeps - 1 (unless we only have a single sweep)
      const temperatureUpdate =
        (temperatureNumeric - temperatureNumeric / temperatureFactor) /
        Math.max(numSweeps - 1, 1);

      generator = {
        key: "gibbs",
        variant: "default",
        args: {
          scorers: scorers,
          weights: weights,
          num_sweeps: numSweeps,
          init_strategy: initStrategy,
          scan_order: "random",
          temperature_schedule: {
            type: "linear",
            update: temperatureUpdate,
          },
          record_full_chain: true, // TODO: revert this to false
        },
      };
    }

    // invert posSelection (positions to mutate) into fixed positions list
    const fixedPos = range(firstIndex, lastIndex, 1).filter(
      (pos) => !posSelection.includes(pos),
    );

    return {
      key: "pipeline",
      schema_version: "0.1",
      metadata: metadata,

      system: system,
      system_instances: null,
      steps: [
        {
          key: "generate",
          generator: generator,
          args: {
            num_designs: numDesigns,
            entities: [0],
            fixed_pos: {
              0: fixedPos,
            },
            temperature: temperatureNumeric,
            deletions: false,
          },
        },
        {
          key: "analyze",
          analyzer: {
            key: "seqspace_umap_aligned",
            variant: "default",
            args: {
              num_components: 2,
              include_system_sequences: true,
            },
            data: null,
          },
          entity: 0,
        },
      ],
    } as PipelineSpec;
  }
};

export const DesignSpecInput = ({
  targetSeq,
  msa,
  structures,
  seqSearchId,
  structSearchId,
}: DesignSpecProps) => {
  const targetSeqCut = targetSeq.seq.substring(
    targetSeq.start - 1,
    targetSeq.end,
  );

  const [showFilterModal, { toggle: toggleFilterModal }] = useDisclosure(false);

  const [model, setModel] = useState<string>("evmutation2_ensembled");
  const [sampler, setSampler] = useState("single_mutation_scan");
  const [numDesigns, setNumDesigns] = useState<number>(DEFAULT_NUM_DESIGNS);
  const [temperature, setTemperature] = useState<string>("0.5");
  const [posSelection, setPosSelection] = useState<number[]>([]);

  // Gibbs settings
  const [restraints, setRestraints] = useState<RestraintSpec[]>([]);
  const [expertOpen, { toggle: toggleExpert }] = useDisclosure(false);
  const [numSweeps, setNumSweeps] = useState<number>(DEFAULT_NUM_SWEEPS);
  const [initStrategy, setInitStrategy] = useState<string>("random");
  const [temperatureFactor, setTemperatureFactor] = useState(
    DEFAULT_TEMPERATURE_FACTOR,
  );

  // submission-related
  const [token, setToken] = useState("");
  const submission = useSubmission();
  const [isSubmitting, { open: openSubmitting, close: closeSubmitting }] =
    useDisclosure(false);

  const { width: viewportWidth } = useViewportSize();

  const selectAllPos = () =>
    setPosSelection(range(targetSeq.start, targetSeq.end, 1));

  // (re-)initialize selected positions whenever target sequence changes
  useEffect(selectAllPos, [targetSeq]);

  // set only viable sampler option if ESM2 selected
  useEffect(() => {
    if (model.startsWith("esm2")) {
      if (sampler === "model") {
        setSampler("gibbs");
      }
      setInitStrategy("system");
    } else if (model.startsWith("evmutation2")) {
      setInitStrategy("random");
    }
  }, [model, sampler]);

  // useEffect(() => {
  //   if (sampler === "gibbs") setTemperature("1.0");
  // }, [sampler]);

  const numSeqs = msa.length;
  const evoModelOk = numSeqs / targetSeqCut.length > 1;

  const downloadButton = useMemo(() => {
    if (msa) {
      const msaOut = msa.map((seq) => `>${seq.id}\n${seq.seq}\n`).join("");
      const blob = new Blob([msaOut], { type: "text/plain" });
      const url = URL.createObjectURL(blob);

      return (
        <Button
          variant="default"
          component="a"
          href={url}
          download="mmseqs_msa.a3m"
        >
          Download MSA
        </Button>
      );
    } else {
      return null;
    }
  }, [msa]);

  let samplerOptions = [
    {
      label: (
        <Stack gap="xs">
          <Text size={"sm"} fw={500}>
            Single mutation scan
          </Text>
          <Text size="xs" c="dimmed">
            Score all possible singles <br />
            to survey for mutable positions.
          </Text>
        </Stack>
      ),
      value: "single_mutation_scan",
    },
    {
      label: (
        <Stack gap="xs">
          <Text size={"sm"} fw={500}>
            Autoregressive sampling
          </Text>
          <Text size="xs" c="dimmed">
            Fast sampling,
            <br />
            limited control over properties.
          </Text>
        </Stack>
      ),
      value: "model",
    },
    {
      label: (
        <Stack gap="xs" align={"center"}>
          <Text size={"sm"} fw={500}>
            Restrained Gibbs sampling
          </Text>
          <Text size="xs" c="dimmed">
            Slow sampling,
            <br />
            precise control over properties.
          </Text>
        </Stack>
      ),
      value: "gibbs",
    },
  ];

  // no own sampling on esm2, so remove from list
  if (model.startsWith("esm2")) {
    samplerOptions = samplerOptions.filter((x) => x.value !== "model");
  }

  let restraintSelection = null;
  if (sampler === "gibbs") {
    restraintSelection = (
      <>
        <Select
          label="Extra specifications on sequence properties"
          description="Specify additional restraints to enforce during generation"
          withCheckIcon={false}
          placeholder="Select a restraint to add..."
          onOptionSubmit={(_) => {
            // TODO: flexibly instantiate different restraints here based on selected value
            const newRestraint: RestraintSpec = {
              key: "linear_seq_dist_restraint",
              variant: "default",
              weight: -0.1,
              args: null,
              data: [
                {
                  entity: 0,
                  rep: targetSeqCut,
                },
              ],
            };

            setRestraints(restraints.concat(newRestraint));
          }}
          data={[
            {
              value: "linear_seq_dist_target",
              label: "Mutation distance to target sequence",
            },
          ]}
        />
        <RestraintList restraints={restraints} setRestraints={setRestraints} />
        <Button onClick={toggleExpert} variant="subtle">
          {expertOpen ? "Hide" : "Show"} expert settings
        </Button>
        <Collapse in={expertOpen}>
          <Stack>
            <NumberInput
              label="Sampling temperature schedule factor"
              min={MIN_TEMPERATURE_FACTOR}
              max={MAX_TEMPERATURE_FACTOR}
              step={1}
              value={temperatureFactor}
              onChange={(value) => {
                if (typeof value === "string") return;
                setTemperatureFactor(value);
              }}
              thousandSeparator={true}
              allowDecimal={false}
              description="Initial temperature will be reduced linearly from T to T/factor over all sweeps (set to 1 for constant temperature)"
            />
            <NumberInput
              label="Number of Gibbs sweeps"
              min={MIN_NUM_SWEEPS}
              max={MAX_NUM_SWEEPS}
              step={1}
              value={numSweeps}
              onChange={(value) => {
                if (typeof value === "string") return;
                setNumSweeps(value);
              }}
              thousandSeparator={true}
              allowDecimal={false}
              description="Increasing sweeps may give more reliable results at the expense of higher runtime "
            />
            <Select
              label="Gibbs initialization strategy"
              description="Random initialization may yield more diversity at the expense of needing more sweeps (not recommended for LLMs)"
              data={[
                {
                  value: "random",
                  label: "Random sequence",
                },
                {
                  value: "system",
                  label: "Target sequence",
                },
              ]}
              value={initStrategy}
              onOptionSubmit={setInitStrategy}
              allowDeselect={false}
            />
          </Stack>
        </Collapse>
      </>
    );
  }

  const samplingSettings =
    sampler !== "single_mutation_scan" ? (
      <>
        <NumberInput
          label="Number of designs"
          min={MIN_NUM_DESIGNS}
          max={MAX_NUM_DESIGNS}
          step={1000}
          value={numDesigns}
          onChange={(value) => {
            if (typeof value === "string") return;
            setNumDesigns(value);
          }}
          thousandSeparator={true}
          allowDecimal={false}
          description="More designs take longer to run"
        />
        <Select
          label="Sequence diversity (sampling temperature)"
          description="Higher temperatures give more diversity"
          placeholder="Pick value"
          value={temperature}
          onOptionSubmit={setTemperature}
          allowDeselect={false}
          data={[
            // { value: "0.01", label: "0.01 (very low)" },
            // { value: "0.05", label: "0.05 (low)" },
            { value: "0.1", label: "0.1 (very low)" },
            { value: "0.3", label: "0.3 (normal-low)" },
            { value: "0.5", label: "0.5 (normal)" },
            { value: "1.0", label: "1.0 (normal-high)" },
            { value: "2.0", label: "2.0 (high)" },
          ]}
        />

        {restraintSelection}

        <Space />
        <Title order={4} c="blue">
          Define positions to mutate
        </Title>
        <Space />
        <SequenceViewer
          seq={targetSeqCut}
          firstIndex={targetSeq.start}
          handleClick={(pos) => {
            if (posSelection.includes(pos)) {
              setPosSelection(posSelection.filter((curPos) => curPos !== pos));
            } else {
              setPosSelection(posSelection.concat(pos));
            }
          }}
          getPosStyle={(pos) =>
            "selectable" + (posSelection.includes(pos) ? " selected " : "")
          }
          chunkSize={10}
        />
        <Group>
          <Button variant="default" onClick={selectAllPos}>
            Select all
          </Button>
          <Button variant="default" onClick={() => setPosSelection([])}>
            Select none
          </Button>
          <Button
            variant="default"
            onClick={() =>
              setPosSelection(
                // note that range function includes end in range
                range(targetSeq.start, targetSeq.end, 1).filter(
                  (pos) => !posSelection.includes(pos),
                ),
              )
            }
          >
            Invert selection
          </Button>
        </Group>
        <Space />
      </>
    ) : null;

  return (
    <>
      <TaxoviewModal
        opened={showFilterModal}
        close={toggleFilterModal}
        msa={msa}
        submit={(msaFiltered: Sequence[]) =>
          // TODO: TH will need to connect filtered MSA to downstream processing in this component
          console.log("filtered MSA", msaFiltered)
        }
      />
      <SubmissionModal
        isSubmitting={isSubmitting}
        close={closeSubmitting}
        submission={submission}
      />
      <Title order={1}>Specify design parameters</Title>
      <Title order={4} c="blue">
        Your sequence
      </Title>
      <Card padding="lg" radius="md">
        <Group justify="space-between" pb={"xs"}>
          <Text>{numSeqs} homologous sequences found</Text>
          <Group>
            <Button variant="default" onClick={toggleFilterModal}>
              Filter
            </Button>
            {downloadButton}
          </Group>
        </Group>
        <Group>
          <Badge variant="light" color={evoModelOk ? "green" : "orange"}>
            Evolutionary models {evoModelOk ? "applicable" : "not applicable"}
          </Badge>
        </Group>
      </Card>

      <Space />
      <Title order={4} c="blue">
        Choose generation parameters
      </Title>
      <Stack>
        <Select
          label="Design model"
          description="Select a molecular model that best aligns with your design goals"
          placeholder="Pick value"
          data={[
            {
              value: "evmutation2_ensembled",
              label:
                "EVmutation2 (evolutionary model; best for designing functional proteins)",
            },
            {
              value: "evmutation2",
              label:
                "EVmutation2 (lower accuracy mode, 4x speedup over ensembled version)",
            },
            {
              value: "esm2_650m",
              label:
                "ESM2 650M (best for sequence-only design in absence of evolutionary record)",
            },
            {
              value: "proteinmpnn",
              label:
                "ProteinMPNN (inverse folding model; best for designing stability but may lose function)",
              disabled: true,
            },
          ]}
          value={model}
          onOptionSubmit={setModel}
          allowDeselect={false}
        />
      </Stack>

      <Stack gap={6}>
        <Text size="sm" fw={500}>
          Sampling strategy
        </Text>
        {/*<Text c="dimmed" size={"sm"}>Use the strategy that is most appropriate to your design problem</Text>*/}

        <SegmentedControl
          value={sampler}
          onChange={setSampler}
          data={samplerOptions}
          withItemsBorders={false}
          orientation={viewportWidth > 700 ? "horizontal" : "vertical"}
          fullWidth={true}
        />
      </Stack>

      {samplingSettings}

      <Space />
      <PasswordInput
        label="Submission token"
        description="Valid token is required for submission to prevent unauthorized access"
        placeholder="Enter token"
        value={token}
        onChange={(event) => setToken(event.currentTarget.value)}
      />
      <Space />
      <Button
        variant="filled"
        size="md"
        disabled={posSelection.length === 0 || token.length === 0}
        onClick={() => {
          const spec = buildSpec(
            targetSeqCut,
            targetSeq.start,
            targetSeq.end,
            msa,
            numDesigns,
            temperature,
            model,
            sampler,
            restraints,
            posSelection,
            temperatureFactor,
            numSweeps,
            initStrategy,
            seqSearchId,
            structSearchId,
            structures,
          );

          // perform submission
          submission.mutate({
            spec: spec,
            token: token,
            parentId: null,
          });
          openSubmitting();
        }}
      >
        {posSelection.length > 0
          ? token.length > 0
            ? "Generate designs"
            : "Submission token required"
          : "Must select at least one position to design"}
      </Button>
      <Space />
    </>
  );
};
