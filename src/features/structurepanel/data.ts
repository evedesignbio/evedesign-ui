import { StructureAlignment } from "../../models/structure.ts";
import { FOLDSEEK_THREE_TO_ONE, GAP } from "../../utils/bio.ts";
import {
  AtomInfo,
  extractSecondaryStructure,
  SiteHighlight,
  StructureHandle,
} from "../../components/structureviewer/molstar-utils.tsx";
import {
  SelectedStructureHit,
  SelectedStructureMap,
  StructurePosition,
} from "./reducers.ts";
import { ColorCallback } from "../../components/structureviewer/molstar-color.tsx";
import { Color } from "molstar/lib/mol-util/color";
import { PositionColorCallback } from "../../utils/colormap.ts";

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
): StructureAlignment[] => {
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

    return { ...hit, scoreAdj: scoreAdj };
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
  structureHits: StructureAlignment[],
) => {
  if (structureHits.length === 0) {
    return [];
  }

  // for now, only return first structure in list
  return [structureHits[0]];
};

interface ChainPos {
  labelSeqId: number;
  labelCompId: string;
}

/**
 * Encode chain/seqres pair as unique string of form chain:pos (e.g. A:123)
 * @param chain PDB chain identifier
 * @param seqresIndex PDB residue seqres index (*not* author ID)
 * @returns Uniquely encoded chain-position pair
 */
export const encodeStructurePosSeqres = (
  chain: string,
  seqresIndex: number,
) => {
  return `${chain}:${seqresIndex}`;
};

/**
 * From loaded structures and query to structure alignments, infer position mappings
 * (as with FoldSeek we don't have a direct mapping to seqres indices as we did for popEVE)
 * @param structures
 * @param structureSelection
 * @param firstIndex
 */
export const extractMappings = (
  structures: StructureHandle[],
  structureSelection: Map<string, SelectedStructureHit>,
  firstIndex: number,
) => {
  const updatedStructureSelection = new Map<string, SelectedStructureHit>();

  // iterate loaded structures
  structures.forEach((s) => {
    // initialize mappings
    const mapSeqToStruct = new Map<number, StructurePosition[]>();
    const mapStructToSeq = new Map<string, number>();

    // badly named function extracts all needed info, not just secondary structure
    const residues = extractSecondaryStructure(s.structure.obj);

    // group residues by chain ID
    const chainMap = new Map<string, ChainPos[]>();

    // also track models, only record one per chain
    const chainModelMap = new Map<string, number>();

    residues.forEach((r) => {
      // disabled the following check as it can be overly restrictive, e.g. for CSX in 2hzp;
      // instead check if the residue name is mapping dictionary
      // if (!r.isResidue) {
      //   return;
      // }
      if (!FOLDSEEK_THREE_TO_ONE.has(r.labelCompId)) {
        return;
      }

      // skip residues without CA atom, these won't be present in FoldSeek output
      if (r.otherAtomsInResidue && !r.otherAtomsInResidue.includes("CA")) {
        return;
      }

      if (!chainModelMap.has(r.labelAsymId)) {
        chainModelMap.set(r.labelAsymId, r.modelId);
      }

      // do not accumulate residues if they belong to a model other than the first model
      if (chainModelMap.get(r.labelAsymId)! != r.modelId) return;

      if (!chainMap.has(r.labelAsymId)) {
        chainMap.set(r.labelAsymId, []);
      }

      chainMap
        .get(r.labelAsymId)!
        .push({ labelSeqId: r.labelSeqId, labelCompId: r.labelCompId });
    });

    // create mapping from one-letter code AA sequence to chain IDs,
    // this will be used for sequence-based lookup to find all chains matching the FoldSeek hit
    // (this avoids any ambiguity whether authAsymId or labelAsymId is used, which can be tricky for assemblies);

    // note we have to use Gemmi-specific mapping used in FoldSeek to produce identical one-letter sequences
    const seqToChainId = new Map<string, string[]>();
    chainMap.forEach((value, key) => {
      const seqMerged = value
        .map((pos) => FOLDSEEK_THREE_TO_ONE.get(pos.labelCompId) || "X")
        .join("");

      if (!seqToChainId.has(seqMerged)) {
        seqToChainId.set(seqMerged, [key]);
      } else {
        seqToChainId.get(seqMerged)!.push(key);
      }
    });

    // get corresponding FoldSeek mapping
    if (!structureSelection.has(s.id))
      throw new Error("Structure mapping is missing, should never happen");

    const curStructureSelection = structureSelection.get(s.id)!;
    const hit = curStructureSelection.targetToStructure;

    // find relevant chain IDs by sequence-based lookup
    const chains = seqToChainId.get(hit!.tSeq);
    // in case no chain found (could happen due to PDB handling/version inconsistencies) avoid mapping creation
    if (!chains) return;

    // build up mappping one chain at a time
    for (const chain of chains) {
      const chainPos = chainMap.get(chain)!;

      // current positions in query and database sequence; local alignment
      // should not start with gaps in either pos

      // 1-based index in target sequence, note that qStartPos does not incorporate first index shifts
      let qIdxSeq = firstIndex + hit.qStartPos - 1;
      let dbIdx = hit.dbStartPos - 1; // 0-based index in string

      // iterate through pairwise alignment
      for (let i = 0; i < hit.alnLength; i++) {
        // symbols at current alignment position
        const qSymbol = hit.qAln.charAt(i);
        const dbSymbol = hit.dbAln.charAt(i);

        // establish residue mapping if two residues are aligned (no gap in either sequence)
        if (qSymbol !== GAP && dbSymbol !== GAP) {
          // check we are tracking position in db sequence correctly
          if (hit.tSeq.charAt(dbIdx) !== dbSymbol) {
            throw new Error("Sequence mismatch that should never occur");
          }

          const curPos = chainPos[dbIdx];
          // structure chain/pos to seq is 1:1 relationship
          mapStructToSeq.set(
            encodeStructurePosSeqres(chain, curPos.labelSeqId),
            qIdxSeq,
          );

          // seq to structure chain/pos is 1:n relationship
          const newPosObj: StructurePosition = {
            labelAsymId: chain,
            labelSeqId: curPos.labelSeqId,
          };
          if (!mapSeqToStruct.has(qIdxSeq)) {
            mapSeqToStruct.set(qIdxSeq, [newPosObj]);
          } else {
            mapSeqToStruct.get(qIdxSeq)!.push(newPosObj);
          }
        }

        // increase index in either sequence if position was not a gap
        if (qSymbol !== GAP) qIdxSeq++;
        if (dbSymbol !== GAP) dbIdx++;
      }
    }

    // store into updated mapping
    updatedStructureSelection.set(s.id, {
      ...curStructureSelection,
      mapSeqToStruct: mapSeqToStruct,
      mapStructToSeq: mapStructToSeq,
    });
  });

  return updatedStructureSelection;
};

