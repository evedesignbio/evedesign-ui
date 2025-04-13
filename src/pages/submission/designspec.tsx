import { useMemo } from "react";
import {
  Button,
  Card,
  Group,
  NumberInput,
  Select,
  Space,
  Text,
  Title,
} from "@mantine/core";
import { Sequence } from "../../models/design.ts";
import { SeqWithRegion } from "./sequence.tsx";
import { SequenceViewer } from "../../components/sequenceviewer";

export interface DesignSpecProps {
  targetSeq: SeqWithRegion;
  msa: Sequence[];
}

export const DesignSpecInput = ({ targetSeq, msa }: DesignSpecProps) => {
  const targetSeqCut = targetSeq.seq.substring(
    targetSeq.start - 1,
    targetSeq.end,
  );

  // const [posSelection, setPosSelection] = useState<number[] | null >(null);

  const numSeqs = msa.length;

  const downloadButton = useMemo(() => {
    if (msa) {
      const msaOut = msa.map((seq) => `>${seq.id}\n${seq.seq}\n`).join("");
      const blob = new Blob([msaOut], { type: "text/plain" });
      const url = URL.createObjectURL(blob);

      return (
        <Button
          variant="default"
          component="a"
          href={url}
          download="mmseqs_msa.a3m"
        >
          Download MSA
        </Button>
      );
    } else {
      return null;
    }
  }, [msa]);

  // TODO: need to cut target sequence ... right now showing full sequence
  // TODO: init positions when input target seq changes
  // TODO: allow to select model
  // TODO: allow to select sampler
  // TODO: add sampler params

  return (
    <>
      <Title order={1}>Specify design parameters</Title>
      <Title order={4} c="blue">
        Your target sequence
      </Title>
      <Card padding="lg" radius="md">
        <Group justify="space-between">
          <Text>{numSeqs} homologous sequences found</Text>
          <Group>
            <Button variant="default" disabled={true}>
              Filter
            </Button>
            {downloadButton}
          </Group>
        </Group>
      </Card>
      <Title order={4} c="blue">
        Choose generation parameters
      </Title>
      <Group>
        <NumberInput
          label="Number of designs"
          min={1}
          max={20000}
          step={1000}
          defaultValue={1000}
          thousandSeparator={true}
          allowDecimal={false}
          description="More designs take longer to run"
        />
        <Select
          label="Sequence diversity (temperature)"
          description="Higher temperature gives more diversity"
          placeholder="Pick value"
          defaultValue={"0.1"}
          data={[
            { value: "0.0001", label: "0.0001 (very low)" },
            { value: "0.001", label: "0.001 (low)" },
            { value: "0.1", label: "0.1 (normal)" },
            { value: "1.0", label: "1.0 (high)" },
          ]}
        />
      </Group>
      <Space />
      <Title order={4} c="blue">
        Define positions to mutate
      </Title>
      <Space />
      <SequenceViewer
        seq={targetSeqCut}
        firstIndex={targetSeq.start}
        handleClick={(pos) => {
          console.log("clicked", pos);
        }}
        getPosStyle={(_) => "selectable"}
        chunkSize={10}
      />
      <Group>
        <Button variant="default">Select all</Button>
        <Button variant="default">Select none</Button>
        <Button variant="default">Invert selection</Button>
      </Group>
      <Space />
      <Button
        variant="filled"
        size="md"
        disabled={true}
        onClick={() => console.log("GENERATE")}
      >
        Generate designs (coming soon)
      </Button>
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
