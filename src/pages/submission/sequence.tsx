import { useEffect, useState } from "react";
import { Button, Group, Space, Text, Textarea, Title } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SequenceViewer } from "../../components/sequenceviewer";

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
const MIN_REGION_LENGTH = 20;
const MAX_REGION_LENGTH = 1000;

export interface SeqWithRegion {
  seq: string;
  start: number;
  end: number;
}

interface RegionSelectorProps {
  seq: string;
  regionStart: number | null;
  regionEnd: number | null;
  setRegionStart: (start: number | null) => void;
  setRegionEnd: (start: number | null) => void;
}

const RegionSelector = ({
  seq,
  regionStart,
  regionEnd,
  setRegionStart,
  setRegionEnd,
}: RegionSelectorProps) => {
  const handleClick = (pos: number) => {
    // if region end defined, click starts a new selection
    if (regionEnd) {
      setRegionStart(pos);
      setRegionEnd(null);
    } else {
      // start must be defined
      setRegionEnd(pos);
    }
    // note click to invalid position is impossible to disabled pointer events through CSS
  };

  const getPosStyle = (pos: number) => {
    const selectedClass =
      regionStart && regionEnd && pos >= regionStart && pos <= regionEnd
        ? "selected"
        : "";
    const selectableClass =
      regionEnd || pos >= regionStart! ? "selectable" : "unselectable";

    return selectedClass + " " + selectableClass;
  };

  return (
    <SequenceViewer
      seq={seq}
      firstIndex={1}
      handleClick={handleClick}
      getPosStyle={getPosStyle}
      chunkSize={10}
    />
  );
};

interface SequenceInputProps {
  setTargetSeq: (seq: SeqWithRegion) => void;
}

export const SequenceInput = ({ setTargetSeq }: SequenceInputProps) => {
  const [seqInput, setSeqInput] = useState("");
  const [debouncedSeqInput] = useDebouncedValue(seqInput, DEBOUNCE_TIME);

  // handle error message through state to avoid jitter upon reloading
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // selection start and end; one-based indexing and end index is inclusive
  const firstIndex = 1;
  const [regionStart, setRegionStart] = useState<number | null>(null);
  const [regionEnd, setRegionEnd] = useState<number | null>(null);

  // normalize input: make upper case and remove any whitespace
  const debouncedSeqInputUpper = debouncedSeqInput
    .replace(/\s/g, "")
    .toUpperCase();

  // does input look like a valid UniProt accession/name?
  const validUniprotId =
    UNIPROT_AC_REGEXP.test(debouncedSeqInputUpper) ||
    UNIPROT_NAME_REGEXP.test(debouncedSeqInputUpper);

  // does input look like a valid amino acid sequenceviewer?
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
    // otherwise, can only have a valid amino acid sequenceviewer or an error, unless input is empty
    if (validProteinSeq) {
      // make sure sequenceviewer is not too short
      if (debouncedSeqInputUpper.length < MIN_SEQ_LENGTH) {
        error = `Sequence too short (minimum length: ${MIN_SEQ_LENGTH} amino acids)`;
      } else {
        seq = debouncedSeqInputUpper;
      }
    } else if (debouncedSeqInputUpper.length > 0) {
      error = "Invalid input";
    }
  }

  // avoid error message jitter while trying to load a Uniprot entry that looks like a valid ID but is not
  useEffect(() => {
    if (!seqQuery.isFetching) {
      setErrorMsg(error);
    }
  }, [error, seqQuery.isFetching]);

  // update region start/end if sequenceviewer changes
  useEffect(() => {
    if (seq !== null) {
      setRegionStart(firstIndex);
      setRegionEnd(firstIndex + seq.length - 1);
    }
  }, [seq]);

  const definedRegion = regionStart !== null && regionEnd !== null;
  let regionError = null;
  if (definedRegion) {
    const regionLength = regionEnd - regionStart + 1;
    if (regionLength < MIN_REGION_LENGTH) {
      regionError = `Selected region is too short (minimum: ${MIN_REGION_LENGTH} positions)`;
    } else if (regionLength > MAX_REGION_LENGTH) {
      regionError = `Selected region is too long (maximum: ${MAX_REGION_LENGTH} positions)`;
    }
  } else {
    regionError = "Complete your region selection";
  }

  return (
    <>
      <Title order={1}>Create new design target</Title>
      <Title order={4} c="blue">
        Enter your target protein
      </Title>
      <Textarea
        size="md"
        // label="Enter your target protein"
        // description=" "
        placeholder="UniProt identifier, entry name or amino acid sequence"
        autosize
        value={seqInput}
        onChange={(e) => setSeqInput(e.target.value)}
        error={errorMsg}
      />
      {seq ? (
        <>
          <Title order={4} c="blue">
            Choose protein model region (optional)
          </Title>
          <Text c="dimmed">
            Limiting your model to relevant subregions/domains can lead to
            better results and reduces computation time. Click on first residue
            to start selection, then on last residue to end selection.
          </Text>
          <Space />
          <RegionSelector
            seq={seq}
            regionStart={regionStart}
            regionEnd={regionEnd}
            setRegionStart={setRegionStart}
            setRegionEnd={setRegionEnd}
          />
          <Space />
          <Button
            variant="filled"
            size="md"
            disabled={regionError !== null}
            onClick={() =>
              setTargetSeq({ seq: seq, start: regionStart!, end: regionEnd! })
            }
          >
            {regionError === null ? "Continue to next step" : regionError}
          </Button>
        </>
      ) : null}
    </>
  );
};

export interface MsaOrStructureErrorProps {
  reset: () => void;
}

export const MsaOrStructureError = ({ reset }: MsaOrStructureErrorProps) => {
  const queryClient = useQueryClient();
  return (
    <>
      <Title order={1}>Error :(</Title>
      <Text>
        Something went wrong while trying to fetch sequences and structures from
        the MMseqs and FoldSeek web servers. If you tried many inputs in a short
        time, you may have hit their rate limit. Please try again later.
      </Text>
      <Group>
        <Button onClick={reset} variant={"outline"}>
          Back to submission
        </Button>
        <Button onClick={() => queryClient.invalidateQueries()}>Retry</Button>
      </Group>
    </>
  );
};
