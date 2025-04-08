import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Container, Stack, Textarea, Title } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";

const UNIPROT_AC_REGEXP = RegExp(
  "^[OPQ][0-9][A-Z0-9]{3}[0-9]$|^[A-NR-Z][0-9]([A-Z][A-Z0-9]{2}[0-9]){1,2}$",
);
const UNIPROT_NAME_REGEXP = RegExp("^[A-Z0-9]{1,10}_[A-Z0-9]{1,5}$");
const AMINO_ACID_SEQ_REGEXP = RegExp("^[ACDEFGHIKLMNPQRSTVWY]+$");
const uniprotUrlForId = (id: string): string => {
  return `https://rest.uniprot.org/uniprotkb/${id}.fasta`;
};

const MIN_SEQ_LENGTH = 20;

export const SubmissionPage = () => {
  const [seqInput, setSeqInput] = useState("");
  const [debouncedSeqInput] = useDebouncedValue(seqInput, 500);

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
        <Textarea
          size="md"
          label="Enter your target protein"
          description=" "
          placeholder="UniProt identifier, entry name or amino acid sequence"
          autosize
          value={seqInput}
          onChange={(e) => setSeqInput(e.target.value)}
          error={error}
        />
      </Stack>
      <div>{debouncedSeqInput}</div>
      <div>
        <b>seq:</b> {seq}
      </div>
      <div>...</div>
      <div>
        <b>error:</b>
        {error}
      </div>
    </Container>
  );
};
