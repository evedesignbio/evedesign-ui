// visualization panel that a certain event originated from (other panels react to change)
import {
  Mutation,
  Position,
  SystemInstanceSpecEnhanced,
} from "../../models/design.ts";
import { useCallback, useMemo } from "react";
import { ModifiersKeys } from "molstar/lib/mol-util/input/input-observer";
import { AtomInfo } from "../../components/structureviewer/molstar-utils.tsx";
import {
  decodeMutation,
  decodePosition,
  encodeMutation,
  encodePosition,
  MutationMatrix,
} from "./data.ts";
import { Modifiers } from "../../utils/events.tsx";
import { ClickEvent } from "../../components/autowrapheatmap";

export type EventSource =
  | "STRUCTURE"
  | "MATRIX"
  | "TABLE"
  | "SEQSPACE"
  | "BASKET"
  | "OTHER";

export interface PositionWithSymbolInfo extends Position {
  ref: string;
  availableSubs: string[];
}

export interface DataInteractionReducerAction {
  type:
    | "SELECT_INSTANCES"
    | "SELECT_POSITIONS"
    | "SELECT_MUTATIONS"
    | "SELECT_BASKET"
    | "SET"
    | "RESET";
  source: EventSource;
  // multiSelect: boolean;
  modifiers: Modifiers | null;
  payload:
    | string[]
    | PositionWithSymbolInfo[]
    | Mutation[]
    | DataInteractionReducerState
    | null;
}

// note: positions and mutations are internally encoded as strings
// for by-value lookups in set
export interface DataInteractionReducerState {
  instances: Set<string>;
  positions: Set<string>;
  mutations: Set<string>;
  lastEventSource?: string;
  isMutationScan: boolean;
  allInstances: SystemInstanceSpecEnhanced[];
  filteredInstances: SystemInstanceSpecEnhanced[];
}

export const emptyDataInteractionState = (
  isMutationScan: boolean,
  allInstances: SystemInstanceSpecEnhanced[],
): DataInteractionReducerState => ({
  instances: new Set<string>(),
  positions: new Set<string>(),
  mutations: new Set<string>(),
  lastEventSource: undefined,
  isMutationScan: isMutationScan,
  allInstances: allInstances,
  filteredInstances: allInstances,
});

export type DataInteractionReducerDispatchFunc = (
  action: DataInteractionReducerAction,
) => void;

export const symmetricDifference = (a: Set<any>, b: Set<any>) => {
  const x = new Set([...a]);
  b.forEach((elem) => {
    if (x.has(elem)) {
      x.delete(elem);
    } else {
      x.add(elem);
    }
  });

  return x;
};

export const dataInteractionReducer = (
  state: DataInteractionReducerState,
  action: DataInteractionReducerAction,
): DataInteractionReducerState => {
  const { type, source, payload, modifiers } = action;
  const multiSelect = modifiers ? modifiers.shift || modifiers.meta : false;

  // TODO: could implement returning input state if not changing but
  //  probably not worth the overhead
  switch (type) {
    case "RESET":
      return emptyDataInteractionState(
        state.isMutationScan,
        state.allInstances,
      );
    case "SET":
      return {
        ...(action.payload as DataInteractionReducerState),
      };
    case "SELECT_POSITIONS":
      // transform position selection into mutation selection which is more meaningful
      // and easier to handle
      const payloadPositionSet = action.payload as PositionWithSymbolInfo[];
      const newMuts: Mutation[] = [];

      payloadPositionSet.forEach((pos) => {
        pos.availableSubs.forEach((subs) => {
          const alt = modifiers !== null && modifiers.alt;
          if (
            (subs !== pos.ref && !alt) ||
            (subs === pos.ref && alt && !state.isMutationScan)
          ) {
            newMuts.push({
              entity: pos.entity,
              pos: pos.pos,
              ref: pos.ref,
              to: subs,
            });
          }
        });
      });

      // return state as is if no mutants available
      if (newMuts.length === 0) return state;

      // submit to itself as mutation selection action
      return dataInteractionReducer(state, {
        ...action,
        type: state.isMutationScan ? "SELECT_INSTANCES" : "SELECT_MUTATIONS",
        payload: state.isMutationScan ? newMuts.map(encodeMutation) : newMuts,
      });

    case "SELECT_MUTATIONS":
      // apply other selection modality as filter first
      const filteredInstancesM =
        state.instances.size > 1 // only filter multiple instance selection
          ? filterByInstanceSelection(state.filteredInstances, state.instances)
          : state.filteredInstances;

      let newMutations: Set<string>;
      const payloadMutationSet = new Set(
        (payload as Mutation[]).map(encodeMutation),
      );
      if (multiSelect) {
        newMutations = symmetricDifference(state.mutations, payloadMutationSet);
      } else {
        newMutations = payloadMutationSet;
      }
      return {
        instances: new Set<string>(),
        positions: new Set<string>(),
        mutations: newMutations,
        lastEventSource: source,
        isMutationScan: state.isMutationScan,
        allInstances: state.allInstances,
        filteredInstances: filteredInstancesM,
      };
    case "SELECT_INSTANCES":
      // apply other selection modality as filter first
      const filteredInstancesI =
        state.mutations.size > 0
          ? filterByMutationSelection(state.filteredInstances, state.mutations)
          : state.filteredInstances;

      let newInstances: Set<string>;
      const payloadInstanceSet = new Set(action.payload as string[]);
      if (multiSelect) {
        // if adding to selection, add any new instances from payload
        // and remove all others that are already present (symmetric difference,
        // note symmetricDifference method too new at this point)
        newInstances = symmetricDifference(state.instances, payloadInstanceSet);
      } else {
        // otherwise simply set payload instances as new selection
        newInstances = payloadInstanceSet;
      }
      return {
        instances: newInstances,
        positions: new Set<string>(),
        mutations: new Set<string>(),
        lastEventSource: source,
        isMutationScan: state.isMutationScan,
        allInstances: state.allInstances,
        filteredInstances: filteredInstancesI,
      };
    case "SELECT_BASKET":
      return {
        instances: new Set<string>(),
        positions: new Set<string>(),
        mutations: new Set<string>(),
        lastEventSource: source,
        isMutationScan: state.isMutationScan,
        allInstances: state.allInstances,
        filteredInstances: filterByInstanceSelection(
          state.filteredInstances,
          new Set([...(action.payload as string[])]),
        ),
      };
    default:
      throw new Error(
        "Should not reach default case in data selection reducer",
      );
  }
};

