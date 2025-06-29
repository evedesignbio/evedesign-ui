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
  filterByInstanceSelection,
} from "./reducers.ts";

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
      curInstance.id = `${row.entity}:${row.ref}${row.pos}${mut.to}`;
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

      // add mutation count and mutation info to instances (for now only fixed length for simplicity;
      // modify in place)

      const instancesEnhanced: SystemInstanceSpecEnhanced[] = [];
      resultsCast.instances.forEach((instRaw, instIdx) => {
        // make a deep copy of instance
        const inst: SystemInstanceSpecEnhanced = JSON.parse(
          JSON.stringify(instRaw),
        );

        inst.id = `${instIdx + 1}`;
        inst.mutant = [];
        inst.seqMap = new Map<string, string>();

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

  const scores = [...posToIdx].map((_symbol) => Array(subsToIdx.size).fill(0));

  if (!isMutationScan) {
    // initialize count array to same length as number of designed positions
    const counts = [...posToIdx].map((_symbol) =>
      Array(subsToIdx.size).fill(0),
    );

    // iterate system instance reps and count symbol occurrences
    instances.forEach((instance) => {
      const rep = instance.entity_instances[entityIndex].rep;

      // only count designed positions
      posToIdx.forEach((posIdx, pos) => {
        const symbol = rep.charAt(decodePosition(pos).pos - firstIndex);
        const symbolIdx = subsToIdx.get(symbol)!;
        counts[posIdx][symbolIdx]++;
        scores[posIdx][symbolIdx] += instance.score;
      });
    });

    // compute relative frequencies
    const instanceCount = instances.length;
    const freqs = counts.map((posCounts) =>
      posCounts.map((symbolCount) => symbolCount / instanceCount),
    );

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
  designedPositions: Position[],
  isMutationScan: boolean,
  spec: PipelineSpec | SingleMutationScanSpec,
) => {
  let instances = isMutationScan
    ? dataSelection.allInstances
    : dataSelection.filteredInstances;

  const instanceSelection = isMutationScan ? null : dataSelection.instances;

  return useMemo(() => {
    // check if design pipeline or mutation scan
    if (!isMutationScan) {
      if (instanceSelection !== null && instanceSelection.size > 1) {
        instances = filterByInstanceSelection(instances, instanceSelection!);
      }

      return instancesToCountMatrix(
        instances,
        designedPositions,
        0,
        spec.system[0].rep,
        spec.system[0].first_index,
        false,
      );
    } else {
      return instancesToCountMatrix(
        instances,
        designedPositions,
        0,
        spec.system[0].rep,
        spec.system[0].first_index,
        true,
      );
    }
  }, [instances, designedPositions, spec, instanceSelection]);
};
