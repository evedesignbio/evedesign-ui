import {
  InputSpecTypeKeys,
  PipelineSpec, ProteinToDnaResult, ProteinToDnaSpec, Sequence,
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

export type JobStatus = "initialized" | "pending" | "running" | "finished" | "failed" | "terminated" | "invalid" | "paused";

export interface ApiJobResult {
  type: InputSpecTypeKeys;
  status: JobStatus;
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

export type UUID = string;

export interface JobSummary {
  id: UUID;
  name: string | null;
  status: JobStatus;
  type: InputSpecTypeKeys;
  project_id: UUID | null;
  parent_job_id: UUID | null;
  public: boolean;
  created_at: Date;
  updated_at: Date;
  started_at: Date | null;
  finished_at: Date | null;
}

export interface JobListResponse {
  jobs: JobSummary[];
}

export interface ApiBalanceResult {
  balance: number | null;
}

export interface MsaResult {
  seqs: Sequence[];
  taxonomyReport: string | null;
}