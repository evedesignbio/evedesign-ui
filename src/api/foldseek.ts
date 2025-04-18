import { useQuery } from "@tanstack/react-query";
import { usePolling } from "./polling.ts";

const foldseek3DiBaseUrl = (): string => "https://3di.foldseek.com/";
const foldseekBaseUrl = (): string => "https://search.foldseek.com/";

export const useFoldseekSearch = (seq: string | null) => {
  // Step 1: predict 3Di states from sequenceviewer
  const q3di = useQuery({
    queryKey: ["foldseek_3di", seq],
    queryFn: () =>
      fetch(foldseek3DiBaseUrl() + "predict/" + seq).then((res) => {
        if (!res.ok) {
          throw new Error(`FoldSeek 3Di prediction failure: ${res.status}`);
        }
        return res.json();
      }),
    // only submit to server if there is a target sequenceviewer,
    enabled: seq !== null,
    staleTime: Infinity,
  });

  const search = usePolling(
    q3di.isSuccess ? seq : null, // only pass sequenceviewer to start query once we have 3Di predictions
    "foldseek",
    foldseekBaseUrl() + "api/ticket",
    foldseekBaseUrl() + "api/ticket/",
    {
      q: `>target\n${seq}\n>3DI\n${q3di.data}\n`,
      database: ["pdb100"], // ["afdb50", "afdb-swissprot", "afdb-proteome"], // TODO
      mode: "3diaa",
    },
  );

  // merge status across 3Di and main FoldSeek queries
  return {
    error: q3di.isError || search.error,
    running: q3di.isFetching || search.running,
    completed: search.completed,
    id: search.id,
  };
};

export const useFoldseekResult = (id: string | null) => {
  return useQuery({
    queryKey: ["foldseek_result", id],
    queryFn: () =>
      fetch(foldseekBaseUrl() + "api/result/" + id + "/0").then((res) => {
        if (!res.ok || !res.body) {
          throw new Error(`MMseqs download failure: ${res.status}`);
        }

        return res.json();
      }),
    enabled: id !== null,
    staleTime: Infinity,
  });
};
