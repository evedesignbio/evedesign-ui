// visualization panel that a certain event originated from (other panels react to change)
import {
  Mutation,
  Position,
  SystemInstanceSpecEnhanced,
} from "../../models/design.ts";
import { useCallback } from "react";
import { ModifiersKeys } from "molstar/lib/mol-util/input/input-observer";
import { AtomInfo } from "../../components/structureviewer/molstar-utils.tsx";
import { decodeMutation, encodeMutation, encodePosition } from "./data.ts";
import { Modifiers } from "../../utils/events.tsx";

export type EventSource =
  | "STRUCTURE"
  | "MATRIX"
  | "TABLE"
  | "SEQSPACE"
  | "OTHER";

export interface DataInteractionReducerAction {
  type:
    | "SELECT_INSTANCES"
    | "SELECT_POSITIONS"
    | "SELECT_MUTATIONS"
    | "SET"
    | "RESET";
  source: EventSource;
  // multiSelect: boolean;
  modifiers: Modifiers | null;
  payload:
    | string[]
    | Position[]
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
) => {
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
      // for now, do not filter designs by position anymore, as it has no real meaning without a substitution
      //
      // let newPositions: Set<string>;
      // const payloadPositionSet = new Set(
      //   (payload as Position[]).map(encodePosition),
      // );
      // if (multiSelect) {
      //   newPositions = symmetricDifference(state.positions, payloadPositionSet);
      // } else {
      //   newPositions = payloadPositionSet;
      // }
      // return {
      //   instances: new Set<string>(),
      //   positions: newPositions,
      //   mutations: new Set<string>(),
      //   lastEventSource: source,
      //   isMutationScan: state.isMutationScan,
      //   allInstances: state.allInstances,
      //   filteredInstances: state.allInstances,
      // };
      return state;
    case "SELECT_MUTATIONS":
      // apply selection from other panel
      // TODO: do not apply for mutation scans
      const filteredInstancesM =
        state.instances.size > 1 // only filter multiple selection
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
      // apply selection from other panel
      // TODO: do not apply for mutation scans
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
        const symbol = instance.seqMap.get(
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

export const useStructureClickHandler = (
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
          payload: [{ entity: 0, pos: pos }],
        });
      }
    },
    [dispatchDataSelection],
  );
