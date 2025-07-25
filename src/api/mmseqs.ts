import { useQuery } from "@tanstack/react-query";
// @ts-ignore
import TarReader from "./tar.js";
import { Sequence } from "../models/design.ts";
import { usePolling } from "./polling.ts";
import {
  UNCLASSIFIED_TAXONOMY_ID,
  UNCLASSIFIED_TAXONOMY_LINEAGE,
} from "../utils/bio.ts";

const mmseqsBaseUrl = (): string => "https://api.colabfold.com/";

export const useMmseqsSearch = (seq: string | null) => {
  return usePolling(
    seq,
    "mmseqs",
    mmseqsBaseUrl() + "ticket/msa",
    mmseqsBaseUrl() + "ticket/",
    {
      q: `>1\n${seq}`,
      mode: "env-taxonomy",
    },
  );
};

interface TaxonomyInfo {
  taxonomyId: number;
  taxonomyLineage: string;
}

// borrowed from https://hulk.mmseqs.com/mmirdit/scratch/requestmsa.mjs
const parseTar = async (blob: Blob) => {
  const tar = new TarReader();
  const reader = await tar.readFile(blob);

  let sequences: Sequence[] = [];
  const idToTaxonomy = new Map<string, TaxonomyInfo>();

  for (let i = 0; i < reader.length; i++) {
    const fileName = reader[i].name;
    if (fileName.endsWith(".a3m")) {
      const text = await tar.getTextFile(fileName);
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
            metadata: {}, // init metadata here so we can easily add taxonomy info below
          });
          curId = null;
        }
      }
    } else if (fileName.endsWith("_tax.tsv")) {
      const text = await tar.getTextFile(fileName);
      text
        .replaceAll("\x00", "")
        .trim()
        .split("\n")
        .forEach((line: string) => {
          const [taxId, seqId, taxLineage] = line.split("\t", 3);
          idToTaxonomy.set(seqId, {
            taxonomyId: parseInt(taxId),
            taxonomyLineage: taxLineage,
          });
        });
    }
  }

  // add taxonomy to sequences (modify in-place)
  sequences.forEach((seq) => {
    if (seq.id !== null) {
      const seqId = seq.id.split(/(\s+)/)[0];
      const seqTax = idToTaxonomy.get(seqId);
      seq.metadata!.taxonomy_id = seqTax
        ? seqTax.taxonomyId
        : UNCLASSIFIED_TAXONOMY_ID;
      seq.metadata!.taxonomy_lineage = seqTax
        ? seqTax.taxonomyLineage
        : UNCLASSIFIED_TAXONOMY_LINEAGE;
    }
  });

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
    staleTime: Infinity,
  });
};
