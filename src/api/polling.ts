import { useQuery } from "@tanstack/react-query";
import { convertToQueryUrl } from "./utils.ts";

const runningOrPending = (s: string | undefined) =>
  s === "RUNNING" || s === "PENDING";

const validStatus = (s: string | undefined) =>
  s === undefined || s === "RUNNING" || s === "PENDING" || s === "COMPLETE";

const POLLING_INTERVAL = 2000;

export const usePolling = (
  seq: string | null,
  methodKey: string,
  submissionUrl: string,
  statusUrl: string,
  body: any,
) => {
  // Step 1: Post query sequenceviewer to server
  // following https://hulk.mmseqs.com/mmirdit/scratch/requestmsa.mjs and https://hulk.mmseqs.com/mmirdit/scratch/
  const qSub = useQuery({
    queryKey: [methodKey + "_submit", seq],
    queryFn: () =>
      fetch(submissionUrl, {
        method: "POST",
        headers: {
          "User-Agent": "designserver-frontend",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: convertToQueryUrl(body),
      }).then((res) => {
        if (!res.ok) {
          throw new Error(`Submission failure: ${res.status}`);
        }
        return res.json();
      }),
    // only submit to server if there is a target sequenceviewer,
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
    queryKey: [methodKey + "_status", qSub.data?.id],
    queryFn: () =>
      fetch(statusUrl + qSub.data?.id).then((res) => {
        if (!res.ok) {
          throw new Error("Failed to retrieve status");
        }
        return res.json();
      }),
    // only need to run this query if it didn't complete right away
    enabled: runningOrPending(qSub.data?.status),
    // refetch while qStatus is PENDING or RUNNING
    refetchInterval: (query) =>
      runningOrPending(query.state.data?.status) ? POLLING_INTERVAL : false,
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
