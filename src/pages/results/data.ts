import {
  EntitySpec,
  SingleMutationScanResult,
  SystemInstanceSpec,
} from "../../models/design.ts";
import { useMemo } from "react";
import {
  DesignJobApiResult,
  PipelineApiResult,
  SingleMutationScanApiResult,
} from "../../models/api.ts";

export const singleMutationScanToInstances = (
  system: EntitySpec[],
  systemInstance: SystemInstanceSpec,
  scores: SingleMutationScanResult[],
): SystemInstanceSpec[] => {
  const instances: SystemInstanceSpec[] = [];

  scores.forEach((row: SingleMutationScanResult) => {
    row.subs.forEach((mut) => {
      // skip deletion for now
      if (mut.to === "-") {
        return;
      }

      // skip self substitution, otherwise would include once per position
      if (mut.to === row.ref) {
        return;
      }

      // make deep copy of instance to be safe
      const curInstance: SystemInstanceSpec = JSON.parse(
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
      curInstance.metadata = {
        mutant: `${row.entity}:${row.ref}${row.pos}${mut.to}`,
      };

      // attach to instance list
      instances.push(curInstance);
    });
  });

  return instances;
};

export const useInstances = (results: DesignJobApiResult) =>
  useMemo(() => {
    // gather instances if available
    if (results.spec.key === "pipeline") {
      return (results as PipelineApiResult).instances;
    } else {
      return singleMutationScanToInstances(
        results.spec.system,
        results.spec.system_instance,
        (results as SingleMutationScanApiResult).scores,
      );
    }
  }, [results]);
