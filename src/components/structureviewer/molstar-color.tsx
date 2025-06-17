/**
 * Based on Molstar code: https://github.com/molstar/molstar/blob/5edae9d6f794671b0fd722ebc599f1c627df00ca/src/mol-theme/color/sequence-id.ts
 *
 * Copyright (c) 2018 mol* contributors, licensed under MIT, See LICENSE file for more info.
 */

import { Unit, StructureElement } from "molstar/lib/mol-model/structure";

import { Color } from "molstar/lib/mol-util/color";
import { Location } from "molstar/lib/mol-model/location";
import { ColorTheme } from "molstar/lib/mol-theme/color";
import { ParamDefinition as PD } from "molstar/lib/mol-util/param-definition";
import { ThemeDataContext } from "molstar/lib/mol-theme/theme";
import {
  AtomInfo,
  StructureHandle,
  createModelIdMap,
  describeAtom,
} from "./molstar-utils";

// const DefaultColor = Color(0xcccccc);
const Description =
  "Assign colors on a per-residue level through callback function.";

export const SequenceIdColorThemeParams = {
  default: PD.Color(Color(0x000000)),
  // list: PD.ColorList("turbo", { presetKind: "scale" }),
};
export type CustomColorThemeParams = typeof SequenceIdColorThemeParams;
export function getCustomColorThemeParams(
    // @ts-ignore
    ctx: ThemeDataContext
) {
  return SequenceIdColorThemeParams; // TODO return copy
}

// function getSeqId(unit: Unit, element: ElementIndex): number {
//   // onst { model } = unit;
//   //   switch (unit.kind) {
//   //     case Unit.Kind.Atomic:
//   //       const residueIndex =
//   //         model.atomicHierarchy.residueAtomSegments.index[element];
//   //       return model.atomicHierarchy.residues.label_seq_id.value(residueIndex);
//   //     case Unit.Kind.Spheres:
//   //       return Math.round(
//   //         (model.coarseHierarchy.spheres.seq_id_begin.value(element) +
//   //           model.coarseHierarchy.spheres.seq_id_end.value(element)) /
//   //           2
//   //       );
//   //     case Unit.Kind.Gaussians:
//   //       return Math.round(
//   //         (model.coarseHierarchy.gaussians.seq_id_begin.value(element) +
//   //           model.coarseHierarchy.gaussians.seq_id_end.value(element)) /
//   //           2
//   //       );
//   //   }
//   return 1;
// }

// function getSequenceLength(unit: Unit, element: ElementIndex) {
//   //const { model } = unit;
//   //   let entityId = "";
//   //   switch (unit.kind) {
//   //     case Unit.Kind.Atomic:
//   //       const chainIndex = model.atomicHierarchy.chainAtomSegments.index[element];
//   //       entityId = model.atomicHierarchy.chains.label_entity_id.value(chainIndex);
//   //       break;
//   //     case Unit.Kind.Spheres:
//   //       entityId = model.coarseHierarchy.spheres.entity_id.value(element);
//   //       break;
//   //     case Unit.Kind.Gaussians:
//   //       entityId = model.coarseHierarchy.gaussians.entity_id.value(element);
//   //       break;
//   //   }
//   //   if (entityId === "") return 0;

//   //   const entityIndex = model.entities.getEntityIndex(entityId);
//   //   if (entityIndex === -1) return 0;

//   //   const entity = model.sequence.byEntityKey[entityIndex];
//   //   if (entity === undefined) return 0;

//   // return entity.sequence.length;
//   return 10;
// }