export const makeMolstarColorCallback = (
  structureSelection?: SelectedStructureMap,
  colorCallback?: PositionColorCallback,
): ColorCallback | undefined => {
  if (!structureSelection || !colorCallback) {
    return undefined;
  }

  return (atomInfo: AtomInfo[]) => {
    const info = atomInfo[0];
    // default to unmappable position
    let pos: number | null = null;

    // try to map position
    const strucMap = structureSelection.get(info.inputStructureId!);
    if (strucMap) {
      const targetPos = strucMap.mapStructToSeq!.get(
        encodeStructurePosSeqres(info.labelAsymId, info.labelSeqId),
      );

      if (targetPos) {
        pos = targetPos;
      }
    }

    // push position (null or number) through mapping function
    return Color.fromHexStyle(colorCallback(pos));
  };
};

// site highlight in target position numbering, before mapping to structures
export interface SiteHighlightTargetPos {
  pos: number;
  representationId: string;
  props: any;
}

export const mapSiteHighlights = (
  siteHighlightsTargetPos?: SiteHighlightTargetPos[],
  structureSelection?: SelectedStructureMap,
): SiteHighlight[] => {
  if (!structureSelection || !siteHighlightsTargetPos) {
    return [];
  }

  const highlightsMapped: SiteHighlight[] = [];

  siteHighlightsTargetPos.forEach((highlight: SiteHighlightTargetPos) => {
    structureSelection.forEach((s, id) => {
      const posMapped = s.mapSeqToStruct!.get(highlight.pos);
      if (!posMapped) {
        return;
      }
      posMapped.forEach((pm) =>
        highlightsMapped.push({
          // position mapped into a particular structure
          inputStructureId: id,
          labelAsymId: pm.labelAsymId,
          labelResidueIds: [pm.labelSeqId],
          // forward other props as-is
          representationId: highlight.representationId,
          props: highlight.props,
        }),
      );
    });
  });

  return highlightsMapped;
};
