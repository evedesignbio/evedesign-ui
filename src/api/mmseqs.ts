import { useQuery } from "@tanstack/react-query";
// @ts-ignore
import TarReader from "./tar.js";
import { Sequence } from "../models/design.ts";
import { usePolling } from "./polling.ts";
import {
  UNCLASSIFIED_TAXONOMY_ID,
  UNCLASSIFIED_TAXONOMY_LINEAGE,
} from "../utils/bio.ts";
import { MsaResult } from "../models/api.ts";

const mmseqsBaseUrl = (): string => import.meta.env.VITE_MMSEQS_BASE_URL;

export const useMmseqsSearch = (seq: string | null) => {
  return usePolling(
    seq,
    "mmseqs",
    mmseqsBaseUrl() + "ticket/msa",
    mmseqsBaseUrl() + "ticket/",
    {
      q: `>1\n${seq}`,
      mode: "env-taxonomy-taxonomyreport",
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
  let taxonomyReport: string | null = null;

  for (let i = 0; i < reader.length; i++) {
    const fileName = reader[i].name;
    if (fileName.endsWith(".a3m")) {
      let curAlignmentSeqs = 0;
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
          curAlignmentSeqs++;
          curId = null;
        }
      }
      // console.log("SEQ COUNT:", fileName, curAlignmentSeqs);
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
    } else if (fileName.endsWith("_taxreport.tsv")) {
      if (taxonomyReport != null) {
        throw new Error("Currently can only load one taxonomy report per MSA");
      }
      taxonomyReport = await tar.getTextFile(fileName);
    }
  }

  // track sequences without taxonomy classification for potential update of taxonomy report
  let unclassifiedSeqs = 0;

  // add taxonomy to sequences (modify in-place)
  sequences.forEach((seq) => {
    if (seq.id !== null) {
      const seqId = seq.id.split(/(\s+)/)[0];
      const seqTax = idToTaxonomy.get(seqId);
      if (!seqTax) unclassifiedSeqs++;

      seq.metadata!.taxonomy_id = seqTax
        ? seqTax.taxonomyId
        : UNCLASSIFIED_TAXONOMY_ID;
      seq.metadata!.taxonomy_lineage = seqTax
        ? seqTax.taxonomyLineage
        : UNCLASSIFIED_TAXONOMY_LINEAGE;
    }
  });

  if (taxonomyReport !== null && unclassifiedSeqs > 0) {
    type Entry = {
			_: string;
			proportion: number;
			cladeReads: number;
			taxonReads: number;
			rank: string; 
			taxId: number;
			name: string;
		};

		const entries: Entry[] = [];

    // Parse taxonomy report
    taxonomyReport
			.trim()
			.split("\n")
			.forEach((line: string) => {
				const cols = line.split("\t", 7);
				if (cols.length < 7) return;

				const [_, proportion, cladeReads, taxonReads, rank, taxId, name] = cols;
				entries.push({
					_,
					proportion: parseFloat(proportion), // percent in [0,100] to be recomputed
					cladeReads: parseInt(cladeReads),
					taxonReads: parseInt(taxonReads),
					rank,
					taxId: parseInt(taxId),
					name,
				});
			});

      // old total is the cladeReads of the root row (first row)
      const oldTotalCladeReads = entries[0].cladeReads;
      const newTotalCladeReads = oldTotalCladeReads + unclassifiedSeqs;

      // Recompute proportions for all existing rows
      for (const e of entries) {
        e.proportion = e.cladeReads / newTotalCladeReads;
      }

      // Prepend a row for unclassified sequences
      const unclassified: Entry = {
        _: entries[0]._,
        proportion: unclassifiedSeqs / newTotalCladeReads,
        cladeReads: unclassifiedSeqs,
        taxonReads: unclassifiedSeqs,
        rank: "no rank",
        taxId: UNCLASSIFIED_TAXONOMY_ID,
        name: "unclassified",
      };

      entries.unshift(unclassified); // Add unclassified row to front

      // Rebuild taxonomyReport string
      taxonomyReport =
        entries
          .map((e) =>
            [
              e._,
              e.proportion.toFixed(4),
              String(e.cladeReads),
              String(e.taxonReads),
              e.rank,
              String(e.taxId),
              e.name,
            ].join("\t")
          )
          .join("\n");
  }

  const msaResult: MsaResult = {
    seqs: sequences,
    taxonomyReport: taxonomyReport,
  };

  return new Promise<MsaResult>((resolve, _) => {
    resolve(msaResult);
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
