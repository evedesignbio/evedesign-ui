import {
  PipelineApiResult,
  SingleMutationScanApiResult,
} from "../../models/api.ts";

export interface ResultViewerProps {
  results: PipelineApiResult | SingleMutationScanApiResult;
}

export const ResultViewer = ({ results }: ResultViewerProps) => {
  // TODO: result download buttons for instances (FASTA / CSV) and for single mutation matrix scores
  console.log(results);
  return <>hallo</>;
};
