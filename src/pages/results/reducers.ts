//
// export type EventSource = "STRUCTURE" | "MATRIX" | "TABLE" | "OTHER";
//
// export type DataInteractionReducerAction = {
//   type:
//       | "CLICK_POSITION"
//       | "CLICK_MUTATION"
//       | "CLICK_SUBSTITUTION"
//       | "RESET"
//       | "SELECT_MUTATION";
//   source: EventSource;
//   payload: number | string;
//   multiSelect: boolean | null;
// };
//
// export type DataInteractionReducerState = {
//   positions: number[];
//   substitutions: string[];
//   mutations: string[];
//   lastEventSource: string | undefined;
// };
//
// export const emptyDataInteractionState = (): DataInteractionReducerState => ({
//   positions: [],
//   substitutions: [],
//   mutations: [],
//   lastEventSource: undefined,
// });
//
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