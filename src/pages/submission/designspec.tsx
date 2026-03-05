import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CloseButton,
  Collapse,
  Group,
  TextInput,
  NumberInput,
  SegmentedControl,
  Select,
  Space,
  Stack,
  Text,
  Title,
  useComputedColorScheme,
  Switch,
} from "@mantine/core";
import {
  EntitySpec,
  LabeledInstanceDatasetSpec,
  LabeledInstanceTrainTestDatasetSpec,
  PipelineSpec,
  Sequence,
  SingleMutationScanSpec,
  systemInstanceFromSystem, systemSpecFromSystemArray,
} from "../../models/design.ts";
import { SeqWithRegion } from "./sequence.tsx";
import { SequenceViewer } from "../../components/sequenceviewer";
import { ellipsis, range } from "../../utils/helpers.ts";
import { useDisclosure, useViewportSize } from "@mantine/hooks";
import { useBalance, useSubmission } from "../../api/backend.ts";
import { SubmissionModal } from "../../components/submission/modal.tsx";
import { TaxoviewModal } from "./taxoview.tsx";
import { MsaResult } from "../../models/api.ts";
import { Dropzone, MIME_TYPES } from "@mantine/dropzone";
import { IconFileTypeCsv, IconUpload, IconX } from "@tabler/icons-react";
import Papa from "papaparse";
import {
  RawDataset,
  VerifiedDataset,
  VerifiedDatasets,
  verifyRawDatasets,
} from "./data.ts";
import { notifications } from "@mantine/notifications";
import "./dropzone.css";

const MIN_DATASET_SIZE = 2; // TODO: increase to higher number
const MAX_DATASET_SIZE = 10000;
const MAX_NUM_DATASETS = 2; // train and test

const MIN_NUM_DESIGNS = 1;
const MAX_NUM_DESIGNS = 20000;
const DEFAULT_NUM_DESIGNS = 32; // TODO: increase again
const MINIMUM_CREDIT = 0;

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
  msa: MsaResult;
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

const transformDataset = (
  dataset: VerifiedDataset,
  applylogTransform: boolean,
): LabeledInstanceDatasetSpec => {
  return {
    instances: dataset.instanceSeries,
    labels: {
      target: dataset.dataSeries.map((value) =>
        applylogTransform ? Math.log2(value) : value,
      ),
    },
  };
};

