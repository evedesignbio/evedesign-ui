export interface Sequence {
  seq: string;
  id: string | null;
  key: string | null;
  type: "protein" | "dna" | "rna"
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
  // TODO
}

export interface SystemInstanceSpec {
  // TODO
}

export interface GenerateArgsSpec {
  num_designs: number;
  entities: number[] | null;
  fixed_pos: object | null;  // TODO: refine definition
  temperature: number;
  deletions: boolean;
}

export interface GenerationStepSpec {
  key: string;
  generator: object;
  args: GenerateArgsSpec;
}

export interface PipelineSpec {
  key: string;
  schema_version: string;
  metadata: object | null;
  system: EntitySpec[];
  system_instances: SystemInstanceSpec[] | null;
  steps: GenerationStepSpec[];  // TODO: implement other step types from backend
}