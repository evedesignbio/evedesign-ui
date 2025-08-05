import {
  InputSpecTypeKeys,
  PipelineSpec, ProteinToDnaResult, ProteinToDnaSpec,
  SingleMutationScanResult,
  SingleMutationScanSpec,
  SystemInstanceSpec,
} from "./design.ts";

export interface PipelineApiResult {
  spec: PipelineSpec;
  instances: SystemInstanceSpec[];
}

export interface SingleMutationScanApiResult {
  spec: SingleMutationScanSpec;
  scores: SingleMutationScanResult[];
}

export type DesignJobApiResult = PipelineApiResult | SingleMutationScanApiResult;

export interface ProteinToDnaApiResult {
  spec: ProteinToDnaSpec;
  dna_sequences: ProteinToDnaResult[];
}

export interface ApiJobResult {
  type: InputSpecTypeKeys;
  status: "initialized" | "pending" | "running" | "finished" | "failed" | "terminated" | "invalid" | "paused";
  name: string | null;
  project_id: string | null;
  parent_job_id: string | null;
  public: boolean;
  created_at: Date;
  updated_at: Date;
  started_at: Date | null;
  finished_at: Date | null;
  results: PipelineApiResult | SingleMutationScanApiResult | ProteinToDnaApiResult | null;
}