const buildSpec = (
  system: EntitySpec[],
  firstIndex: number,
  lastIndex: number,
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
  datasets: VerifiedDatasets | null,
  regressor: string,
  logTransform: boolean,
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
        decoder_batch_size: Math.min(numDesigns, 256),
      },
    };
  } else if (model === "evmutation2_ensembled") {
    modelSpec = {
      key: "evmutation2",
      variant: "msa-only-small",
      args: {
        encoder_num_samples: 4,
        decoder_batch_size: Math.min(numDesigns, 256),
      },
    };
  } else if (model === "esm2_650m") {
    modelSpec = {
      key: "esm2",
      variant: "esm2_t33_650M_UR50D",
      args: {
        batch_size: Math.min(numDesigns, 128),
      },
    };
  } else {
    throw new Error("Model not yet implemented");
  }

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

  // wrap predictor in supervised regressor if data is available
  if (datasets !== null) {
    // only apply log transform if all values are actually positive
    const applylogTransform = logTransform && datasets.allPositive;

    modelSpec = {
      key: "supervised_sklearn_predictor",
      variant: "default",
      args: {
        predictor: regressor,
        predictor_kwargs: null,
        embedder: modelSpec,
        scorer: null, // both EVmutation2 and ESM2 can compute scores with embeddings, use these for now
        use_embeddings: true,
        use_scores: true,
        override_models_for_training: false,
        target_name: null, // use default target
        pooling: "mean",
        cv_folds: 5,
        batch_size: 128,
      },
      data: {
        training_set: transformDataset(datasets.datasets[0], applylogTransform),
        test_set:
          datasets.datasets.length > 1
            ? transformDataset(datasets.datasets[1], applylogTransform)
            : null,
      } as LabeledInstanceTrainTestDatasetSpec,
    };
  }

  if (sampler === "single_mutation_scan") {
    return {
      key: "single_mutation_scan",
      schema_version: "0.2",
      system: systemSpecFromSystemArray(system),
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
          record_full_chain: false,
        },
      };
    }

    // invert posSelection (positions to mutate) into fixed positions list
    const fixedPos = range(firstIndex, lastIndex, 1).filter(
      (pos) => !posSelection.includes(pos),
    );

    return {
      key: "pipeline",
      schema_version: "0.2",
      metadata: metadata,

      system: systemSpecFromSystemArray(system),
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

interface DataDropzoneProps {
  addDataset: (dataset: RawDataset) => void;
  disabled: boolean;
  message: string;
}

const DataDropzone = ({ addDataset, disabled, message }: DataDropzoneProps) => {
  return (
    <Dropzone
      className={disabled ? "disabled" : undefined}
      disabled={disabled}
      onDrop={(files) => {
        files.forEach((file) => {
          Papa.parse(file, {
            complete: (results) => {
              if (!results.meta.fields) {
                notifications.show({
                  title: "Undefined column headers",
                  message: "No column header fields defined",
                  color: "red",
                });
                return;
              }

              // Check if any column header is numeric
              const hasNumericHeaders = results.meta.fields?.some(
                (field) => !isNaN(Number(field)),
              );

              if (hasNumericHeaders) {
                notifications.show({
                  title: "Invalid or missing column headers",
                  message:
                    "Column headers cannot be numbers. Please use text labels for your columns.",
                  color: "red",
                });
                return;
              }

              if (results.data.length < MIN_DATASET_SIZE) {
                notifications.show({
                  title: "Not enough data rows in file",
                  message: `Dataset must contain at least ${MIN_DATASET_SIZE} rows`,
                  color: "red",
                });
                return;
              }

              if (results.data.length > MAX_DATASET_SIZE) {
                notifications.show({
                  title: "Too many data rows in file",
                  message: `Dataset must not contain more than ${MAX_DATASET_SIZE} rows`,
                  color: "red",
                });
                return;
              }

              if (results.meta.fields.length < 2) {
                notifications.show({
                  title: "Not enough columns",
                  message:
                    "Dataset must contain at least two columns (sequences/mutants and numerical values)",
                  color: "red",
                });
                return;
              }

              if (results.errors.length > 0) {
                notifications.show({
                  title: "Error loading your dataset",
                  message: `Your data file contains ${
                    results.errors.length
                  } error(s). First error in row ${
                    results.errors[0].row !== undefined
                      ? results.errors[0].row + 1
                      : ""
                  }: ${results.errors[0].message}`,
                  color: "red",
                });
                return;
              }

              // keep API surface with papaparse as small as possible,
              // return our own type to outside this component;
              // default to first and second field as selected columns
              addDataset({
                name: file.name,
                fields: results.meta.fields!,
                rows: results.data as object[],
                sequenceCol: results.meta.fields![0],
                dataCol: results.meta.fields![1],
              });
            },
            header: true,
            skipEmptyLines: true,
          });
        });
      }}
      maxFiles={2}
      accept={[MIME_TYPES.csv]}
    >
      <Group
        justify="center"
        gap="xl"
        mih={60}
        style={{ pointerEvents: "none" }}
      >
        <Dropzone.Accept>
          <IconUpload
            size={52}
            color="var(--mantine-color-blue-6)"
            stroke={1.5}
          />
        </Dropzone.Accept>
        <Dropzone.Reject>
          <IconX size={52} color="var(--mantine-color-red-6)" stroke={1.5} />
        </Dropzone.Reject>
        <Dropzone.Idle>
          <IconFileTypeCsv
            size={40}
            color="var(--mantine-color-dimmed)"
            stroke={1.0}
          />
        </Dropzone.Idle>

        <div>
          <Text size="md" inline>
            Upload experimental data customize your model
          </Text>
          <Text size="sm" c="dimmed" inline mt={7}>
            {message}
          </Text>
        </div>
      </Group>
    </Dropzone>
  );
};

interface DataSectionProps {
  system: EntitySpec[];
  rawDatasets: RawDataset[];
  setRawDatasets: React.Dispatch<React.SetStateAction<RawDataset[]>>;
  verified: VerifiedDatasets;
  logTransform: boolean;
  setLogTransform: React.Dispatch<React.SetStateAction<boolean>>;
}

const DataSection = ({
  rawDatasets,
  setRawDatasets,
  verified,
  logTransform,
  setLogTransform,
}: DataSectionProps) => {
  const cards = rawDatasets.map((dataset, i) => {
    const datasetType =
      rawDatasets.length > 1
        ? i === 0
          ? "training"
          : "test"
        : "Training / test";
    return (
      <Card radius={"md"} key={i}>
        <Card.Section inheritPadding py="xs">
          <Group justify={"space-between"}>
            <Badge variant={"outline"}>{datasetType + " set"}</Badge>
            <Text c={"blue"} size={"sm"}>
              {`${dataset.name} (${dataset.rows.length} data points)`}
            </Text>
            <CloseButton
              onClick={() =>
                setRawDatasets(
                  rawDatasets.filter((_, curIndex) => curIndex !== i),
                )
              }
              variant={"transparent"}
            />
          </Group>
        </Card.Section>
        <Group justify={"space-between"} align={"top"}>
          <Select
            data={dataset.fields}
            label={"Sequence/mutant column"}
            description={
              "Full length sequences or mutations relative to target"
            }
            value={dataset.sequenceCol}
            error={
              verified.datasets[i].instanceSeriesInvalid.length > 0
                ? `Invalid ${verified.datasets[i].isMutantSeries ? "mutant" : "sequence"} in row ${verified.datasets[i].instanceSeriesInvalid[0] + 1}: ${ellipsis(verified.datasets[i].rawMutantOrInstanceSeries[verified.datasets[i].instanceSeriesInvalid[0]], 15)}`
                : undefined
            }
            onChange={(value) => {
              if (value)
                setRawDatasets(
                  rawDatasets.map((ds, index) =>
                    index === i ? { ...ds, sequenceCol: value } : ds,
                  ),
                );
            }}
          />
          <Select
            data={dataset.fields}
            label={"Experimental data column"}
            description={"Numeric values only, higher value must mean better."}
            value={dataset.dataCol}
            error={
              verified.datasets[i].dataSeriesInvalid.length > 0
                ? `Invalid value in row ${verified.datasets[i].dataSeriesInvalid[0] + 1}: ${ellipsis(verified.datasets[i].rawDataSeries[verified.datasets[i].dataSeriesInvalid[0]], 15)}`
                : undefined
            }
            onChange={(value) => {
              if (value)
                setRawDatasets(
                  rawDatasets.map((ds, index) =>
                    index === i ? { ...ds, dataCol: value } : ds,
                  ),
                );
            }}
          />
        </Group>
      </Card>
    );
  });

  const message =
    rawDatasets.length >= MAX_NUM_DATASETS
      ? "Maximum of two files can be uploaded, delete others first to upload."
      : rawDatasets.length === 0
        ? "Drag or select your training set file in CSV format here."
        : "Add an optional test set to use instead of cross-validation.";

  return (
    <>
      <DataDropzone
        addDataset={(newDataset) =>
          setRawDatasets([...rawDatasets, newDataset])
        }
        disabled={rawDatasets.length >= MAX_NUM_DATASETS}
        message={message}
      />
      {cards}
      {cards.length > 0 ? (
        <Switch
          checked={logTransform}
          onChange={(event) => setLogTransform(event.currentTarget.checked)}
          disabled={!verified.allPositive}
          label="Apply log transformation to data"
          description="Recommended for enrichment ratios relative to WT, kcat/Km, or similar. Requires all values to be positive."
        />
      ) : null}
    </>
  );
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
  const [filteredSeqs, setFilteredSeqs] = useState<Sequence[]>(msa.seqs);

  // user-uploaded datasets
  const [rawDatasets, setRawDatasets] = useState<RawDataset[]>([]);
  const [logTransform, setLogTransform] = useState(false);

  const [model, setModel] = useState<string | null>("evmutation2_ensembled");
  const [regressor, setRegressor] = useState<string>("RandomForestRegressor");
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
  const [jobName, setJobName] = useState("");
  const submission = useSubmission();
  const [isSubmitting, { open: openSubmitting, close: closeSubmitting }] =
    useDisclosure(false);

  const balance = useBalance();

  const { width: viewportWidth } = useViewportSize();
  const computedColorScheme = useComputedColorScheme("light", {
    getInitialValueInEffect: true,
  });

  // also instantiate system based on its components, will be forwarded to buildSpec
  // and subcomponents
  const system = useMemo(
    () =>
      [
        {
          type: "protein",
          rep: targetSeqCut,
          id: "1",
          first_index: targetSeq.start,
          sequences: {
            seqs: filteredSeqs,
            aligned: true,
            type: "protein",
            weights: null,
            format: "a3m",
          },
          deletions: false,
        },
      ] as EntitySpec[],
    [targetSeqCut, targetSeq, filteredSeqs],
  );

  // parse and verify uploaded datasets against system
  const verifiedDatasets = useMemo(() => {
    return verifyRawDatasets(rawDatasets, system);
  }, [rawDatasets, system]);

  const selectAllPos = () =>
    setPosSelection(range(targetSeq.start, targetSeq.end, 1));

  // (re-)initialize selected positions whenever target sequence changes
  useEffect(selectAllPos, [targetSeq]);

  // set only viable sampler option if ESM2 selected
  useEffect(() => {
    if (model?.startsWith("esm2") || verifiedDatasets.hasData) {
      if (sampler === "model") {
        setSampler("gibbs");
      }
      setInitStrategy("system");
    } else if (model?.startsWith("evmutation2")) {
      setInitStrategy("random");
    }
  }, [model, sampler, verifiedDatasets.hasData]);

  // useEffect(() => {
  //   if (sampler === "gibbs") setTemperature("1.0");
  // }, [sampler]);

  const numSeqs = filteredSeqs.length;
  const evoModelOk = numSeqs / targetSeqCut.length > 1;

  const downloadButton = useMemo(() => {
    if (msa) {
      const msaOut = filteredSeqs
        .map((seq) => `>${seq.id}\n${seq.seq}\n`)
        .join("");
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
  }, [filteredSeqs]);

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

  // no own sampling on esm2, so remove from list; same for sampling from supervised model which needs Gibbs
  if (model?.startsWith("esm2") || verifiedDatasets.hasData) {
    samplerOptions = samplerOptions.filter((x) => x.value !== "model");
  }

  const availableModelsRaw = [
    {
      value: "evmutation2_ensembled",
      label:
        "EVmutation2 (evolutionary model; best for designing functional proteins)",
    },
    // {
    //   value: "evmutation2",
    //   label:
    //     "EVmutation2 (lower accuracy mode, 4x speedup over ensembled version)",
    // },
    {
      value: "esm2_650m",
      label:
        "ESM2 650M (best for sequence-only design in absence of evolutionary record)",
    },
    // {
    //   value: "proteinmpnn",
    //   label:
    //     "ProteinMPNN (inverse folding model; best for designing stability but may lose function)",
    //   disabled: true,
    // },
  ];

  const availableModels = availableModelsRaw.filter(
    (model) =>
      !verifiedDatasets.hasData ||
      (model.value.startsWith("esm2") &&
        !verifiedDatasets.containsInsertions &&
        !verifiedDatasets.containsDeletions) ||
      (model.value.startsWith("evmutation2") &&
        !verifiedDatasets.containsInsertions &&
        verifiedDatasets.fixedLength),
  );

  // default to ESM2 for supervised modeling for now; but keep
  // user selection after uploading first dataset
  useEffect(() => {
    if (rawDatasets.length > 0) {
      setModel("esm2_650m");
    }
  }, [rawDatasets.length > 0]);

  // make sure our model selection is still valid, update otherwise
  useEffect(() => {
    if (availableModels.filter((am) => am.value === model).length === 0) {
      // if no available models, empty selection
      if (availableModels.length === 0) {
        setModel(null);
      } else {
        // otherwise default to first available model
        setModel(availableModels[0].value);
      }
    }
  }, [availableModels]);

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

  // only activate submit button if all inputs are valid, otherwise display an error
  let submitDisabled = false;
  let submitText = "Generate designs";

  if (posSelection.length === 0) {
    submitText = "Must select at least one position to design";
    submitDisabled = true;
  } else if (
    balance.finished &&
    (balance.balance === null || balance.balance <= MINIMUM_CREDIT)
  ) {
    submitText = "Insufficient compute credits";
    submitDisabled = true;
  } else if (verifiedDatasets.hasData && !verifiedDatasets.allValid) {
    // dataset handling
    submitText = "Error in uploaded dataset(s)";
    submitDisabled = true;
  } else if (model === null) {
    submitText = "No model is able to handle prediction task";
    submitDisabled = true;
  }

  return (
    <>
      {msa.taxonomyReport !== null ? (
        <TaxoviewModal
          opened={showFilterModal}
          close={toggleFilterModal}
          msa={msa}
          submit={setFilteredSeqs}
          colorScheme={computedColorScheme}
        />
      ) : null}
      <SubmissionModal
        isSubmitting={isSubmitting}
        close={closeSubmitting}
        submission={submission}
      />
      <Title order={1}>Specify design parameters</Title>
      <Title order={4} c="blue">
        Your target protein
      </Title>
      <Card padding="lg" radius="md" withBorder>
        <Group justify="space-between" pb={"xs"}>
          <Text>{numSeqs} homologous sequences found</Text>
          <Group>
            <Button
              variant="default"
              onClick={toggleFilterModal}
              disabled={msa.taxonomyReport === null}
            >
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
      <DataSection
        system={system}
        rawDatasets={rawDatasets}
        setRawDatasets={setRawDatasets}
        verified={verifiedDatasets}
        logTransform={logTransform}
        setLogTransform={setLogTransform}
      />
      <Space />
      <Title order={4} c="blue">
        Choose generation parameters
      </Title>
      <Stack>
        <Select
          label={"Protein model"}
          description="Select a molecular model that best aligns with your design goals"
          placeholder="Pick value"
          data={availableModels}
          value={model}
          error={
            model === null
              ? "No suitable model available for modeling problem"
              : undefined
          }
          onOptionSubmit={setModel}
          allowDeselect={false}
        />
        {verifiedDatasets.hasData ? (
          <Select
            label={"Regression model"}
            description="Select a model that will learn to map from embeddings/scores to your experimental data"
            placeholder={"Pick value"}
            data={[
              {
                value: "RandomForestRegressor",
                label: "Random forest regression",
              },
              {
                value: "RidgeCV",
                label: "Ridge regression",
              },
              {
                value: "LogisticRegressionCV",
                label: "Logistic regression",
              },
            ]}
            value={regressor}
            onOptionSubmit={setRegressor}
          />
        ) : undefined}
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
      <TextInput
        label="Job name"
        description="Descriptive name that helps you to find your job at a later time"
        placeholder="Enter job name (optional)"
        value={jobName}
        onChange={(event) => setJobName(event.currentTarget.value)}
      />
      <Space />
      <Button
        variant="filled"
        size="md"
        disabled={submitDisabled}
        onClick={() => {
          const spec = buildSpec(
            system,
            targetSeq.start,
            targetSeq.end,
            numDesigns,
            temperature,
            model!,
            sampler,
            restraints,
            posSelection,
            temperatureFactor,
            numSweeps,
            initStrategy,
            seqSearchId,
            structSearchId,
            structures,
            verifiedDatasets.hasData ? verifiedDatasets : null,
            regressor,
            logTransform,
          );

          // perform submission
          submission.mutate({
            name: jobName !== "" ? jobName : null,
            project_id: null,
            parent_job_id: null,
            public: false,
            spec: spec,
          });
          openSubmitting();
        }}
      >
        {submitText}
      </Button>
      <Space />
    </>
  );
};
