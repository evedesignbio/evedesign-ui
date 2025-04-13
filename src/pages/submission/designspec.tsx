import { useMemo } from "react";
import { Button, Card, Group, Text, Title } from "@mantine/core";
import { Sequence } from "../../models/design.ts";
import { SeqWithRegion } from "./sequence.tsx";

export interface DesignSpecProps {
  targetSeq: SeqWithRegion;
  msa: Sequence[];
}

export const DesignSpecInput = ({ targetSeq, msa }: DesignSpecProps) => {
  const numSeqs = msa.length;

  const downloadButton = useMemo(() => {
    if (msa) {
      const msaOut = msa.map((seq) => `>${seq.id}\n${seq.seq}\n`).join("");
      const blob = new Blob([msaOut], { type: "text/plain" });
      const url = URL.createObjectURL(blob);

      return (
        <Button component="a" href={url} download="mmseqs_msa.a3m">
          Download MSA
        </Button>
      );
    } else {
      return null;
    }
  }, [msa]);

  console.log(targetSeq);

  // TODO: instantiate design spec based on sequences / structures automatically?
  // TODO: put spec state in this function, use reducer to operate on it
  // TODO: render design spec through separate child component

  return (
    <>
      <Title order={1}>Specify design parameters</Title>
      <Title order={4} c="blue">
        Your target sequence
      </Title>
      <Card padding="lg" radius="md">
        <Group justify="space-between">
          <Text>{numSeqs} homologous sequences found</Text>
          {downloadButton}
        </Group>
      </Card>

      <Title order={4} c="blue">
        Choose generation strategy
      </Title>
      <Text>coming soon :)</Text>
      <Title order={4} c="blue">
        Define positions to mutate in designs
      </Title>
      <Text>coming soon :)</Text>
    </>
  );
};

// const numSeqs = msa && msa.data ? msa.data.length : 0;
// const numStructures = foldseekResult.data?.results[0].alignments[0].length;
// const targetFirstIndex = targetSeq !== null ? targetSeq.start : null;

// <>
//   <div>
//     Target seq: {targetSeqCut} {targetFirstIndex}
//   </div>
//   <div>{JSON.stringify(seqSearch)}</div>
//   <div>Number of sequences: {numSeqs}</div>
//   <div>Number of structures: {numStructures}</div>
//   {downloadButton}
//
//   {/*<div>Error: {JSON.stringify(mmseqsError)}</div>*/}
//   {/*<div>Running: {JSON.stringify(mmseqsRunning)}</div>*/}
//   {/*<div>ID: {JSON.stringify(mmseqsId)}</div>*/}
//   {/*<div>Complete: {JSON.stringify(mmseqsComplete)}</div>*/}
// </>
// // TODO: // const [_, navigate] = useLocation();
// // TODO: navigation to results page onClick={() => navigate("/results/A1234")}
