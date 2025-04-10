import { useQuery } from "@tanstack/react-query";
import { convertToQueryUrl } from "./utils.ts";

const foldseek3DiBaseUrl = (): string => "https://3di.foldseek.com/";
const foldseekBaseUrl = (): string => "https://search.foldseek.com/";

export const useFoldseek = (seq: string | null) => {
  // Step 1: predict 3Di states from sequence
  const q3di = useQuery({
    queryKey: ["foldseek_3di", seq],
    queryFn: () =>
      fetch(foldseek3DiBaseUrl() + "predict/" + seq).then((res) => {
        if (!res.ok) {
          throw new Error(`FoldSeek 3Di prediction failure: ${res.status}`);
        }
        return res.json();
      }),
    // only submit to server if there is a target sequence,
    enabled: seq !== null,
    staleTime: Infinity,
  });

  console.log("QUERY", q3di.data); // TODO: remove

  // Step 2: submit FoldSeek search with predicted 3Di sequence
  const qSub = useQuery({
    queryKey: ["foldseek_submit", seq],
    queryFn: () =>
      fetch(foldseekBaseUrl() + "api/ticket", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: convertToQueryUrl({
          q: `>target\n${seq}\n>3DI\n${q3di.data}\n`,
          database: ["pdb100"],  // ["afdb50", "afdb-swissprot", "afdb-proteome"], // TODO
          mode: "3diaa",
        }),
      }).then((res) => {
        if (!res.ok) {
          throw new Error(`FoldSeek 3Di prediction failure: ${res.status}`);
        }
        return res.json();
      }),
    // only submit to server if there is a 3Di prediction already
    enabled: seq !== null && q3di.isSuccess, // && q3di.data,
    staleTime: Infinity,
  });

  console.log("MAIN SUB", qSub.data);

  // Step 3: poll for results
  // r_fs = requests.get("https://search.foldseek.com/api/result/vURjEn8WzYKIE840NS8pVhOSaswfwvvG0-1cNA/0")
  // r_fs.ok
};
