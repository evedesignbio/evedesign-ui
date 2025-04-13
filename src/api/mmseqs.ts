import { useQuery } from "@tanstack/react-query";
// @ts-ignore
import TarReader from "./tar.js";
import { Sequence } from "../models/design.ts";
import { usePolling } from "./polling.ts";

const mmseqsBaseUrl = (): string => "https://api.colabfold.com/";

export const useMmseqsSearch = (seq: string | null) => {
  return usePolling(
    seq,
    "mmseqs",
    mmseqsBaseUrl() + "ticket/msa",
    mmseqsBaseUrl() + "ticket/",
    {
      q: `>1\n${seq}`,
      mode: "env",
    },
  );
};

// borrowed from https://hulk.mmseqs.com/mmirdit/scratch/requestmsa.mjs
const parseTar = async (blob: Blob) => {
  const tar = new TarReader();
  const reader = await tar.readFile(blob);

  let sequences: Sequence[] = [];
  for (let i = 0; i < reader.length; i++) {
    if (reader[i].name.endsWith(".a3m")) {
      const text = await tar.getTextFile(reader[i].name);
      // end of file appears to always have null terminator which we must remove
      const lines = text.replaceAll("\x00", "").trim().split("\n");
      let curId: string | null = null;

      for (let j = 0; j < lines.length; j++) {
        // just in case there are empty lines we skip them
        if (lines[j].trim() === "") {
          continue;
        }

        if (lines[j].startsWith(">")) {
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

  return new Promise<Sequence[]>((resolve, _) => {
    resolve(sequences);
  });
};

export const useMmseqsMsa = (id: string | null) => {
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