export const useReset = (
  dispatchDataSelection: DataInteractionReducerDispatchFunc,
) =>
  useCallback(
    () =>
      dispatchDataSelection({
        type: "RESET",
        source: "OTHER",
        payload: null,
        modifiers: null,
      }),
    [dispatchDataSelection],
  );

// export const filterInstancesByPosSelection = (
//   x: SystemInstanceSpecEnhanced[],
//   encodedPositions: Set<string>,
// ) => {
//   return x.filter((inst) => {
//     // encode mutated positions for current instance
//     const posEncoded = new Set(
//       inst.mutant.map((mut) =>
//         encodePosition({ entity: mut.entity, pos: mut.pos }),
//       ),
//     );
//
//     // check if all selected positions are contained in encoded set => keep instance
//     // (not using intersection method for now due to availability)
//     const overlap = [...encodedPositions].filter((pos) => posEncoded.has(pos));
//     return overlap.length === encodedPositions.size;
//   });
// };

export const filterByPositionSelection = (
  instances: SystemInstanceSpecEnhanced[],
  positions: Set<string>,
) => {
  return instances.filter((inst) => {
    // encode all mutant positions for current instance
    const posEncoded = new Set(
      inst.mutant.map((mut) =>
        encodePosition({ entity: mut.entity, pos: mut.pos }),
      ),
    );

    return [...positions].some((pos) => posEncoded.has(pos));
  });
};

export const filterByInstanceSelection = (
  instances: SystemInstanceSpecEnhanced[],
  selection: Set<string>,
) => {
  return instances.filter((instance) => selection.has(instance.id));
};

export const filterByMutationSelection = (
  instances: SystemInstanceSpecEnhanced[],
  mutations: Set<string>,
) => {
  // group mutations by position (will act as an OR filter per position)
  const posToMuts = new Map<string, Mutation[]>();
  [...mutations].map(decodeMutation).forEach((decodedMut) => {
    const posEncoded = encodePosition({
      entity: decodedMut.entity,
      pos: decodedMut.pos,
    });
    if (!posToMuts.has(posEncoded)) {
      posToMuts.set(posEncoded, [decodedMut]);
    } else {
      posToMuts.get(posEncoded)!.push(decodedMut);
    }
  });

  return instances.filter((instance) => {
    // iterate per position (AND filter)
    return [...posToMuts.entries()].every(([_pos, muts]) => {
      // iterate mutations per position (OR filter)
      const x = muts.some((decodedMut) => {
        const symbol = instance.seqMap?.get(
          encodePosition({ entity: decodedMut.entity, pos: decodedMut.pos }),
        );
        return symbol === decodedMut.to;
      });
      return x;
    });

    // old version applying multiple mutations per position as AND filter
    // return [...mutations].every((encodedMut) => {
    //   const decodedMut = decodeMutation(encodedMut);
    //   return (
    //     instance.seqMap.get(
    //       encodePosition({ entity: decodedMut.entity, pos: decodedMut.pos }),
    //     )! == decodedMut.to
    //   );
    // });
  });
};

