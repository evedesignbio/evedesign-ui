// visualization panel that a certain event originated from (other panels react to change)
import {
  Mutation,
  Position,
  SystemInstanceSpecEnhanced,
} from "../../models/design.ts";
import { useCallback } from "react";
import { ModifiersKeys } from "molstar/lib/mol-util/input/input-observer";
import { AtomInfo } from "../../components/structureviewer/molstar-utils.tsx";
import { encodeMutation, encodePosition } from "./data.ts";
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
}

export const emptyDataInteractionState = (): DataInteractionReducerState => ({
  instances: new Set<string>(),
  positions: new Set<string>(),
  mutations: new Set<string>(),
  lastEventSource: undefined,
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
      return emptyDataInteractionState();
    case "SET":
      return {
        ...(action.payload as DataInteractionReducerState),
      };
    case "SELECT_POSITIONS":
      let newPositions: Set<string>;
      const payloadPositionSet = new Set(
        (payload as Position[]).map(encodePosition),
      );
      if (multiSelect) {
        newPositions = symmetricDifference(state.positions, payloadPositionSet);
      } else {
        newPositions = payloadPositionSet;
      }
      return {
        instances: new Set<string>(),
        positions: newPositions,
        mutations: new Set<string>(),
        lastEventSource: source,
      };
    case "SELECT_MUTATIONS":
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
      };
    case "SELECT_INSTANCES":
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

export const filterInstancesByPosSelection = (
  x: SystemInstanceSpecEnhanced[],
  encodedPositions: Set<string>,
) => {
  return x.filter((inst) => {
    // encode mutated positions for current instance
    const posEncoded = new Set(
      inst.mutant.map((mut) =>
        encodePosition({ entity: mut.entity, pos: mut.pos }),
      ),
    );

    // check if all selected positions are contained in encoded set => keep instance
    // (not using intersection method for now due to availability)
    const overlap = [...encodedPositions].filter((pos) => posEncoded.has(pos));
    return overlap.length === encodedPositions.size;
  });
};

export const filterInstancesByMutSelection = (
  x: SystemInstanceSpecEnhanced[],
  encodedMutations: Set<string>,
) => {
  console.log("NOT IMPLEMENTED", encodedMutations); // TODO implement
  return x;
};

export const filterInstancesByReducerSelection = (
  instances: SystemInstanceSpecEnhanced[],
  dataSelection: DataInteractionReducerState,
) => {
  if (dataSelection.instances.size > 0) {
    return instances.filter((inst) => dataSelection.instances.has(inst.id));
  } else if (dataSelection.mutations.size > 0) {
    return filterInstancesByMutSelection(instances, dataSelection.mutations);
  } else if (dataSelection.positions.size > 0) {
    return filterInstancesByPosSelection(instances, dataSelection.positions);
  } else {
    return instances;
  }
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
