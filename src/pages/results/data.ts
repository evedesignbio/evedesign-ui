import {
  Position,
  EntitySpec,
  SingleMutationScanResult,
  SystemInstanceSpec,
  SystemInstanceSpecEnhanced,
  Mutation,
  PipelineSpec,
  SingleMutationScanSpec,
} from "../../models/design.ts";
import { useMemo } from "react";
import {
  DesignJobApiResult,
  PipelineApiResult,
  SingleMutationScanApiResult,
} from "../../models/api.ts";
import { range } from "../../utils/helpers.ts";
import {
  DataInteractionReducerState,
  mutationsToMutatedPositions,
} from "./reducers.ts";

export type AggregationFunc = "sum" | "avg" | "min" | "max" | "entropy";

export const encodePosition = (pos: Position) => {
  return `${pos.entity}_${pos.pos}`;
};

export const decodePosition = (posStr: string) => {
  const posSplit = posStr.split("_");
  return {
    entity: parseInt(posSplit[0]),
    pos: parseInt(posSplit[1]),
  };
};

export const encodeMutation = (mutation: Mutation) => {
  return `${mutation.entity}_${mutation.pos}_${mutation.ref}_${mutation.to}`;
};

export const decodeMutation = (mutStr: string): Mutation => {
  const mutSplit = mutStr.split("_");
  return {
    entity: parseInt(mutSplit[0]),
    pos: parseInt(mutSplit[1]),
    ref: mutSplit[2],
    to: mutSplit[3],
  };
};

type NullableArray3D = (number | null)[][][];

export type MutationMatrix = {
  positions: Map<string, number>;
  indexToPositions: Map<number, string>;
  ref: Map<string, string>; // wildtype symbol
  substitutions: Map<string, number>;
  indexToSubstitutions: Map<number, string>;
  // equivalent to column headers in input file
  names: Map<string, number>;
  data: NullableArray3D;
};

export const singleMutationScanToInstances = (
  system: EntitySpec[],
  systemInstance: SystemInstanceSpec,
  scores: SingleMutationScanResult[],
  skipSelfSubstitution: boolean = true,
): SystemInstanceSpecEnhanced[] => {
  const instances: SystemInstanceSpecEnhanced[] = [];

  scores.forEach((row: SingleMutationScanResult) => {
    row.subs.forEach((mut) => {
      // skip deletion for now
      if (mut.to === "-") {
        return;
      }

      // skip self substitution, otherwise would include once per position
      if (mut.to === row.ref && skipSelfSubstitution) {
        return;
      }

      // make deep copy of instance to be safe
      const curInstance: SystemInstanceSpecEnhanced = JSON.parse(
        JSON.stringify(systemInstance),
      );

      // mutate instance, add mutant as metadata
      const rep = curInstance.entity_instances[row.entity].rep;
      const mutIndex = row.pos - system[row.entity].first_index;

      if (rep.charAt(mutIndex) !== row.ref) {
        throw new Error(
          "Invalid reference character, this should never happen",
        );
      }

      curInstance.entity_instances[row.entity].rep =
        rep.substring(0, mutIndex) + mut.to + rep.substring(mutIndex + 1);

      curInstance.score = mut.score;
      curInstance.id = encodeMutation({
        entity: row.entity,
        pos: row.pos,
        ref: row.ref,
        to: mut.to,
      });
      curInstance.mutant =
        row.ref != mut.to
          ? [{ entity: row.entity, pos: row.pos, ref: row.ref, to: mut.to }]
          : [];

      // attach to instance list
      instances.push(curInstance);
    });
  });

  return instances;
};

export interface EnhancedInstanceData {
  instances: SystemInstanceSpecEnhanced[];
  fixedLength: boolean;
  designedPositions: Position[];
}

const uniqueInstanceRepString = (inst: SystemInstanceSpec): string => {
  return inst.entity_instances.map((ei) => ei.rep).join(":");
};

interface InstanceProperties {
  index: number;
  score: number | null;
}