export const filterInstanceSet = (
  dataSelection: DataInteractionReducerState,
) => {
  let instances = dataSelection.filteredInstances;

  if (dataSelection.mutations.size > 0) {
    instances = filterByMutationSelection(instances, dataSelection.mutations);
  }
  if (dataSelection.positions.size > 0) {
    instances = filterByPositionSelection(instances, dataSelection.positions);
  }
  if (dataSelection.instances.size > 0) {
    instances = filterByInstanceSelection(instances, dataSelection.instances);
  }

  return instances;
};

export const useActiveInstances = (
  dataSelection: DataInteractionReducerState,
) =>
  useMemo(() => {
    const activeInstances = filterInstanceSet(dataSelection);
    return {
      activeInstances: activeInstances,
      activeIds: new Set(activeInstances.map((instance) => instance.id)),
    };
  }, [
    dataSelection.filteredInstances,
    dataSelection.mutations,
    dataSelection.positions,
    dataSelection.instances,
  ]);

export const useStructureClickHandler = (
  matrix: MutationMatrix,
  dispatchDataSelection: DataInteractionReducerDispatchFunc,
) =>
  useCallback(
    (
      pos: number | null,
      modifiers: ModifiersKeys,
      _button: number,
      _buttons: number,
      _ai: AtomInfo[],
    ) => {
      if (pos !== null) {
        dispatchDataSelection({
          type: "SELECT_POSITIONS",
          source: "STRUCTURE",
          modifiers: modifiers,
          payload: [{ entity: 0, pos: pos, ref: "X", availableSubs: [] }], // TODO: use actual data
        });
      }
    },
    [dispatchDataSelection, matrix],
  );

export const useHeatmapClickHandler = (
  matrix: MutationMatrix,
  dispatchDataSelection: DataInteractionReducerDispatchFunc,
  isMutationScan: boolean,
) =>
  useMemo(
    () =>
      ({ locationType, payload, modifiers }: ClickEvent) => {
        if (locationType === "data") {
          const posMapped = matrix.indexToPositions.get(payload.column)!;
          const symbolMapped = matrix.indexToSubstitutions.get(payload.row)!;
          const ref = matrix.ref.get(posMapped)!;

          const mutation = {
            ...decodePosition(posMapped),
            ref: ref,
            to: symbolMapped,
          };

          // for mutation scans, each cell corresponds to a single instance which we can directly select;
          // for regular design runs, we select a mutation filter on the active instance set since
          // we don't have a 1:1 correspondence between mutation and instance
          if (isMutationScan) {
            // curInstance.id = `${row.entity}:${row.ref}${row.pos}${mut.to}`;
            dispatchDataSelection({
              type: "SELECT_INSTANCES",
              source: "MATRIX",
              modifiers: modifiers,
              payload: [encodeMutation(mutation)],
            });
          } else {
            // do not allow to click empty cells
            if (payload.value <= 0) return;

            dispatchDataSelection({
              type: "SELECT_MUTATIONS",
              source: "MATRIX",
              modifiers: modifiers,
              payload: [mutation],
            });
          }
        } else if (locationType === "annotation") {
          // TODO: refactor so we can also reuse for structure click handling
          const posMapped = matrix.indexToPositions.get(payload.column)!;
          const ref = matrix.ref.get(posMapped)!;
          const availableSubs = isMutationScan
            ? [...matrix.substitutions.keys()]
            : [...matrix.substitutions.keys()].filter((subs) => {
                const count =
                  matrix.data[matrix.names.get("counts")!][
                    matrix.positions.get(posMapped)!
                  ][matrix.substitutions.get(subs)!];
                return count !== null && count > 0;
              });

          dispatchDataSelection({
            type: "SELECT_POSITIONS",
            source: "MATRIX",
            modifiers: modifiers,
            payload: [
              {
                ...decodePosition(posMapped),
                ref: ref,
                availableSubs: availableSubs,
              },
            ],
          });
        }
      },
    [matrix, dispatchDataSelection, isMutationScan],
  );

export const useBasketInstances = (
  enhancedInstances: SystemInstanceSpecEnhanced[],
  needed: boolean,
  basket: Set<String>,
) =>
  useMemo(() => {
    if (needed) {
      return enhancedInstances.filter((inst) => basket.has(inst.id));
    } else {
      return [];
    }
  }, [basket, needed, enhancedInstances]);

export const mutationsToMutatedPositions = (mutations: Set<string>): string[] =>
  [...mutations].map((mut) => {
    const mutDecod = decodeMutation(mut);
    const posEnc = encodePosition({
      entity: mutDecod.entity,
      pos: mutDecod.pos,
    });
    return posEnc;
  });
