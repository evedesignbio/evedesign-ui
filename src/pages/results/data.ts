import {
  Position,
  EntitySpec,
  SingleMutationScanResult,
  SystemInstanceSpec,
  SystemInstanceSpecEnhanced,
  Mutation,
} from "../../models/design.ts";
import { useMemo } from "react";
import {
  DesignJobApiResult,
  PipelineApiResult,
  SingleMutationScanApiResult,
} from "../../models/api.ts";
import { range } from "../../utils/helpers.ts";

export const encodePosition = (pos: Position) => {
  return `${pos.entity}_${pos.pos}`;
};

export const decodePosition = (posStr: string) => {
  const posSplit = posStr.split("_");
  return {
    entity: parseInt(posSplit[0]),
    pos: parseInt(posSplit[1]),
  }
}

export const encodeMutation = (mutation: Mutation) => {
  return `${mutation.entity}_${mutation.pos}_${mutation.ref}_${mutation.to}`;
};

export const decodeMutation = (mutStr: string) => {
  const mutSplit = mutStr.split("_");
  return {
    entity: parseInt(mutSplit[0]),
    pos: parseInt(mutSplit[1]),
    ref: mutSplit[2],
    to: mutSplit[3],
  }
}


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

// const singleMutationScanToMatrix = () => {
// const subsOrdered = resultsCast.scores[0].subs
//     .filter((s) => s.to !== "-")
//     .map((s) => s.to);
//
// console.log(subsOrdered);
// export const parseMutationCsv = (
//     csvContent: string,
//     sep = ",",
//     mutantColName = "mutant",
//     alphabet = "KRHEDNQTSCGAVLIMPYFW",
//     missingValue: number | null = null
// ): MutationMatrix => {
//   // map from substitution to index ("column index" of pivot table)
//   const subsToIdx = new Map([...alphabet].map((subs, i) => [subs, i]));
//
//   // map from position to index ("row index"), will be constructed from positions in data
//   const posToIdx = new Map<number, number>();
//   const posToWildtype = new Map<number, string>();
//
//   // map from data column name to index (and back)
//   const headerToIdx = new Map<string, number>();
//   const idxToHeader = new Map<number, string>();
//
//   // 3D data array: i) different predictions (CSV columns), ii) positions, iii) substitutions
//   const data: NullableArray3D = [];
//   let nextPos = 0;
// };

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

        if (fixedLength) {
          inst.entity_instances.forEach((ei, eiIdx) => {
            [...ei.rep].forEach((symbol, repIdx) => {
              const ref = resultsCast.spec.system[eiIdx].rep[repIdx];
              if (symbol !== ref) {
                inst.mutant.push({
                  entity: eiIdx,
                  pos: repIdx + resultsCast.spec.system[eiIdx].first_index,
                  ref: ref,
                  to: symbol,
                });
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