export const useInstances = (
  results: DesignJobApiResult,
): EnhancedInstanceData =>
  // TODO: would it be beneficial to deduplicate designs / annotate this information?
  useMemo(() => {
    // gather instances if available
    if (results.spec.key === "pipeline") {
      const resultsCast = results as PipelineApiResult;
      const fixedLength = resultsCast.instances.every((inst) =>
        inst.entity_instances.every(
          (ei, j) => ei.rep.length === results.spec.system[j].rep.length,
        ),
      );

      // identify occurrences of unique instances (in case solution found multiple times while sampling)
      const uniqueInstanceMap = new Map<string, InstanceProperties[]>();
      resultsCast.instances.forEach((instRaw, instIdx) => {
        const key = uniqueInstanceRepString(instRaw);
        if (!uniqueInstanceMap.has(key)) {
          uniqueInstanceMap.set(key, []);
        }
        uniqueInstanceMap
          .get(key)!
          .push({ index: instIdx, score: instRaw.score });
      });

      // sort counts per unique instance (descending order, best score first)
      uniqueInstanceMap.forEach((countList) =>
        countList.sort((a, b) =>
          a.score !== null && b.score !== null ? b.score - a.score : 0,
        ),
      );

      // add mutation count and mutation info to instances (for now only fixed length for simplicity;
      // modify in place)

      const instancesEnhanced: SystemInstanceSpecEnhanced[] = [];
      let instIdCount = 1; // manually track instance IDs since we might skip some entries
      resultsCast.instances.forEach((instRaw, instIdx) => {
        // make a deep copy of instance
        const inst: SystemInstanceSpecEnhanced = JSON.parse(
          JSON.stringify(instRaw),
        );

        // retrieve occurrence count/scores, only keep instance if it is the best-scoring if multiple copies exist
        const occs = uniqueInstanceMap.get(uniqueInstanceRepString(instRaw))!;

        // skip instance if it is not the highest scoring one (first in occurrence list)
        if (instIdx !== occs[0].index) {
          return;
        }

        inst.id = `${instIdCount}`;
        inst.mutant = [];
        inst.seqMap = new Map<string, string>();
        inst.count = occs.length;

        if (fixedLength) {
          inst.entity_instances.forEach((ei, eiIdx) => {
            [...ei.rep].forEach((symbol, repIdx) => {
              const ref = resultsCast.spec.system[eiIdx].rep[repIdx];
              const curPos =
                repIdx + resultsCast.spec.system[eiIdx].first_index;
              inst.seqMap!.set(
                encodePosition({ entity: eiIdx, pos: curPos }),
                symbol,
              );
              if (symbol !== ref) {
                const curMutation = {
                  entity: eiIdx,
                  pos: curPos,
                  ref: ref,
                  to: symbol,
                };
                inst.mutant.push(curMutation);
              }
            });
          });
        }
        instancesEnhanced.push(inst);
        instIdCount++;
      });

      return {
        instances: instancesEnhanced,
        fixedLength: fixedLength,
        designedPositions: resultsCast.spec.system
          .map((ent, entIdx) =>
            range(ent.first_index, ent.first_index + ent.rep.length - 1, 1)
              .filter(
                (pos) =>
                  !(
                    resultsCast.spec.steps[0].args.fixed_pos
                      ? (resultsCast.spec.steps[0].args.fixed_pos[
                          `${entIdx}`
                        ] as number[])
                      : []
                  ).includes(pos),
              )
              .map((pos) => ({
                entity: entIdx,
                pos: pos,
              })),
          )
          .flat(),
      };
    } else {
      const resultsCast = results as SingleMutationScanApiResult;
      const instances = singleMutationScanToInstances(
        results.spec.system,
        results.spec.system_instance,
        resultsCast.scores,
        true,
      );

      return {
        instances: instances,
        fixedLength: true,
        designedPositions: resultsCast.scores.map((r) => ({
          entity: r.entity,
          pos: r.pos,
        })),
      };
    }
  }, [results]);

