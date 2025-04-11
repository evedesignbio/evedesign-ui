import { useState, useMemo } from "react";

import { Button } from "@mantine/core";
import { useMmseqsMsa, useMmseqsSearch } from "../../api/mmseqs.ts";
import { useFoldseekResult, useFoldseekSearch } from "../../api/foldseek.ts";
import { SequenceInput, SeqWithRegion } from "./sequence.tsx";

export const SubmissionPage = () => {
  // full target sequence with selected region as fed back by SequenceInput component
  const [targetSeq, setTargetSeq] = useState<SeqWithRegion | null>(null);

  const targetSeqCut =
    targetSeq !== null
      ? targetSeq.seq.substring(targetSeq.start - 1, targetSeq.end)
      : null;

  const targetFirstIndex = targetSeq !== null ? targetSeq.start : null;

  // MMseqs query submission and status retrieval (does not download MSA to decouple)
  const seqSearch = useMmseqsSearch(targetSeqCut);
  const msa = useMmseqsMsa(seqSearch.completed ? seqSearch.id : null);
  console.log("MSA", msa.data);
  const numSeqs = msa && msa.data ? msa.data.length : 0;
  // const seqSearch = null;
  // const numSeqs = null;

  const foldseekSearch = useFoldseekSearch(targetSeqCut);
  const foldseekResult = useFoldseekResult(
    foldseekSearch.completed ? foldseekSearch.id : null,
  );
  const numStructures = foldseekResult.data?.results[0].alignments[0].length;

  const downloadButton = useMemo(() => {
    if (msa.data) {
      console.log("prepare download");
      const msaOut = msa.data.map((seq) => `>${seq.id}\n${seq.seq}\n`).join("");
      const blob = new Blob([msaOut], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      console.log("download", url);
      return (
        <Button component="a" href={url} download="mmseqs_msa.a3m">
          Download MSA
        </Button>
      );
      // return <Button onClick={() => console.log("download")}>Download MSA</Button>;
    } else {
      return null;
    }
  }, [msa.data]);

  if (targetSeq === null) {
    return <SequenceInput setTargetSeq={setTargetSeq} />;
  } else {
    return (
      <>
        <div>
          Target seq: {targetSeqCut} {targetFirstIndex}
        </div>
        <div>{JSON.stringify(seqSearch)}</div>
        <div>Number of sequences: {numSeqs}</div>
        <div>Number of structures: {numStructures}</div>
        {downloadButton}

        {/*<div>Error: {JSON.stringify(mmseqsError)}</div>*/}
        {/*<div>Running: {JSON.stringify(mmseqsRunning)}</div>*/}
        {/*<div>ID: {JSON.stringify(mmseqsId)}</div>*/}
        {/*<div>Complete: {JSON.stringify(mmseqsComplete)}</div>*/}
      </>
    );
  }
  // TODO: // const [_, navigate] = useLocation();
  // TODO: navigation to results page onClick={() => navigate("/results/A1234")}
};
