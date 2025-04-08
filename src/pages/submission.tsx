import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Container,
  Group,
  Stack,
  Text,
  Textarea,
  Title,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import "./submission.css";

const UNIPROT_AC_REGEXP = RegExp(
  "^[OPQ][0-9][A-Z0-9]{3}[0-9]$|^[A-NR-Z][0-9]([A-Z][A-Z0-9]{2}[0-9]){1,2}$",
);
const UNIPROT_NAME_REGEXP = RegExp("^[A-Z0-9]{1,10}_[A-Z0-9]{1,5}$");
const AMINO_ACID_SEQ_REGEXP = RegExp("^[ACDEFGHIKLMNPQRSTVWY]+$");
const uniprotUrlForId = (id: string): string => {
  return `https://rest.uniprot.org/uniprotkb/${id}.fasta`;
};

const DEBOUNCE_TIME = 100;
const MIN_SEQ_LENGTH = 20;

interface RegionSelectorProps {
  seq: string;
}

const RegionSelector = ({ seq }: RegionSelectorProps) => {
  const chars = [...seq];
  let chunks = [];
  const chunkSize = 10;

  for (let i = 0; i < chars.length; i = i + chunkSize) {
    chunks.push(chars.slice(i, i + chunkSize));
  }

  // TODO: make sure that all chars are rendered at equal width (font?)
  // TODO: selection ... need to store in state, and need to reset if new sequence is entered
  return (
    <Group className="sequence">
      {chunks.map((chunk, index) => (
        <div key={index} className="sequenceblock">
          {chunk.map((char) => <span>{char}</span>)}
        </div>
      ))}
    </Group>
  );
};

export const SubmissionPage = () => {
  const [seqInput, setSeqInput] = useState("");
  const [debouncedSeqInput] = useDebouncedValue(seqInput, DEBOUNCE_TIME);

  // normalize input: make upper case and remove any whitespace
  const debouncedSeqInputUpper = debouncedSeqInput
    .replace(/\s/g, "")
    .toUpperCase();

  // does input look like a valid UniProt accession/name?
  const validUniprotId =
    UNIPROT_AC_REGEXP.test(debouncedSeqInputUpper) ||
    UNIPROT_NAME_REGEXP.test(debouncedSeqInputUpper);

  // does input look like a valid amino acid sequence?
  const validProteinSeq = AMINO_ACID_SEQ_REGEXP.test(debouncedSeqInputUpper);

  // only if input looks like it could be valid Uniprot ID/name, try to retrieve it
  // (may still fail, even if regexp matches)
  const seqQuery = useQuery({
    queryKey: ["seq", debouncedSeqInputUpper],
    queryFn: () =>
      fetch(uniprotUrlForId(debouncedSeqInputUpper)).then((res) => {
        if (!res.ok) {
          throw new Error("Sequence could not be retrieved");
        }
        return res.text();
      }),
    staleTime: Infinity,
    enabled: validUniprotId,
    retry: false,
  });

  let seq: string | null = null;
  let error: string | null = null;

  // if we have a hypothetically valid uniprot identifier, status is determined by fetching results
  if (validUniprotId) {
    if (seqQuery.isError) {
      error = "Invalid identifier";
    } else if (seqQuery.isSuccess) {
      const [_, ...seqLines] = seqQuery.data.split("\n");
      seq = seqLines.join("");
    }
    // note: not handling seqQuery.isPending on purpose
  } else {
    // otherwise, can only have a valid amino acid sequence or an error, unless input is empty
    if (validProteinSeq) {
      // make sure sequence is not too short
      if (debouncedSeqInputUpper.length < MIN_SEQ_LENGTH) {
        error = `Sequence too short (minimum length: ${MIN_SEQ_LENGTH} amino acids)`;
      } else {
        seq = debouncedSeqInputUpper;
      }
    } else if (debouncedSeqInputUpper.length > 0) {
      error = "Invalid input";
    }
  }

  return (
    <Container size="sm" pt="xl">
      <Stack>
        <Title order={1}>Create new design target</Title>
        <Title order={4}>Enter your target protein</Title>
        <Textarea
          size="md"
          // label="Enter your target protein"
          // description=" "
          placeholder="UniProt identifier, entry name or amino acid sequence"
          autosize
          value={seqInput}
          onChange={(e) => setSeqInput(e.target.value)}
          error={error}
        />
        {seq ? (
          <>
            <Title order={4}>Choose protein model region (optional)</Title>
            <Text c="dimmed">
              Limiting your model to relevant subregions/domains can lead to
              better results and reduces computation time
            </Text>
            <RegionSelector seq={seq} />
            <Button variant="filled" size="md">
              Continue to next step
            </Button>
          </>
        ) : null}
      </Stack>
    </Container>
  );
};
