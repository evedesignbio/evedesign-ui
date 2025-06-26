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

export const decodeMutation = (mutStr: string) => {
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
  ref: Map<string, string>; // wildtype symbol
  substitutions: Map<string, number>;
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

export const instancesToMatrix = (
  instances: SystemInstanceSpecEnhanced[],
  entityIndex: number,
  systemRep: string,
  firstIndex: number,
  alphabet = "KRHEDNQTSCGAVLIMPYFW",
  // missingValue: number | null = null,
): MutationMatrix => {
  // map from substitution to index ("column index" of pivot table)
  const subsToIdx = new Map([...alphabet].map((subs, i) => [subs, i]));

  const posToIdx = new Map<string, number>(
    [...systemRep].map((_symbol, posIdx) => [
      encodePosition({
        entity: entityIndex,
        pos: posIdx + firstIndex,
      }),
      posIdx,
    ]),
  );

  const posToRef = new Map<string, string>(
    [...systemRep].map((symbol, posIdx) => [
      encodePosition({
        entity: entityIndex,
        pos: posIdx + firstIndex,
      }),
      symbol,
    ]),
  );

  // initialize data array to same length as system rep
  const counts = [...systemRep].map((_symbol) => Array(subsToIdx.size).fill(0));

  // iterate system instance reps and count symbol occurrences
  instances.forEach((instance) => {
    const rep = instance.entity_instances[entityIndex].rep;
    [...rep].forEach((symbol, posIdx) => {
      const symbolIdx = subsToIdx.get(symbol)!;
      counts[posIdx][symbolIdx]++;
    });
  });

  // compute relative frequencies
  const instanceCount = instances.length;
  const freqs = counts.map((posCounts) =>
    posCounts.map((symbolCount) => symbolCount / instanceCount),
  );

  return {
    positions: posToIdx,
    ref: posToRef,
    substitutions: subsToIdx,
    names: new Map([
      ["counts", 0],
      ["freqs", 1],
    ]),
    data: [counts, freqs],
  };
};

export const useMatrix = (
    enhancedInstances: EnhancedInstanceData,
    spec: PipelineSpec | SingleMutationScanSpec,
) =>
  useMemo(() => {
    if (spec.key === "pipeline") {
      // TODO: check on fixed length?
      return instancesToMatrix(
        enhancedInstances.instances,
        0,
        spec.system[0].rep,
        spec.system[0].first_index,
      );
    } else {
      return null; // TODO: implement
    }
  }, [enhancedInstances, spec]);
