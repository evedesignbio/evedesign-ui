// visualization panel that a certain event originated from (other panels react to change)
import { Mutation, Position } from "../../models/design.ts";
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
  modifiers: Modifiers;
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
  const multiSelect = modifiers.shift || modifiers.meta;

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

// export const RESET_PAYLOAD = {
//   type: "RESET",
//   source: "OTHER",
//   payload: 0,
//   multiSelect: false,
// } as DataInteractionReducerAction;
//
// export const initializeSelectionPayload = (
//     mutations: MutationMatrix,
//     mutant: string | null
// ): DataInteractionReducerAction => {
//   if (mutant) {
//     // try to parse mutation (undefined if not valid format)
//     const mut = parseMutation(mutant);
//
//     // if valid substitution and agrees with current dataset, return action to trigger mutation selection
//     if (
//         mut &&
//         mutations.positions.has(mut.position) &&
//         mutations.wildtype.get(mut.position) === mut.from &&
//         mutations.substitutions.has(mut.to)
//     ) {
//       return {
//         type: "SELECT_MUTATION",
//         source: "OTHER",
//         payload: encodeMutation(mut.position, mut.to),
//         multiSelect: false,
//       } as DataInteractionReducerAction;
//     } else {
//       return RESET_PAYLOAD;
//     }
//   }
//
//   // default: reset to empty selection
//   return RESET_PAYLOAD;
// };
//
//
// export const dataInteractionReducer = (
//     state: DataInteractionReducerState,
//     action: DataInteractionReducerAction
// ) => {
//   // console.log(";;;; DISPATCHED", action);
//   const { type, payload, multiSelect } = action;
//
//   switch (type) {
//     case "RESET":
//       return emptyDataInteractionState();
//     case "CLICK_POSITION":
//       // We can select multiple positions at a time. Mutations cannot be selected at the same time
//       let newPos;
//       // if position is present, remove it
//       if (state.positions.filter((pos) => pos === payload).length > 0) {
//         newPos = state.positions.filter((pos) => pos !== payload);
//       } else {
//         // if position is not present, add it to selection, or replace selection
//         // (depending on multiSelect behaviour)
//         if (multiSelect) {
//           newPos = state.positions.concat(payload as number);
//         } else {
//           newPos = [payload];
//         }
//       }
//
//       return {
//         // update positions
//         positions: newPos,
//         // respect selected substitutions from old state
//         substitutions: state.substitutions,
//         // position selection resets mutation selection
//         mutations: [],
//         lastEventSource: action.source,
//       } as DataInteractionReducerState;
//     case "CLICK_SUBSTITUTION":
//       // We can select one substitution at a time. Mutations cannot be selected at the same time, positions can.
//       let newSubs: string[];
//       // if position is already selected, deselect it again
//       if (state.substitutions.filter((subs) => subs === payload).length > 0) {
//         newSubs = [];
//       } else {
//         // otherwise replace with new selection
//         newSubs = [payload as string];
//       }
//
//       return {
//         // respect selected positions from old state
//         positions: state.positions,
//         // update substitutions
//         substitutions: newSubs,
//         // position selection resets mutation selection
//         mutations: [],
//         lastEventSource: action.source,
//       } as DataInteractionReducerState;
//     case "CLICK_MUTATION":
//       // We can select one or multiple mutations at a time. This will deselect positions and substitutions.
//       let newMuts;
//       // if substitution is present, remove it
//       if (state.mutations.filter((mut) => mut === payload).length > 0) {
//         newMuts = state.mutations.filter((mut) => mut !== payload);
//       } else {
//         const newMutPos = decodeMutation(payload as string);
//         // otherwise add it to existing selection, but need to remove any other substitutions in same position
//         // (only relevant for multiSelect case, otherwise just return latest single selection)
//         if (multiSelect) {
//           newMuts = state.mutations
//               .filter((mut) => decodeMutation(mut).pos !== newMutPos.pos)
//               .concat(payload as string);
//         } else {
//           newMuts = [payload];
//         }
//       }
//
//       return {
//         // reset selected positions
//         positions: [],
//         // reset selected substitutions
//         substitutions: [],
//         // update to new mutations
//         mutations: newMuts,
//         lastEventSource: action.source,
//       } as DataInteractionReducerState;
//     case "SELECT_MUTATION":
//       // mutation selection triggered internally rather than by user event (e.g. via URL search params)
//       return {
//         positions: [],
//         substitutions: [],
//         mutations: [payload],
//         lastEventSource: action.source,
//       } as DataInteractionReducerState;
//     default:
//       throw new Error(
//           "Should not reach default case in data selection reducer"
//       );
//   }
// };

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