// export function CustomSequenceIdColorTheme(
//   ctx: ThemeDataContext,
//   props: PD.Values<SequenceIdColorThemeParams>
// ): ColorTheme<SequenceIdColorThemeParams> {
//   const scale = ColorScale.create({
//     listOrName: props.list.colors,
//     minLabel: "Start",
//     maxLabel: "End",
//   });
//   console.log("++++ COLORSCHEME", ctx, props); // TODO: remove
//   const color = (location: Location): Color => {
//     console.log(".... individual location"); // TODO: remove
//     if (StructureElement.Location.is(location)) {
//       // console.log("---- element"); // TODO: remove
//       const { unit, element } = location;
//       const seq_id = getSeqId(unit, element);
//       if (seq_id > 0) {
//         const seqLen = getSequenceLength(unit, element);
//         if (seqLen) {
//           scale.setDomain(0, seqLen - 1);
//           return scale.color(seq_id);
//         }
//       }
//     } else if (Bond.isLocation(location)) {
//       // console.log("---- bond"); // TODO: remove
//       const { aUnit, aIndex } = location;
//       const seq_id = getSeqId(aUnit, aUnit.elements[aIndex]);
//       if (seq_id > 0) {
//         const seqLen = getSequenceLength(aUnit, aUnit.elements[aIndex]);
//         if (seqLen) {
//           scale.setDomain(0, seqLen - 1);
//           return scale.color(seq_id);
//         }
//       }
//     }
//     return DefaultColor;
//   };

//   return {
//     factory: CustomSequenceIdColorTheme,
//     granularity: "group",
//     preferSmoothing: true,
//     color,
//     props,
//     description: Description,
//     legend: scale ? scale.legend : undefined,
//   };
// }

// export const CustomSequenceIdColorThemeProvider: ColorTheme.Provider<
//   SequenceIdColorThemeParams,
//   "sequencemap-custom"
// > = {
//   name: "sequencemap-custom",
//   label: "Custom coloring based on model, chain and residue identifier",
//   // typescript issue with const enum, just pass plain string value corresponding
//   // to ColorTheme.Category.Residue,
//   category: "Residue Property",
//   factory: CustomSequenceIdColorTheme,
//   getParams: getSequenceIdColorThemeParams,
//   defaultValues: PD.getDefaultValues(SequenceIdColorThemeParams),
//   isApplicable: (ctx: ThemeDataContext) => !!ctx.structure,
// };

export type ColorCallback = (atomInfo: AtomInfo[]) => Color;

export const generateColormap = (
  colorCallback: ColorCallback,
  structureHandles: StructureHandle[]
) => {
  function CustomSequenceIdColorTheme(
      // @ts-ignore
      ctx: ThemeDataContext,
    props: PD.Values<CustomColorThemeParams>
  ): ColorTheme<CustomColorThemeParams> {
    // const scale = ColorScale.create({
    //   listOrName: props.list.colors,
    //   minLabel: "Start",
    //   maxLabel: "End",
    // });

    // console.log("PROPS", props);
    // create map from model IDs to input structure IDs
    // (compute on the fly for now for easier data consistency maintenance)
    // TODO: are we safe having this map outside of loop here?
    const modelIdMap = createModelIdMap(structureHandles);

    // function called once per structure colored; color function itself
    // is then applied to each individual residue
    const color = (location: Location): Color => {
      if (
        StructureElement.Location.is(location) &&
        Unit.isAtomic(location.unit)
      ) {
        return colorCallback([describeAtom(location, modelIdMap)]);
        // return props.default;

        // const seq_id = getSeqId(unit, element);
        // const { unit, element } = location;
        // const seq_id = colorCallback([atomInfo]);
        // if (seq_id > 0) {
        //   const seqLen = getSequenceLength(unit, element);
        //   if (seqLen) {
        //     scale.setDomain(0, seqLen - 1);
        //     return scale.color(seq_id);
        //   }
        // }
      }

      // handle default case
      return props.default;
    };

    return {
      factory: CustomSequenceIdColorTheme,
      granularity: "group",
      preferSmoothing: true,
      color,
      props,
      description: Description,
      // legend: scale ? scale.legend : undefined,
      legend: undefined,
    };
  }

  const CustomSequenceIdColorThemeProvider: ColorTheme.Provider<
    CustomColorThemeParams,
    "sequencemap-custom"
  > = {
    name: "sequencemap-custom",
    label: "Custom coloring based on model, chain and residue identifier",
    // typescript issue with const enum, just pass plain string value corresponding
    // to ColorTheme.Category.Residue,
    category: "Residue Property",
    factory: CustomSequenceIdColorTheme,
    getParams: getCustomColorThemeParams,
    defaultValues: PD.getDefaultValues(SequenceIdColorThemeParams),
    isApplicable: (ctx: ThemeDataContext) => !!ctx.structure,
  };

  return CustomSequenceIdColorThemeProvider;
};
