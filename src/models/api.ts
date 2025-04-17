import {
  PipelineSpec,
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

export interface ApiJobResult {
  status: "initialized" | "running" | "failed" | "finished" | "invalid";
  results: PipelineApiResult | SingleMutationScanApiResult | null;
}
