import { useState } from "react";
import {
  Container,
  LoadingOverlay,
  Loader,
  Stack,
  Text,
} from "@mantine/core";
import { useMmseqsMsa, useMmseqsSearch } from "../../api/mmseqs.ts";
import { useFoldseekResult, useFoldseekSearch } from "../../api/foldseek.ts";
import {
  MsaOrStructureError,
  SequenceInput,
  SeqWithRegion,
} from "./sequence.tsx";
import { DesignSpecInput } from "./designspec.tsx";

export const SubmissionPage = () => {
  // full target sequenceviewer with selected region as fed back by SequenceInput component
  const [targetSeq, setTargetSeq] = useState<SeqWithRegion | null>(null);

  const targetSeqCut =
    targetSeq !== null
      ? targetSeq.seq.substring(targetSeq.start - 1, targetSeq.end)
      : null;

  // MMseqs and FoldSeek query submission and retrieval
  const seqSearch = useMmseqsSearch(targetSeqCut);
  const msa = useMmseqsMsa(seqSearch.completed ? seqSearch.id : null);
  const foldseekSearch = useFoldseekSearch(targetSeqCut);
  const foldseekResult = useFoldseekResult(
    foldseekSearch.completed ? foldseekSearch.id : null,
  );

  // const anyError =
  //   seqSearch.error ||
  //   msa.isError ||
  //   foldseekSearch.error ||
  //   foldseekResult.isError;

  const anyLoading =
    seqSearch.running ||
    foldseekSearch.running ||
    msa.isFetching ||
    foldseekResult.isFetching;

  const allCompleted =
    seqSearch.completed &&
    foldseekSearch.completed &&
    msa.isSuccess &&
    msa.data &&
    foldseekResult.isSuccess;

  let render;
  if (targetSeq === null || anyLoading) {
    render = (
      <>
        <LoadingOverlay
          visible={anyLoading}
          zIndex={1000}
          overlayProps={{ radius: "sm", blur: 2 }}
          loaderProps={{
            children: (
              <Stack align="center">
                <Loader type="dots" size="xl" />
                <Text>Retrieving evolutionary sequences and 3D structures</Text>
              </Stack>
            ),
          }}
        />
        <SequenceInput setTargetSeq={setTargetSeq} />
      </>
    );
  } else if (allCompleted) {
    render = <DesignSpecInput targetSeq={targetSeq} msa={msa.data!} />;
  } else {
    render = <MsaOrStructureError reset={() => setTargetSeq(null)} />;
  }
  return (
    <Container size="sm" pt="xl">
      <Stack>{render}</Stack>
    </Container>
  );
};