export const instancesToCountMatrix = (
  instances: SystemInstanceSpecEnhanced[],
  altInstances: Map<string, SystemInstanceSpecEnhanced[]> | null, // alternative instance set for fixed positions
  designedPositions: Position[],
  entityIndex: number,
  systemRep: string,
  firstIndex: number,
  isMutationScan: boolean,
  alphabet = "KRHEDNQTSCGAVLIMPYFW",
  // missingValue: number | null = null,
): MutationMatrix => {
  // map from substitution to index ("column index" of pivot table)
  const subsToIdx = new Map([...alphabet].map((subs, i) => [subs, i]));

  const idxToSubs = new Map([...subsToIdx].map((e) => [e[1], e[0]]));

  // only map designed positions
  const posToIdx = new Map<string, number>(
    designedPositions
      .filter((pos) => pos.entity === entityIndex)
      .map((pos, posIdx) => [encodePosition(pos), posIdx]),
  );

  const idxToPos = new Map([...posToIdx].map((e) => [e[1], e[0]]));

  // only map designed positions
  const posToRef = new Map<string, string>(
    designedPositions
      .filter((pos) => pos.entity === entityIndex)
      .map((pos) => [
        encodePosition(pos),
        systemRep.charAt(pos.pos - firstIndex),
      ]),
  );

  const scores = [...posToIdx].map((_symbol) =>
    Array(subsToIdx.size).fill(null),
  );

  if (!isMutationScan) {
    // initialize count array to same length as number of designed positions
    const counts = [...posToIdx].map((_symbol) =>
      Array(subsToIdx.size).fill(0),
    );

    // only count designed positions; positions on outer loop rather than instances to allow
    // varying the instances on inside of loop
    posToIdx.forEach((posIdx, pos) => {
      // use alternative instance set if position is contained in map of such positions to instance list
      const curInstances =
        altInstances !== null && altInstances.has(pos)
          ? altInstances.get(pos)!
          : instances;

      // iterate system instance reps and count symbol occurrences
      curInstances.forEach((instance) => {
        const rep = instance.entity_instances[entityIndex].rep;

        const symbol = rep.charAt(decodePosition(pos).pos - firstIndex);
        const symbolIdx = subsToIdx.get(symbol)!;
        counts[posIdx][symbolIdx]++;
        scores[posIdx][symbolIdx] += instance.score;
      });
    });

    // compute relative frequencies (total number of instances can depend on position so need to sum
    const freqs = counts.map((posCounts) => {
      const posSum = posCounts.reduce((a, b) => a + b, 0);
      return posCounts.map((symbolCount) => symbolCount / posSum);
    });

    // normalize scores by number of designs for each symbol occurrence
    const scoresNorm = scores.map((posCounts, posIdx) =>
      posCounts.map((symbolCount, symbolIdx) =>
        counts[posIdx][symbolIdx] !== null
          ? symbolCount / counts[posIdx][symbolIdx]
          : null,
      ),
    );

    return {
      positions: posToIdx,
      indexToPositions: idxToPos,
      ref: posToRef,
      substitutions: subsToIdx,
      indexToSubstitutions: idxToSubs,
      names: new Map([
        ["counts", 0],
        ["freqs", 1],
        ["scores", 2],
      ]),
      data: [counts, freqs, scoresNorm],
    };
  } else {
    instances
      .filter(
        (instance) =>
          instance.mutant.length > 0 &&
          instance.mutant[0].entity === entityIndex,
      )
      .forEach((instance) => {
        const mut = instance.mutant[0];
        const posIdx = posToIdx.get(
          encodePosition({ entity: mut.entity, pos: mut.pos }),
        )!;
        const symbolIdx = subsToIdx.get(mut.to)!;
        scores[posIdx][symbolIdx] = instance.score;
      });

    return {
      positions: posToIdx,
      indexToPositions: idxToPos,
      ref: posToRef,
      substitutions: subsToIdx,
      indexToSubstitutions: idxToSubs,
      names: new Map([["scores", 0]]),
      data: [scores],
    };
  }
};

