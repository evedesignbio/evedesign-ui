import {
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

export interface ProteinToDnaApiResult {
  spec: ProteinToDnaSpec;
  dna_sequences: ProteinToDnaResult[];
}

export interface ApiJobResult {
  status: "initialized" | "running" | "failed" | "finished" | "invalid";
  results: PipelineApiResult | SingleMutationScanApiResult | ProteinToDnaApiResult | null;
}
