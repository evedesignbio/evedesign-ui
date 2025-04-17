export interface Sequence {
  seq: string;
  id: string | null;
  key: string | null;
  type: "protein" | "dna" | "rna";
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

export interface SystemInstanceSpec {
  entity_instances: EntityInstanceSpec[];
  score: number | null;
  confidence: number | null;
  metadata: object | null;
}

export interface GenerateArgsSpec {
  num_designs: number;
  entities: number[] | null;
  fixed_pos: object | null; // TODO: refine definition
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
  metadata: object | null;
  system: EntitySpec[];
  system_instances: SystemInstanceSpec[] | null;
  steps: GenerationStepSpec[]; // TODO: implement other step types from backend
}

export interface SingleMutationScanSpec {
  key: "single_mutation_scan";
  schema_version: string;
  system: EntitySpec[];
  // system_instances: SystemInstanceSpec;
  scorer: object;
  entity: number | null;
  positions: number[] | null;
  metadata: object | null;
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
