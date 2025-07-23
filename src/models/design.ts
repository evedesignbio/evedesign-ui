import { StructureAlignment } from "./structure.ts";

export interface SequenceMetadata {
  seqspace_projection?: number[];
  // TODO: add taxonomy here as well
}

export interface Sequence {
  seq: string;
  id: string | null;
  key: string | null;
  type: "protein" | "dna" | "rna";
  metadata: SequenceMetadata;
}

export interface SequencesSpec {
  seqs: Sequence[];
  aligned: boolean;
  type: string;
  weights: number[] | null;
  format: string;
}

export interface EntitySpec {
  type: string;
  rep: string;
  id: string;
  first_index: number;
  sequences: SequencesSpec;
}

export interface EntityInstanceSpec {
  rep: string;
  models: object | null;
}

export interface Mutation {
  entity: number;
  pos: number;
  ref: string;
  to: string;
}

export interface SystemInstanceMetadata {
  seqspace_projection?: number[];
}

export interface SystemInstanceSpec {
  entity_instances: EntityInstanceSpec[];
  score: number | null;
  confidence: number | null;
  metadata: SystemInstanceMetadata | null;
}

export interface SystemInstanceSpecEnhanced extends SystemInstanceSpec {
  id: string;
  mutant: Mutation[];
  seqMap?: Map<string, string>;
  count: number;
}

export const systemInstanceFromSystem = (
  system: EntitySpec[],
): SystemInstanceSpec => {
  return {
    entity_instances: system.map((entity) => ({
      rep: entity.rep,
      models: null,
    })),
    score: null,
    confidence: null,
    metadata: null,
  };
};

export interface JobSpecMetadata {
  msa_search_job_id: string;
  structure_search_job_id: string;
  structure_search_result: StructureAlignment[];
}

export interface GenerateArgsSpec {
  num_designs: number;
  entities: number[] | null;
  fixed_pos: Record<number, number[]> | null;
  temperature: number;
  deletions: boolean;
}

export interface GenerationStepSpec {
  key: "generate";
  generator: object;
  args: GenerateArgsSpec;
}

export interface PipelineSpec {
  key: "pipeline";
  schema_version: string;
  metadata: JobSpecMetadata | null;
  system: EntitySpec[];
  system_instances: SystemInstanceSpec[] | null;
  steps: GenerationStepSpec[]; // TODO: implement other step types from backend
}

export interface SingleMutationScanSpec {
  key: "single_mutation_scan";
  schema_version: string;
  system: EntitySpec[];
  system_instance: SystemInstanceSpec;
  scorer: object;
  entity: number | null;
  positions: number[] | null;
  metadata: JobSpecMetadata | null;
}

export interface SingleMutWithScore {
  to: string;
  score: number;
}

export interface SingleMutationScanResult {
  entity: number;
  pos: number;
  ref: string;
  subs: SingleMutWithScore[];
}

export interface ProteinToDnaOptimizerArgsSpec {
  system: EntitySpec[];
  system_instances: SystemInstanceSpec[];
  entity: number;
  upstream_dna: string;
  downstream_dna: string;
  reference: SystemInstanceSpec | null;
  reference_dna: string | null;
}

export type CodonOptimizationMethod = "use_best_codon" | "match_codon_usage";

export interface DnaChiselArgsSpec {
  method: CodonOptimizationMethod;
  codon_usage_table: string; // do not use literal as we might allow TaxIDs as well eventually
  avoid_sites: string[];
  gc_min: number | null;
  gc_max: number | null;
  gc_window: number | null;
  max_homopolymer_length: number | null;
  max_repeat_length: number | null;
  avoid_hairpins: boolean;
  genetic_code: "Standard";
}

export interface DnaChiselSpec {
  key: "dnachisel";
  variant: "default";
  args: DnaChiselArgsSpec;
}

export interface ProteinToDnaSpec {
  key: "protein_to_dna";
  schema_version: string;
  optimizer: DnaChiselSpec;
  args: ProteinToDnaOptimizerArgsSpec;
}

export interface ProteinToDnaResult {
  rep: string;
  dna: string;
  score: number | null;
}

export interface Position {
  entity: number;
  pos: number;
}