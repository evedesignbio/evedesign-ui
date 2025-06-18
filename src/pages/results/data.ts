import { StructureAlignment } from "../../models/structure.ts";
import { GAP } from "../../utils/bio.ts";

/**
 * Rank a list of structure hits from FoldSeek, with highest priority structures at the top.
 * Will also downweight scores for AlphaFold sphaghetti (3Di state "D").
 * @param structureHits All available structures (assumed as unsorted)
 * @param preferExperimentalOverlapFactor Upweight experimental structure score by this factor
 * to prefer it over somewhat longer predicted structures (i.e. the larger, the more preference to
 * give to experimental structures)
 */
export const rankStructureHits = (
  structureHits: StructureAlignment[],
  preferExperimentalOverlapFactor = 2, // TODO: raise again
) => {
  // compute adjusted score, removing contribution of disordered stretches in odentified hits
  const structureHitsAdj = structureHits.map((hit) => {
    // extract 3Di aligned region from full DB 3Di sequence
    const targetRegion = hit.tSeq.substring(hit.dbStartPos - 1, hit.dbEndPos);
    const targetRegionFromAln = hit.dbAln.replace(/-/g, "");
    const targetRegion3Di = hit.t3di.substring(
      hit.dbStartPos - 1,
      hit.dbEndPos,
    );

    if (
      targetRegion !== targetRegionFromAln ||
      targetRegion3Di.length !== targetRegion.length
    ) {
      throw new Error(
        "Structure alignment inconsistency, this should never happen",
      );
    }

    // current positions in query and database sequence; local alignment
    // should not start with gaps in either pos
    let qIdx = hit.qStartPos - 1; // 0-based index in string
    let dbIdx = hit.dbStartPos - 1; // 0-based index in string

    let alignedPairs = 0;
    let goodPairs = 0;

    // iterate through aligned amino acid pairs
    for (let i = 0; i < hit.alnLength; i++) {
      // symbols at current alignment position
      const qSymbol = hit.qAln.charAt(i);
      const dbSymbol = hit.dbAln.charAt(i);

      if (i === 0 && (qSymbol === GAP || dbSymbol === GAP))
        throw new Error("Alignment starts with gap (against code assumptions)");

      // check if pair is aligned
      if (qSymbol !== GAP && dbSymbol !== GAP) {
        // check we are tracking position in db sequence correctly
        if (hit.tSeq.charAt(dbIdx) !== dbSymbol) {
          throw new Error("Sequence mismatch that should never occur");
        }

        // increase aligned pair count, this will be used for normalization
        alignedPairs++;

        const q3Di = hit.q3di.charAt(qIdx);
        const db3Di = hit.t3di.charAt(dbIdx);

        // sliding window matching D or P state - tbd if size 3 or 5?
        const overhang = "DD";
        const db3DiWindow = (overhang + hit.t3di + overhang)
          .substring(dbIdx, dbIdx + 1 + 2 * overhang.length)
          .replace(/P/g, "D");

        // only consider non-D/P state as informative; eventually make this a sliding window approach?
        if (
          !(
            (q3Di === "D" || q3Di === "P") &&
            (db3Di === "D" || db3Di === "P") &&
            db3DiWindow === overhang + "D" + overhang
          )
        )
          goodPairs++;
      }

      // increase index in either sequence if position was not a gap
      if (qSymbol !== GAP) qIdx++;
      if (dbSymbol !== GAP) dbIdx++;
    }

    // console.log("-----");
    // console.log(hit.target);
    // console.log(hit.target, hit.q3di.substring(hit.qStartPos - 1, hit.qEndPos));
    // console.log(hit.target, hit.t3di.substring(hit.dbStartPos - 1, hit.dbEndPos));
    // console.log(hit.target, goodPairs / alignedPairs);

    // rescale score
    const scoreAdj = hit.score * (goodPairs / alignedPairs);

    return { ...hit, scoreAdj: scoreAdj};
  });

  const sortFunc = (a: StructureAlignment, b: StructureAlignment) => {
    // rescale score by preference factor for experimental structures
    const factorA = a.db.toLowerCase().startsWith("pdb")
      ? preferExperimentalOverlapFactor
      : 1;
    const factorB = b.db.toLowerCase().startsWith("pdb")
      ? preferExperimentalOverlapFactor
      : 1;
    const scoreDiff = a.scoreAdj * factorA - b.scoreAdj * factorB;

    // invert sorting order (higher score is better)
    return -scoreDiff;
  };

  // sort in place and return reference to original array
  return structureHitsAdj.sort(sortFunc);
};

/**
 * From list of available structures, return a default selection.
 * @param structureHits All available structures, sorted by preference in descending order
 */
export const selectDefaultStructureHits = (
    structureHits: StructureAlignment[]
) => {
  if (structureHits.length === 0) {
    return [];
  }

  // for now, only return first structure in list
  return [structureHits[0]];
};


