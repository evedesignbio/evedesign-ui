import { useEffect, useState } from "react";
import { Container, LoadingOverlay, Loader, Stack, Text } from "@mantine/core";
import { useMmseqsMsa, useMmseqsSearch } from "../../api/mmseqs.ts";
import { useFoldseekResult, useFoldseekSearch } from "../../api/foldseek.ts";
import {
  MsaOrStructureError,
  SequenceInput,
  SeqWithRegion,
} from "./sequence.tsx";
import { DesignSpecInput } from "./designspec.tsx";
import { useSession } from "../../context/SessionContext.tsx";
import { AuthenticationForm } from "../../features/auth";
import { useHashLocation } from "wouter/use-hash-location";
import imgUrl from "../../assets/background_image.jpg";

export const SubmissionPage = () => {
  // login session
  const { session } = useSession();

  // full target sequenceviewer with selected region as fed back by SequenceInput component
  const [targetSeq, setTargetSeq] = useState<SeqWithRegion | null>(null);

  // rudimentary navigation back to first submission page
  const [hashLocation, hashNavigate] = useHashLocation();
  useEffect(() => {
    if (targetSeq !== null && hashLocation === "/") {
      setTargetSeq(null);
    } else if (targetSeq === null && hashLocation === "/designspec") {
      hashNavigate("/");
    }
  }, [hashLocation]);

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
    msa.isLoading ||
    foldseekResult.isLoading;

  const allCompleted =
    seqSearch.completed &&
    foldseekSearch.completed &&
    msa.isSuccess &&
    msa.data &&
    foldseekResult.isSuccess;

  let render;
  if (session) {
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
                  <Text>
                    Retrieving evolutionary sequences and 3D structures
                  </Text>
                </Stack>
              ),
            }}
          />
          <SequenceInput setTargetSeq={setTargetSeq} />
        </>
      );
    } else if (allCompleted) {
      render = (
        <DesignSpecInput
          targetSeq={targetSeq}
          msa={msa.data!}
          structures={foldseekResult.data!}
          seqSearchId={seqSearch.id}
          structSearchId={foldseekSearch.id}
        />
      );
    } else {
      render = <MsaOrStructureError reset={() => setTargetSeq(null)} />;
    }
  } else {
    render = <AuthenticationForm title={"Please sign in to design!"} />;
  }

  return (
    <>
      {targetSeq === null ? (
        <div
          style={{
            position: "absolute",
            top: 55,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: `url(${imgUrl})`,
            opacity: 0.2,
            backgroundAttachment: "fixed",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            backgroundSize: "cover",
            zIndex: -1,
          }}
        />
      ) : null}
      <Container size="sm" pt="xl">
        <Stack>{render}</Stack>
      </Container>
    </>
  );
};
