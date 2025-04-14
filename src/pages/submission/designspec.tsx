import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CloseButton,
  Group,
  NumberInput,
  SegmentedControl,
  Select,
  Space,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { PipelineSpec, Sequence } from "../../models/design.ts";
import { SeqWithRegion } from "./sequence.tsx";
import { SequenceViewer } from "../../components/sequenceviewer";
import { range } from "../../utils/helpers.ts";

const MIN_NUM_DESIGNS = 1;
const MAX_NUM_DESIGNS = 20000;
const DEFAULT_NUM_DESIGNS = 16;  // TODO: increase again

export interface DesignSpecProps {
  targetSeq: SeqWithRegion;
  msa: Sequence[];
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
): PipelineSpec => {
  const temperatureNumeric = parseFloat(temperature);
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
  } else {
    throw new Error("Model not yet implemented");
  }

  let generator;
  if (sampler === "model") {
    generator = modelSpec;
  } else {
    // const restraintAsObj = restraints as object[];
    // remove weight attribute
    const restraintAsObj = restraints.map(
        (r) => {
          const {weight, ...filtObject} = r;
          return filtObject
        }
    )
    // work around TS complaints
    let scorers: object[] = [modelSpec];
    if (scorers.length > 0) {
      scorers = scorers.concat(restraintAsObj);
    }
    const weights = [1.0].concat(restraints.map((r) => r.weight));

    const numSweeps = 100; // TODO: find reasonable default here
    const initStrategy = "system"; // TODO: determine if we want to use random (more sweeps needed) or system
    // TODO: for now, linearly anneal the temperature down by one order of magnitude over all sweeps
    const temperatureUpdate =
      (temperatureNumeric - temperatureNumeric / 10) / numSweeps;

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
    metadata: null,

    system: [
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
    ],
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
    ],
  };
};

export const DesignSpecInput = ({ targetSeq, msa }: DesignSpecProps) => {
  const targetSeqCut = targetSeq.seq.substring(
    targetSeq.start - 1,
    targetSeq.end,
  );

  // const [jobName, setJobName] = useState("");
  const [model, setModel] = useState<string>("evmutation2");
  const [sampler, setSampler] = useState("model");
  const [numDesigns, setNumDesigns] = useState<number>(DEFAULT_NUM_DESIGNS);
  const [temperature, setTemperature] = useState<string>("0.1");
  const [posSelection, setPosSelection] = useState<number[]>([]);
  const [restraints, setRestraints] = useState<RestraintSpec[]>([]);

  const selectAllPos = () =>
    setPosSelection(range(targetSeq.start, targetSeq.end, 1));

  // (re-)initialize selected positions whenever target sequence changes
  useEffect(selectAllPos, [targetSeq]);

  // set only viable sampler option if ESM2 selected
  useEffect(() => {
    if (model === "esm2") setSampler("gibbs");
  }, [model]);

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

  const numSeqs = msa.length;
  const evoModelOk = numSeqs / targetSeqCut.length > 1;

  let samplerOptions = [
    {
      label: (
        <Stack gap="xs">
          <Text size={"sm"} fw={500}>
            Autoregressive sampling
          </Text>
          <Text size="xs" c="dimmed">
            Faster, but limited control over design properties.
            <br />
            Recommended for larger libraries.
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
            Slower, but precise control over design properties
            <br />
            (distance to WT, motifs, ...).
          </Text>
        </Stack>
      ),
      value: "gibbs",
    },
  ];

  if (model === "esm2") {
    samplerOptions = samplerOptions.slice(1);
  }

  let restraintSelection = null;
  if (sampler === "gibbs") {
    restraintSelection = (
      <>
        <Select
          label="Extra restraints for sampling"
          description="Specify additional design properties to enforce during generation"
          withCheckIcon={false}
          placeholder="Select a restraint to add..."
          onOptionSubmit={(_) => {
            // TODO: flexibly instantiate different restraints here based on selected value
            const newRestraint: RestraintSpec = {
              key: "linear_seq_dist_restraint",
              variant: "default",
              weight: -0.1,
              args: null,
              data: [{
                entity: 0,
                rep: targetSeqCut,
              }],
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
      </>
    );
  }

  return (
    <>
      <Title order={1}>Specify design parameters</Title>
      <Title order={4} c="blue">
        Your target sequence
      </Title>
      <Card padding="lg" radius="md">
        <Group justify="space-between">
          <Text>{numSeqs} homologous sequences found</Text>
          <Group>
            <Button variant="default" disabled={true}>
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
              value: "evmutation2",
              label:
                "EVmutation2 (evolutionary model; best for designing functional proteins)",
            },
            {
              value: "proteinmpnn",
              label:
                "ProteinMPNN (inverse folding model; best for designing stability but may lose function)",
              disabled: true,
            },
            {
              value: "esm2",
              label:
                "ESM2 (best for sequence-only design in absence of evolutionary record)",
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
        />
      </Stack>

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
          { value: "0.01", label: "0.01 (very low)" },
          { value: "0.05", label: "0.05 (low)" },
          { value: "0.1", label: "0.1 (normal-low)" },
          { value: "0.2", label: "0.2 (normal-low)" },
          { value: "0.5", label: "0.5 (normal-high)" },
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
      {/*<TextInput
        label="Name your design job"
        description="Specifying a job name will allow you to locate your results more easily later"
        placeholder="Enter job name (optional)"
        value={jobName}
        onChange={(e) => setJobName(e.target.value)}
      />*/}
      <Space />
      <Button
        variant="filled"
        size="md"
        disabled={posSelection.length === 0}
        onClick={() => {
          const designSpec = buildSpec(
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
          );
          console.log("SUBMIT", JSON.stringify(designSpec));
          // TODO: implement actual submission with auth
        }}
      >
        {posSelection.length > 0
          ? "Generate designs"
          : "Must select at least one position to design"}
      </Button>
    </>
  );
};
