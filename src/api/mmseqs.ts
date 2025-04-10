import { useQuery } from "@tanstack/react-query";
import { convertToQueryUrl } from "./utils.ts";

const MMSEQS_POLLING_INTERVAL = 2000;
const mmseqsBaseUrl = (): string => "https://api.colabfold.com/";

export const useMmseqsSearch = (seq: string | null) => {
  // Step 1: Post query sequence to MMseqs server
  // following https://hulk.mmseqs.com/mmirdit/scratch/requestmsa.mjs and https://hulk.mmseqs.com/mmirdit/scratch/
  const mmseqsSub = useQuery({
    // combination of sequence cut to target region is unique key
    queryKey: ["mmseqs_submit", seq],
    queryFn: () =>
      fetch(mmseqsBaseUrl() + "ticket/msa", {
        // TODO: remove made up error
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
    enabled: seq !== null, // only submit to server if there is a target sequence,
    // retry: (failureCount, error) => {
    //   console.log("SUBMIT ERROR", failureCount, error);
    //   // TODO: retry if status is RATELIMIT or UNKNOWN but how to best detect this here?
    //   // TODO: use res.status to distinguish failure modes?
    //   return false;
    // },
    staleTime: Infinity,
  });

  const mmseqsStatus = useQuery({
    queryKey: ["mmseqs_status", mmseqsSub.data?.id],
    queryFn: () =>
      fetch(mmseqsBaseUrl() + "ticket/" + mmseqsSub.data?.id).then((res) => {
        if (!res.ok) {
          throw new Error("Failed to retrieve MMseqs status");
        }
        return res.json();
      }),
    enabled:
      mmseqsSub.isSuccess &&
      mmseqsSub.data !== undefined &&
      mmseqsSub.data.id !== undefined &&
      mmseqsSub.data.status !== undefined, // &&
    // could avoid to run GET request but complicates code flow, so always run for now
    // mmseqsSubmission.data.status !== "COMPLETE",
    refetchInterval: (query) =>
      // !query.state.data?.status ||
      query.state.data?.status === "PENDING" ||
      query.state.data?.status === "RUNNING"
        ? MMSEQS_POLLING_INTERVAL
        : false,
    staleTime: Infinity,
  });

  // derive status summary for MMseqs
  const mmseqsError =
    mmseqsSub.isError ||
    mmseqsStatus.isError ||
    (mmseqsStatus.isSuccess &&
      mmseqsStatus.data.status !== "PENDING" &&
      mmseqsStatus.data.status !== "RUNNING" &&
      mmseqsStatus.data.status !== "COMPLETE");

  const mmseqsRunning =
    !mmseqsError &&
    (mmseqsSub.isFetching ||
      mmseqsStatus.isFetching ||
      (mmseqsStatus.isSuccess &&
        (mmseqsStatus.data.status === "RUNNING" ||
          mmseqsStatus.data.status === "PENDING")));

  // finished run with ID
  const mmseqsComplete =
    mmseqsStatus.isSuccess && mmseqsStatus.data.status === "COMPLETE";

  const mmseqsId = mmseqsStatus.isSuccess ? mmseqsStatus.data.id : null;

  return {
    error: mmseqsError,
    running: mmseqsRunning,
    complete: mmseqsComplete,
    id: mmseqsId,
  };
};