export const useMatrix = (
  dataSelection: DataInteractionReducerState,
  activeInstances: SystemInstanceSpecEnhanced[],
  designedPositions: Position[],
  isMutationScan: boolean,
  spec: PipelineSpec | SingleMutationScanSpec,
) => {
  // let instances = isMutationScan
  //   ? dataSelection.allInstances
  //   : dataSelection.filteredInstances;
  let instances = dataSelection.filteredInstances;

  const activeInstancesCond = isMutationScan ? null : activeInstances;

  return useMemo(() => {
    // check if design pipeline or mutation scan
    if (!isMutationScan) {
      let altInstances: Map<string, SystemInstanceSpecEnhanced[]> | null = null;
      if (dataSelection.mutations.size > 0) {
        altInstances = new Map<string, SystemInstanceSpecEnhanced[]>();
        mutationsToMutatedPositions(dataSelection.mutations)
          .slice(-1) // only use last selected position for now for source distribution
          .forEach((posEnc) => altInstances!.set(posEnc, instances));
      }

      return instancesToCountMatrix(
        // do not use activeInstancesCond if single instance selected
        activeInstancesCond!.length > 1 || dataSelection.instances.size === 0
          ? activeInstancesCond!
          : instances,
        altInstances,
        designedPositions,
        0,
        spec.system[0].rep,
        spec.system[0].first_index,
        false,
      );
    } else {
      return instancesToCountMatrix(
        instances,
        null,
        designedPositions,
        0,
        spec.system[0].rep,
        spec.system[0].first_index,
        true,
      );
    }
  }, [instances, designedPositions, spec, activeInstancesCond]);
};

/**
 * Select data point corresponding to given percentile from mutation effect matrix
 * @param mutations Mutation effect prediction matrices
 * @param mutationPredictionType Selected prediction type
 * @param percentile Percentile to determine for given selected prediction type
 * @returns Data point corresponding to percentile
 */
export const effectPercentile = (
  mutations: MutationMatrix,
  mutationPredictionType: string,
  percentile: number,
): number => {
  // extract relevant prediction matrix into flattened array without null elements (e.g. WT substitutions)
  const matFlat = mutations.data[
    mutations.names.get(mutationPredictionType)!
  ]!.flat()
    .filter((e) => e !== null)
    .sort((a, b) => a! - b!);

  // compute index of element corresponding to requested percentile
  const elemIndex = Math.round(percentile * (matFlat.length - 1));
  return matFlat[elemIndex]!;
};

/**
 * Compute position-wise aggregation of mutation matrix for a selected submatrix
 * @param mutations Mutation matrix to aggregate
 * @param mutationPredictionType Submatrix to select
 * @param aggFunc Aggregation function to apply on a position-wise basis
 */
export const aggregateMutationMatrix = (
  mutations: MutationMatrix,
  mutationPredictionType: string,
  aggFunc: AggregationFunc,
) => {
  const matFilt = mutations.data[
    mutations.names.get(mutationPredictionType)!
  ]!.map((posVector) => posVector.filter((e) => e !== null));

  // console.log("##### MATRIX FILT", matFilt);

  // select aggregation function to apply to matrix
  let aggMat: (number | null)[];
  switch (aggFunc) {
    case "avg":
      aggMat = matFilt.map((posVec) =>
        posVec.length === 0
          ? null
          : posVec.reduce((sum, x) => sum! + x!)! / posVec.length,
      );
      break;
    case "min":
      aggMat = matFilt.map((posVec) =>
        posVec.length === 0 ? null : Math.min(...(posVec as number[])),
      );
      break;
    case "max":
      aggMat = matFilt.map((posVec) =>
        posVec.length === 0 ? null : Math.max(...(posVec as number[])),
      );
      break;
    default:
      throw new Error("Invalid aggregation function selected");
  }

  return aggMat;
};

/**
 * Get minimum and maximum value in data matrix
 * @param mutations Full mutation matrix
 * @param verifiedMutationPredictionType Currently selected prediction score
 * @returns Object with min/max
 */
export const getDataRange = (
  mutations: MutationMatrix,
  verifiedMutationPredictionType: string,
) => {
  const minValue = effectPercentile(
    mutations,
    verifiedMutationPredictionType,
    0,
  );

  const maxValue = effectPercentile(
    mutations,
    verifiedMutationPredictionType,
    1,
  );

  return { minValue: minValue, maxValue };
};
