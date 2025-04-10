import { useQuery } from "@tanstack/react-query";
import { convertToQueryUrl } from "./utils.ts";
// @ts-ignore
import TarReader from "./tar.js";
import { Sequence } from "../models/design.ts";

const MMSEQS_POLLING_INTERVAL = 2000;
const mmseqsBaseUrl = (): string => "https://api.colabfold.com/";

const runningOrPending = (s: string | undefined) =>
  s === "RUNNING" || s === "PENDING";

const validStatus = (s: string | undefined) =>
  s === undefined || s === "RUNNING" || s === "PENDING" || s === "COMPLETE";

export const useMmseqsSearch = (seq: string | null) => {
  // Step 1: Post query sequence to MMseqs server
  // following https://hulk.mmseqs.com/mmirdit/scratch/requestmsa.mjs and https://hulk.mmseqs.com/mmirdit/scratch/
  const qSub = useQuery({
    queryKey: ["mmseqs_submit", seq],
    queryFn: () =>
      fetch(mmseqsBaseUrl() + "ticket/msa", {
        method: "POST",
        headers: {
          "User-Agent": "designserver-frontend",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: convertToQueryUrl({
          q: `>1\n${seq}`,
          mode: "env",
        }),
      }).then((res) => {
        if (!res.ok) {
          throw new Error(`MMseqs submission failure: ${res.status}`);
        }
        return res.json();
      }),
    // only submit to server if there is a target sequence,
    enabled: seq !== null,
    /*
    // use res.qStatus to distinguish failure modes?
    // retry if qStatus is RATELIMIT or UNKNOWN but how to best detect this here?
    retry: (failureCount, error) => {
      console.log("SUBMIT ERROR", failureCount, error);
      return false;
    },*/
    staleTime: Infinity,
  });

  const qStatus = useQuery({
    queryKey: ["mmseqs_status", qSub.data?.id],
    queryFn: () =>
      fetch(mmseqsBaseUrl() + "ticket/" + qSub.data?.id).then((res) => {
        if (!res.ok) {
          throw new Error("Failed to retrieve MMseqs status");
        }
        return res.json();
      }),
    // only need to run this query if it didn't complete right away
    enabled: runningOrPending(qSub.data?.status),
    // refetch while qStatus is PENDING or RUNNING
    refetchInterval: (query) =>
      runningOrPending(query.state.data?.status)
        ? MMSEQS_POLLING_INTERVAL
        : false,
    staleTime: Infinity,
  });

  // merge status across the two query objects, slightly more complicated since POST might already
  // return COMPLETE status without needing to run GET query
  const error =
    qSub.isError ||
    qStatus.isError ||
    !validStatus(qSub.data?.status) ||
    !validStatus(qStatus.data?.status);

  // don't check qSub status for running/pending as this value will stay while running GET query
  const running =
    qSub.isFetching ||
    qStatus.isFetching ||
    runningOrPending(qStatus.data?.status);

  const complete =
    qSub.data?.status === "COMPLETE" || qStatus.data?.status === "COMPLETE";

  const id = qSub.isSuccess ? qSub.data.id : null;

  return {
    error: error,
    running: running,
    completed: complete,
    id: id,
  };
};

// borrowed from https://hulk.mmseqs.com/mmirdit/scratch/requestmsa.mjs
const parseTar = async (blob: Blob) => {
  const tar = new TarReader();
  const reader = await tar.readFile(blob);

  let sequences: Sequence[] = [];
  for (let i = 0; i < reader.length; i++) {
    if (reader[i].name.endsWith(".a3m")) {
      const text = await tar.getTextFile(reader[i].name);
      const lines = text.split("\n");
      let curId: string | null = null;

      for (let j = 0; j < lines.length; j++) {
        if (lines[j].startsWith(">")) {
          if (curId !== null) throw new Error("Invalid file format");
          curId = lines[j].substring(1);
        } else {
          // remove all lower-case letters
          const curSeq = lines[j]; // lines[j].replace(/[a-z]/g, "");
          sequences.push({
            seq: curSeq,
            id: curId,
            key: null,
            type: "protein",
          });
          curId = null;
        }
      }
    }
  }

  return new Promise((resolve, _) => {
    resolve(sequences);
  });
};

export const useMmseqsDownload = (id: string | null) => {
  return useQuery({
    queryKey: ["mmseqs_msa", id],
    queryFn: () =>
      fetch(mmseqsBaseUrl() + "result/download/" + id)
        .then((res) => {
          if (!res.ok || !res.body) {
            throw new Error(`MMseqs download failure: ${res.status}`);
          }

          const decompressedStream = res.body.pipeThrough(
            new DecompressionStream("gzip"),
          );

          return new Response(decompressedStream).blob();
        })
        .then(parseTar),
    enabled: id !== null,
  });
};
