/*
    Utility functions for Molstar viewer component
*/
import { OrderedSet } from "molstar/lib/mol-data/int";
import { Loci } from "molstar/lib/mol-model/loci";
import {
  ElementIndex,
  Structure,
  StructureElement,
  StructureProperties,
  Unit,
} from "molstar/lib/mol-model/structure";
import { PluginContext } from "molstar/lib/mol-plugin/context";
import { BuiltInTrajectoryFormat } from "molstar/lib/mol-plugin-state/formats/trajectory";
import { ModifiersKeys } from "molstar/lib/mol-util/input/input-observer";
import { InteractivityManager } from "molstar/lib/mol-plugin-state/manager/interactivity";
import { ParamDefinition } from "molstar/lib/mol-util/param-definition";
import { CameraHelperParams } from "molstar/lib/mol-canvas3d/helper/camera-helper";
import { ColorName, ColorNames } from "molstar/lib/mol-util/color/names";
import { Color } from "molstar/lib/mol-util/color";
import { PluginCommands } from "molstar/lib/mol-plugin/commands";
import { StructureSelectionQueries } from "molstar/lib/mol-plugin-state/helpers/structure-selection-query";
import {
  alignAndSuperpose,
  superpose,
} from "molstar/lib/mol-model/structure/structure/util/superposition";
import { StateTransforms } from "molstar/lib/mol-plugin-state/transforms";
import { Mat4 } from "molstar/lib/mol-math/linear-algebra";
import {
  StructureSelection,
  QueryContext,
} from "molstar/lib/mol-model/structure/query";
import { StateBuilder, StateObjectRef } from "molstar/lib/mol-state";
import { PluginStateObject as PSO } from "molstar/lib/mol-plugin-state/objects";
import { StructureRepresentationBuilder } from "molstar/lib/mol-plugin-state/builder/structure/representation";

import { BehaviorSubject } from "rxjs";
import { StereoCameraParams } from "molstar/lib/mol-canvas3d/camera/stereo";
import { ColorCallback, generateColormap } from "./molstar-color";
import { SymmetryOperator } from "molstar/lib/mol-math/geometry";
import { createStructureRepresentationParams } from "molstar/lib/mol-plugin-state/helpers/structure-representation-params";
import { MolScriptBuilder as MS } from "molstar/lib/mol-script/language/builder";
import { StructureSelectionQuery } from "molstar/lib/mol-plugin-state/helpers/structure-selection-query";
import { setSubtreeVisibility } from "molstar/lib/mol-plugin/behavior/static/state";
// import { SecondaryStructureProvider } from "molstar/lib/mol-model-props/computed/secondary-structure";
import { PluginStateObject as SO } from "molstar/lib/mol-plugin-state/objects";
import { Segmentation } from "molstar/lib/mol-data/int";
import {
  AminoAcidNamesL,
  WaterNames,
  SecondaryStructureType,
} from "molstar/lib/mol-model/structure/model/types";
import { arraySetAdd } from "molstar/lib/mol-util/array";
import { PluginSpec } from "molstar/lib/mol-plugin/spec";
import Behavior = PluginSpec.Behavior;
import { useCallback, useSyncExternalStore } from "react";
import { skip } from "rxjs";

export type RawStructure = {
  id: string;
  // acceptable types for data based on acceptable types for RawData transform
  // https://github.com/molstar/molstar/blob/b53debcfef324066f71ba0f60a8b3f45ef6f2a31/src/mol-plugin-state/transforms/data.ts#L137
  data: string | number[] | ArrayBuffer | Uint8Array;
  format: BuiltInTrajectoryFormat;
  visible: boolean;
};

// hold return values of different steps of model creation in molstar;
// ideally would use exact return types instead of any but skip for now
type SiteHighlightHandle = {
  id: string;
  componentRef: any;
  representationRef: any;
  props: any;
};

type PairHighlightHandle = {
  id: string;
  // TODO: other props may follow
};

export type StructureHandle = {
  id: string;
  data: any;
  trajectory: any;
  model: any;
  structure?: any;
  representation?: any;
  representationRefs?: any;
  components?: any;
  siteHighlights?: SiteHighlightHandle[];
  pairHighlights?: PairHighlightHandle[];
};

export type ColorMapHandle = {
  callback: ColorCallback | undefined;
  registryObject: any;
};

export enum SecondaryStructureTypeCoarse {
  Helix = "H",
  Strand = "E",
  Bend = "S",
  Turn = "T",
  Other = "C",
}

export type AtomInfo = {
  id: number;
  labelCompId: string;
  authSeqId: number;
  labelSeqId: number;
  authAsymId: string;
  labelAsymId: string;
  insertionCode: string;
  atomName: string;
  modelEntryId: string;
  modelLabel: string;
  modelId: number;
  modelIndex: number;
  inputStructureId?: string;
  secondaryStructureType: SecondaryStructureType;
  secondaryStructureTypeMapped: SecondaryStructureTypeCoarse;
  isResidue: boolean;
  isWater: boolean;
  otherAtomsInResidue?: string[];
};

export type MolstarEventHandlerArgs = {
  atomInfo: AtomInfo[];
  modifiers: ModifiersKeys;
  button: number;
  buttons: number;
};

export type MolstarEventHandler = (
  args: MolstarEventHandlerArgs,
  // atomInfo: AtomInfo[],
  // modifiers: ModifiersKeys,
  // button: number,
  // buttons: number
) => void;

export type DataUpdateCallback = (allStructures: StructureHandle[]) => void;

// overall structure visualization style (entire chains etc.)
export type Representation = {
  component:
    | "polymer"
    | "protein"
    | "protein_calpha"
    | "nucleic"
    | "ligand"
    | "ion"
    | "lipid"
    | "water";
  props: any;
  options?: Partial<StructureRepresentationBuilder.AddRepresentationOptions>;
};

export type AuthorResidueId = {
  authSeqId: number;
  // Use insertionCode = "" if no insertion code is present
  insertionCode: string;
};

// params for selecting sites/ranges to highlight and apply defined representation;
// note that authorResidueIds will take precedence over labelResidueIds if both are specified at the same time;
// same apples to labelAsymId taking precedence over authAsymId
export type SiteHighlight = {
  inputStructureId: string;
  authAsymId?: string;
  labelAsymId: string | undefined;
  authResidueIds?: AuthorResidueId[];
  labelResidueIds: number[] | undefined;

  // unique user-suppplied identifier that allows diffing code to check if representation
  // at that site needs to be changed (could e.g. be "cartoon_<color>"); this allows
  // updates to be performed independent of knowlege of visualization props
  representationId: string;

  // theme props forwarded to Mol*, e.g. color, colorParams, etc.
  props: any;
};

// params for selecting pair to highlight and apply a defined line representation
export type PairHighlight = {
  // for now, only lines within structures allowed (could extend to inter-structure eventually)
  inputStructureId: string;

  // chain / residue identifiers of first residue
  firstAuthAsymId: string;
  firstAuthResidueId: AuthorResidueId;

  // chain / residue identifiers of second residue
  secondAuthAsymId: string;
  secondAuthResidueId: AuthorResidueId;

  // unique user-suppplied identifier that allows diffing code to check if representation
  // at that site needs to be changed (could e.g. be "cartoon_<color>"); this allows
  // updates to be performed independent of knowlege of visualization props
  representationId: string;

  // theme props forwarded to Mol*
  // check here for some options: https://github.com/molstar/molstar/blob/ffee2bf1c4a5a73ec6e28181cc7d8315c5210bc1/src/mol-plugin-state/manager/structure/measurement.ts#L117
  // others:
  // - linesSize: 0.1
  // - linesColor: 0xff0000 as Color
  // - lineSizeAttenuation: false
  // - dashLength: 1
  // - customText: " ", // must be non-empty string or will not be considered
  props?: any;
};

export type SuperpositionMethod = undefined | "alignAndSuperpose" | "superpose";

// create mapping from Molstar model ID to our own model IDs
/// (supplied via structures prop of component)
export const createModelIdMap = (structureHandles: StructureHandle[]) =>
  new Map(structureHandles.map((h) => [h.model.data.id, h.id]));

// copied from https://github.com/molstar/molstar/blob/d187757bbcbd355526dd29278ded0cebbd03b7fc/src/examples/basic-wrapper/superposition.ts
const SuperpositionTag = "SuperpositionTransform";

function transform(
  plugin: PluginContext,
  s: StateObjectRef<PSO.Molecule.Structure>,
  matrix: Mat4,
  coordinateSystem?: SymmetryOperator,
) {
  // more elaborate implementation from GUI
  // https://github.com/molstar/molstar/blob/7c4202186d53736a0a9633fde963bc6f369d4c0e/src/mol-plugin-ui/structure/superposition.tsx
  const r = StateObjectRef.resolveAndCheck(plugin.state.data, s);
  if (!r) return;
  const o = plugin.state.data.selectQ((q) =>
    q
      .byRef(r.transform.ref)
      .subtree()
      .withTransformer(StateTransforms.Model.TransformStructureConformation),
  )[0];

  const transform =
    coordinateSystem && !Mat4.isIdentity(coordinateSystem.matrix)
      ? Mat4.mul(Mat4(), coordinateSystem.matrix, matrix)
      : matrix;

  const params = {
    transform: {
      name: "matrix" as const,
      params: { data: transform, transpose: false },
    },
  };
  const b = o
    ? plugin.state.data.build().to(o).update(params)
    : plugin.state.data
        .build()
        .to(s)
        .insert(StateTransforms.Model.TransformStructureConformation, params, {
          tags: SuperpositionTag,
        });
  return plugin.runTask(plugin.state.data.updateTree(b));
  // note the original is async and has: await this.plugin.runTask(this.plugin.state.data.updateTree(b));

  // basic wrapper implementation
  // const b = plugin.state.data
  //   .build()
  //   .to(s)
  //   .insert(StateTransforms.Model.TransformStructureConformation, {
  //     transform: { name: "matrix", params: { data: matrix, transpose: false } },
  //   });
  // return plugin.runTask(plugin.state.data.updateTree(b));
}

/*
  Structure superposition based on:
  * https://github.com/molstar/molstar/blob/b53debcfef324066f71ba0f60a8b3f45ef6f2a31/src/examples/basic-wrapper/superposition.ts
  * https://github.com/molstar/molstar/blob/097277e397e94413a8d2611b6683c5b34d4cb0e3/src/mol-plugin-ui/structure/superposition.tsx#L141
*/
const runSuperposition = async (
  plugin: PluginContext,
  superpositionMethod: SuperpositionMethod,
) => {
  const xs = plugin.managers.structure.hierarchy.current.structures;
  if (xs.length > 1) {
    // select entire polymer chain;
    // TODO: would it make more sense to use .protein here?
    // apparently no need to compile import { compile } from "molstar/lib/mol-script/runtime/query/compiler";
    const query = StructureSelectionQueries.polymer;

    const selections = xs.map((s) =>
      StructureSelection.toLociWithSourceUnits(
        query.query(new QueryContext(s.cell.obj!.data)),
      ),
    );

    // const pivot = plugin.managers.structure.hierarchy.findStructure(locis[0]?.structure);
    const pivot = xs[0];
    const coordinateSystem = pivot?.transform?.cell.obj?.data.coordinateSystem;

    // perform superposition (alignment-guided or just based on structure), note this
    // individual items contain RMSD and sequence alignment score
    const transforms =
      superpositionMethod === "alignAndSuperpose"
        ? alignAndSuperpose(selections)
        : superpose(selections);

    // apply transformations to superimpose structures
    for (let i = 1; i < selections.length; i++) {
      // console.log("!!!! trans", transforms[i - 1]);
      await transform(
        plugin,
        xs[i].cell,
        transforms[i - 1].bTransform,
        coordinateSystem,
      );
    }

    // plugin.managers.camera.reset();
  }
};

// map Mol* secondary down to main secondary structure states, like in "secondary-structure" colormap:
// https://github.com/molstar/molstar/blob/5edae9d6f794671b0fd722ebc599f1c627df00ca/src/mol-theme/color/secondary-structure.ts#L51
// https://github.com/molstar/molstar/blob/2c49a423e25516d3ec69752764c87acfd13bafaa/src/mol-model/structure/model/types.ts#L462
const mapSecondaryStructure = (secStructType: number) => {
  // recapitulate main flags here due to namespace import issues with Typescript and vite
  const Helix = 0x2;
  const Beta = 0x4;
  const Bend = 0x8;
  const Turn = 0x10;

  if (SecondaryStructureType.is(secStructType, Helix)) {
    return SecondaryStructureTypeCoarse.Helix;
  } else if (SecondaryStructureType.is(secStructType, Beta)) {
    return SecondaryStructureTypeCoarse.Strand;
  } else if (SecondaryStructureType.is(secStructType, Bend)) {
    return SecondaryStructureTypeCoarse.Bend;
  } else if (SecondaryStructureType.is(secStructType, Turn)) {
    return SecondaryStructureTypeCoarse.Turn;
  } else {
    return SecondaryStructureTypeCoarse.Other;
  }
};

/*

  older outdated implementation: (using ModelSecondaryStructure.Provider)
  // https://github.com/molstar/molstar/blob/2c49a423e25516d3ec69752764c87acfd13bafaa/src/mol-model-formats/structure/property/secondary-structure.ts
  // https://github.com/molstar/molstar/blob/b53debcfef324066f71ba0f60a8b3f45ef6f2a31/src/mol-model-props/computed/secondary-structure.ts
  // https://github.com/molstar/molstar/blob/b53debcfef324066f71ba0f60a8b3f45ef6f2a31/src/mol-model/structure/export/categories/secondary-structure.ts#L83
  // https://github.com/molstar/molstar/issues/364
*/
export const extractSecondaryStructure = (structure: SO.Molecule.Structure) => {
  // new implementation:
  // use in location info extraction: https://github.com/molstar/molstar/blob/1b79d349070c91a62867ce958742cbb13482c70d/src/mol-model/structure/structure/properties.ts
  // use in color theme: https://github.com/molstar/molstar/blob/2458ea7b9251965309af403ba4475a8c02843693/src/mol-theme/color/secondary-structure.ts

  const secStructElements: AtomInfo[] = [];

  for (const unit of structure.data.units) {
    if (!Unit.isAtomic(unit) || !unit.conformation.operator.isIdentity)
      continue;
    // console.log("UNIT", unit);
    // console.log("UNIT", unit.model.atomicHierarchy.residues);
    // const secStruc = SecondaryStructureProvider.get(structure.data).value?.get(
    //   unit.invariantId
    // );
    // console.log("UNIT SSE", secStruc);

    const segs = unit.model.atomicHierarchy.residueAtomSegments;
    const residues = Segmentation.transientSegments(segs, unit.elements);
    let current: Segmentation.Segment;
    while (residues.hasNext) {
      current = residues.move();
      const l = StructureElement.Location.create(
        structure.data,
        unit,
        segs.offsets[current.index],
      );

      // iterate all atoms for current residue, and record their type
      // (e.g. to skip incomplete residues elsewhere)
      const availableAtoms: string[] = [];
      for (let i = current.start; i < current.end; i++) {
        const curAtom = describeAtom(
          StructureElement.Location.create(structure.data, unit, i as ElementIndex),
        );
        availableAtoms.push(curAtom.atomName);
      }

      // const secStruc = SecondaryStructureProvider.get(l.structure).value?.get(
      //   l.unit.invariantId
      // );
      // console.log(secStruc);
      // map location information
      const lm = describeAtom(l);
      lm.otherAtomsInResidue = availableAtoms;
      secStructElements.push(lm);

      // const sse = StructureProperties.residue.secondary_structure_type(l);
      // console.log(
      //   "SSE RESI",
      //   lm.authAsymId,
      //   lm.authSeqId,
      //   lm.insertionCode,
      //   lm.secondaryStructureTypeMapped
      // );
    }
  }

  return secStructElements;

  // this seems to work:
  // console.log(
  //   "SSE...",
  //   StructureProperties.residue.secondary_structure_type(l)
  // );

  // // note following doesn't work if no secondary structure present in model.. superseded by above version
  // // following code largely based on https://github.com/molstar/molstar/blob/b53debcfef324066f71ba0f60a8b3f45ef6f2a31/src/mol-model/structure/export/categories/secondary-structure.ts#L72
  // const secondaryStructure = ModelSecondaryStructure.Provider.get(
  //   structure.data.model
  // );

  // const ssElements: SecondaryStructureElement[] = [];

  // if (!secondaryStructure) return ssElements;

  // const { key, elements } = secondaryStructure;
  // for (const unit of structure.data.units) {
  //   if (!Unit.isAtomic(unit) || !unit.conformation.operator.isIdentity)
  //     continue;

  //   const segs = unit.model.atomicHierarchy.residueAtomSegments;
  //   const residues = Segmentation.transientSegments(segs, unit.elements);

  //   let current: Segmentation.Segment,
  //     move = true;
  //   while (residues.hasNext) {
  //     if (move) current = residues.move();
  //     const start = current!.index;
  //     const startIdx = key[start];
  //     const element = elements[startIdx];
  //     // note: in our implementation, we don't filter for a particular SSE kind
  //     // if (element.kind !== kind) {
  //     //   move = true;
  //     //   continue;
  //     // }
  //     let prev = start;
  //     while (residues.hasNext) {
  //       prev = current!.index;
  //       current = residues.move();
  //       if (startIdx !== key[current.index]) {
  //         move = false;
  //         ssElements[ssElements.length] = {
  //           start: StructureElement.Location.create(
  //             structure.data,
  //             unit,
  //             segs.offsets[start]
  //           ),
  //           end: StructureElement.Location.create(
  //             structure.data,
  //             unit,
  //             segs.offsets[prev]
  //           ),
  //           length: prev - start + 1,
  //           element,
  //         };
  //         break;
  //       }
  //     }
  //   }
  // }

  // // map elements to AtomInfo type so easier to use in outside functions
  // const ssElementsMapped = ssElements.map((sse) => ({
  //   ...sse,
  //   startMapped: describeAtom(sse.start),
  //   endMapped: describeAtom(sse.end),
  // }));

  // return ssElementsMapped;
};

// from https://github.com/molstar/molstar/blob/4f69eb7963d27db416c094087afcd66083420a6f/src/mol-plugin-state/helpers/structure-selection-query.ts#L123
const _proteinEntityTest = MS.core.logic.and([
  MS.core.rel.eq([MS.ammp("entityType"), "polymer"]),
  MS.core.str.match([
    MS.re("(polypeptide|cyclic-pseudo-peptide|peptide-like)", "i"),
    MS.ammp("entitySubtype"),
  ]),
]);

// Query to select C alpha trace from protein chains
// https://github.com/molstar/molstar/blob/4f69eb7963d27db416c094087afcd66083420a6f/src/mol-plugin-state/helpers/structure-selection-query.ts#L123
const cAlphaQuery = StructureSelectionQuery(
  "C alpha trace",
  MS.struct.generator.atomGroups({
    "entity-test": _proteinEntityTest,
    "atom-test": MS.core.rel.eq([MS.ammp("label_atom_id"), "CA"]),
  }),
  { category: "" },
);

export const updateStructures = async (
  plugin: PluginContext,
  structureHandles: StructureHandle[],
  structures: RawStructure[],
  superpositionMethod: SuperpositionMethod,
  // dataUpdateCallback?: DataUpdateCallback
) => {
  // identify outdated structures (those that are in still in handle but not in props anymore)
  // removal based on https://github.com/molstar/molstar/issues/454
  const oldStructures = structureHandles.filter(
    (h) => !structures.find((s) => s.id === h.id),
  );

  if (oldStructures) {
    const update = plugin.build();
    for (const h of oldStructures) {
      // delete from Mol* based on recorded handle
      update.delete(h.data);

      // also delete any associated highlight components and representations
      if (h.siteHighlights && h.siteHighlights.length > 0) {
        for (const highlight of h.siteHighlights) {
          if (highlight.componentRef) update.delete(highlight.componentRef);
          if (highlight.representationRef)
            update.delete(highlight.representationRef);
        }
      }
    }

    // also delete from structure handles *after* commit...
    // need to do this in-place (so no filter), filter would just reassign local reference
    oldStructures.forEach((hOld) => {
      structureHandles.splice(
        structureHandles.findIndex((h) => h.id === hOld.id),
        1,
      );
    });
    await update.commit();
  }

  // let structuresAdded = false;
  const newStructures: StructureHandle[] = [];

  // iterate through all given models (from props) and load new ones
  for (const s of structures) {
    // skip structure if it is already loaded
    if (structureHandles.find((h) => h.id === s.id)) {
      continue;
    }

    // console.log("!!!! LOADING STRUCTURE");

    // Individual loading steps acccording to https://github.com/molstar/molstar/issues/256
    const data = await plugin.builders.data.rawData({
      data: s.data,
      label: s.id,
    });

    const trajectory = await plugin.builders.structure.parseTrajectory(
      data,
      s.format,
    );

    const model = await plugin.builders.structure.createModel(trajectory);

    // defaults to loading full model - need to change for structure assembly;
    // TODO: expose as parameter eventually
    const structure = await plugin.builders.structure.createStructure(model, {
      name: "model",
      params: {},
    });

    // define individual components for styling
    // TODO: think about a loop constructing the object instead...
    const components = {
      polymer: await plugin.builders.structure.tryCreateComponentStatic(
        structure,
        "polymer",
      ),
      protein: await plugin.builders.structure.tryCreateComponentStatic(
        structure,
        "protein",
      ),
      ligand: await plugin.builders.structure.tryCreateComponentStatic(
        structure,
        "ligand",
      ),
      nucleic: await plugin.builders.structure.tryCreateComponentStatic(
        structure,
        "nucleic",
      ),
      water: await plugin.builders.structure.tryCreateComponentStatic(
        structure,
        "water",
      ),
      ion: await plugin.builders.structure.tryCreateComponentStatic(
        structure,
        "ion",
      ),
      lipid: await plugin.builders.structure.tryCreateComponentStatic(
        structure,
        "lipid",
      ),
      // additional custom components
      protein_calpha:
        await plugin.builders.structure.tryCreateComponentFromSelection(
          structure,
          cAlphaQuery,
          `${s.id}_calpha`,
        ),
    };
    // console.log("*** components", components);

    const newStructure: StructureHandle = {
      id: s.id,
      data: data,
      trajectory: trajectory,
      model: model,
      structure: structure,
      components: components,
    };

    // append new structure to loaded structure handles
    structureHandles.push(newStructure);

    // also create an explicit record of newly loaded structures for callback
    newStructures.push(newStructure);

    // record that we added at least one structure to trigger superposition
    // structuresAdded = true;
  }

  // only superimpose if we added a new structure (will check for n>1 structures inside function)
  if (superpositionMethod && newStructures.length > 0) {
    await runSuperposition(plugin, superpositionMethod);
  }

  // return if data updated (to trigger callback function)
  return newStructures.length > 0 || oldStructures.length > 0;

  // alert via callback if new structures were loaded or old structures were removed
  // if (
  //   dataUpdateCallback &&
  //   (newStructures.length > 0 || oldStructures.length > 0)
  // ) {
  //   dataUpdateCallback(newStructures, structureHandles);
  //   // can e.g. apply extractSecondaryStructure(structure.obj!) outside to retrieve secondary structure
  // }
};

export const updateStructureVisibility = (
  plugin: PluginContext,
  structureHandles: StructureHandle[],
  structures: RawStructure[],
) => {
  // based on: https://github.com/molstar/molstar/blob/80d1986c611a47c65394b73bff06294abef9ff3a/src/mol-plugin-state/manager/structure/hierarchy.ts
  for (const h of structureHandles) {
    // retrieve corresponding visibility info for structure
    const shouldBeVisible = structures.find((s) => s.id === h.id)!.visible;
    const isVisible = !h.structure.cell.state.isHidden;
    // console.log("**** h", h.id, "should:", shouldBeVisible, "is:", isVisible);
    if (shouldBeVisible !== isVisible) {
      // note function naming is counterintuitive (should be "setHidden"); i.e. true -> will hide
      setSubtreeVisibility(
        plugin.state.data,
        h.structure.cell.transform.ref,
        !shouldBeVisible,
      );
    }
  }

  // const s =
  //   plugin.current!.managers.structure.hierarchy.current.structures;
  // if (s.length > 0) {
  //   console.log("!!! visual state", s[0].cell.state.isHidden);
  //   setSubtreeVisibility(
  //     plugin.current!.state.data,
  //     s[0].cell.transform.ref,
  //     !s[0].cell.state.isHidden
  //   );
  // }
  // console.log("STRUCTURES", structures);
};

/*
Extra docs:

    // for reference: direct addition of representation (wraps around buildRepresentations())
    // const reps =
    //   await plugin.builders.structure.representation.addRepresentation(
    //     h.structure,
    //     { type: "cartoon" }
    //   );

    // await plugin.managers.structure.component.updateRepresentationsTheme(
    //  h.structure,
    //  { color: "sequence-id" }
    // );

    // maybe some hope from here: https://github.com/molstar/molstar/blob/b99026bba2cca2138aaa5b9566deba70b8ddb22e/src/mol-plugin-state/manager/structure/component.ts#L228

    // plugin.dataTransaction(async () => {
    //   for (const s of plugin.managers.structure.hierarchy.current
    //     .structures) {
    //     await plugin.managers.structure.component.updateRepresentationsTheme(
    //       s.components,
    //       { color: "default" }
    //     );
    //   }
    // });

    // await plugin
    //   .build()
    //   .to(h.components[r.component])
    //   .update(
    //     createStructureRepresentationParams(plugin, undefined, {
    //       type: "ball-and-stick",
    //       // color: "name-of-my-theme" as any, // need as any because it's not a built-in theme
    //       // colorParams: { pass: 1, params: "2", here: {} },
    //     })
    //   )
    //   .commit();
*/
export const buildRepresentations = async (
  plugin: PluginContext,
  structureHandles: StructureHandle[],
  representations: Representation[],
  siteHighlights: SiteHighlight[],
  pairHighlights: PairHighlight[],
  colorMapRef: ColorMapHandle,
  colorMap?: ColorCallback,
) => {
  // first, check if we need to update the colormap;
  // we retain reference to color mapping function to check if we need to create
  // a new color theme or whether we can reuse the old
  const colorMapChanged = colorMapRef.callback !== colorMap;
  // console.log("**** changed:", colorMapChanged);

  if (colorMapChanged) {
    // console.log("**** need to register new");
    // remove previous theme from Mol* registry if present
    if (colorMapRef.registryObject) {
      // console.log("**** Destroy old colormap");
      plugin.representation.structure.themes.colorThemeRegistry.remove(
        colorMapRef.registryObject,
      );
    }

    // if a new mapping function is defined, use it to register the new theme
    if (colorMap) {
      colorMapRef.callback = colorMap;
      colorMapRef.registryObject = generateColormap(colorMap, structureHandles);
      plugin.representation.structure.themes.colorThemeRegistry.add(
        colorMapRef.registryObject,
      );

      // console.log("**** Registered new colormap !!!!!");
    } else {
      colorMapRef.callback = undefined;
      colorMapRef.registryObject = undefined;
    }
  }

  // second, deal with actual representations
  // 1) note that addRepresentation is just a light wrapper around buildRepresentation
  // https://github.com/molstar/molstar/blob/8c417ef35ce1d6c63712ed5b331423812a1cfc9d/src/mol-plugin-state/builder/structure/representation.ts#L120
  // 2) plugin.build() has to be called after all components are initialized above or
  // there will be an error resolving the structure reference
  // 3) general logic flow: https://github.com/molstar/molstar/issues/226
  const builder = plugin.builders.structure.representation;
  const update = plugin.build();

  // update structures one by one
  for (const h of structureHandles) {
    // shallow check by reference if structure already has most recent version of representation spec;
    // if so, skip;
    // however, upon a change in colormap we will recreate representations in any case
    // (there is probably a more elegant way to do this but currently not clear how to do this)
    if (h.representation !== representations || colorMapChanged) {
      // initialize representation reference field if not yet defined, this means no refs present;
      // if refs present, check if all of those are still covered by representation spec...
      // if not, delete
      if (!h.representationRefs) {
        h.representationRefs = {};
      } else {
        // delete any other representations that shouldn't be displayed anymore
        // @ts-ignore
        Object.keys(h.representationRefs).forEach((key, idx) => {
          if (!representations.find((r) => r.component === key)) {
            // remove molstar representation
            update.delete(h.representationRefs[key]);

            // eliminate our handle
            delete h.representationRefs[key];
          }
        });
      }

      // console.log("*** CUR REF:", h.representationRefs, h.components);

      // then update all representations for which there is a specificitation and
      // that are present in structure
      for (const r of representations) {
        // check if component is present on current structure, if not, skip
        if (!h.components[r.component]) continue;

        // check if there is already a representation for the component;
        // if so, update it because this is faster for changing parameters of same representationt ype
        // (e.g. recoloring cartoon)
        if (!h.representationRefs[r.component]) {
          // console.log("NEW REP");
          const repRef = await builder.buildRepresentation(
            update,
            h.components[r.component],
            r.props,
            r.options,
          );

          // store reference handle for later deletion
          // h.representationRefs.push(repRef);
          h.representationRefs[r.component] = repRef;
        } else {
          // update existing representation
          // console.log("EXISTING REP");
          // based on https://github.com/molstar/molstar/issues/404
          // await plugin
          //  .build()
          update
            .to(h.representationRefs[r.component])
            .update(
              createStructureRepresentationParams(plugin, undefined, r.props),
            );
          //.commit();
        }
      }
      // record that representations are up to date
      h.representation = representations;
    }
  }

  // now also update/create highlight representations (we built components
  // in an independent step for seamless rendering)
  updateSiteHighlightRepresentations(
    plugin,
    structureHandles,
    siteHighlights,
    update,
  );

  // update/create pair highlight representations
  updatePairHighlightRepresentations(
    plugin,
    structureHandles,
    pairHighlights,
    update,
  );

  await update.commit();
};

// utility function to select a single residue in a structure
// (e.g. used for selecting residues in EC pairs)
const selectResidueAtomQuery = (
  authAsymId: string,
  authResidueId: AuthorResidueId,
  atomLabel = "CA",
) => {
  const query = StructureSelectionQuery(
    "Residue",
    MS.struct.generator.atomGroups({
      "residue-test": MS.core.logic.and([
        MS.core.rel.eq([MS.ammp("auth_asym_id"), authAsymId]),
        MS.core.rel.eq([MS.ammp("auth_seq_id"), authResidueId.authSeqId]),
        MS.core.rel.eq([
          MS.ammp("pdbx_PDB_ins_code"),
          authResidueId.insertionCode,
        ]),
      ]),
      "atom-test": MS.core.rel.eq([MS.ammp("label_atom_id"), atomLabel]),
    }),
    { category: "" },
  );

  return query;
};

// run structure query on structure, simplified version of following code without runtime context:
// https://github.com/molstar/molstar/blob/4f69eb7963d27db416c094087afcd66083420a6f/src/mol-plugin-state/helpers/structure-selection-query.ts#L76
// const getSelectionFromStructure = (
//   plugin: PluginContext,
//   structure: Structure,
//   query: StructureSelectionQuery
// ) => {
//   const current = plugin.managers.structure.selection.getStructure(structure);
//   const currentSelection = current
//     ? StructureSelection.Sequence(structure, [current])
//     : StructureSelection.Empty(structure);
//   const _query = query.query;
//   console.log("::: query", _query);
//   return _query(new QueryContext(structure, { currentSelection }));
// };

const getSelectionFromStructure = (
  structure: Structure,
  query: StructureSelectionQuery,
) => {
  return StructureSelection.toLociWithSourceUnits(
    query.query(new QueryContext(structure)),
  );
};

// modified version of following function to create distance representation for pair visualization
// https://github.com/molstar/molstar/blob/ffee2bf1c4a5a73ec6e28181cc7d8315c5210bc1/src/mol-plugin-state/manager/structure/measurement.ts#L97
const addDistance = (
  plugin: PluginContext,
  update: StateBuilder.Root,
  id: string,
  a: StructureElement.Loci,
  b: StructureElement.Loci,
  props?: any,
) => {
  const cellA = plugin.helpers.substructureParent.get(a.structure);
  const cellB = plugin.helpers.substructureParent.get(b.structure);

  if (!cellA || !cellB) return;

  const dependsOn = [cellA.transform.ref];
  arraySetAdd(dependsOn, cellB.transform.ref);

  update
    .to(cellA)
    .apply(
      StateTransforms.Model.MultiStructureSelectionFromExpression,
      {
        selections: [
          {
            key: "a",
            groupId: "a",
            ref: cellA.transform.ref,
            expression: StructureElement.Loci.toExpression(a),
          },
          {
            key: "b",
            groupId: "b",
            ref: cellB.transform.ref,
            expression: StructureElement.Loci.toExpression(b),
          },
        ],
        isTransitive: true,
        label: "Distance",
      },
      { dependsOn, tags: id },
    )
    .apply(StateTransforms.Representation.StructureSelectionsDistance3D, {
      // no label by default
      customText: " ", // must be non-empty string or will not be considered
      linesColor: ColorNames.orange,
      // other parameters:
      // linesSize: 0.1,
      // linesColor: 0xff0000 as Color,
      // lineSizeAttenuation: false,
      // dashLength: 1,
      // unitLabel
      // textColor

      // override with custom props
      ...props,
    });

  // Options for styling:
  // https://github.com/molstar/molstar/blob/908fff80419baa0dab12b17a1215c7d2f3e18243/src/mol-repr/shape/loci/distance.ts
};

const generatePairHighlightComponentId = (highlight: PairHighlight) => {
  return `${highlight.inputStructureId}_${highlight.firstAuthAsymId}_${highlight.firstAuthResidueId.authSeqId}${highlight.firstAuthResidueId.insertionCode}___${highlight.secondAuthAsymId}_${highlight.secondAuthResidueId.authSeqId}${highlight.secondAuthResidueId.insertionCode}___${highlight.representationId}`;
};

export const updatePairHighlightRepresentations = async (
  plugin: PluginContext,
  structureHandles: StructureHandle[],
  pairHighlights: PairHighlight[],
  update: StateBuilder.Root,
) => {
  // atom of each residue to draw line representation between;
  // using C instead of CA gives better visual with strand cartoon representation
  const DEFAULT_ATOM_SELECTION = "C";

  // Track all currently defined pair highlight IDs, to identify any others that should be removed
  const pairHighlightsIds = new Set(
    pairHighlights.map((ph) => generatePairHighlightComponentId(ph)),
  );
  // console.log("::: defined highlights", pairHighlightsIds);

  // build highlight representations for each structure as needed
  for (const h of structureHandles) {
    // determine which actively defined highlights we have for current structure
    const curPairHighlights = pairHighlights.filter(
      (ph) => ph.inputStructureId === h.id,
    );

    // console.log("::: current", h.id, curPairHighlights);

    // initialize pair highlights for current structure
    if (!h.pairHighlights) {
      h.pairHighlights = [];
    }

    // work on currently defined highlights one by one and create if not
    // already present in handle list for current structure
    for (const highlight of curPairHighlights) {
      // generate unique internal identifier of highlight
      const id = generatePairHighlightComponentId(highlight);

      // console.log("::: processing", id);
      if (!h.pairHighlights.find((ph) => ph.id === id)) {
        // console.log("::: need to create", id);
        // create the pair highlight line representation
        // define residue queries
        const queryFirst = selectResidueAtomQuery(
          highlight.firstAuthAsymId,
          {
            authSeqId: highlight.firstAuthResidueId.authSeqId,
            insertionCode: highlight.firstAuthResidueId.insertionCode,
          },
          DEFAULT_ATOM_SELECTION,
        );

        const querySecond = selectResidueAtomQuery(
          highlight.secondAuthAsymId,
          {
            authSeqId: highlight.secondAuthResidueId.authSeqId,
            insertionCode: highlight.secondAuthResidueId.insertionCode,
          },
          DEFAULT_ATOM_SELECTION,
        );

        // get loci corresponding to each query
        const lociFirst = getSelectionFromStructure(
          h.structure.data,
          queryFirst,
        );

        const lociSecond = getSelectionFromStructure(
          h.structure.data,
          querySecond,
        );
        // console.log("::: l12", lociFirst, lociSecond);

        // https://github.com/molstar/molstar/blob/b53debcfef324066f71ba0f60a8b3f45ef6f2a31/src/mol-plugin-ui/structure/measurements.tsx#L90
        // plugin.managers.structure.measurement.addDistance(lociFirst, lociSecond);
        addDistance(plugin, update, id, lociFirst, lociSecond, highlight.props);

        // record in handles list
        h.pairHighlights.push({ id: id });

        // console.log("::: updated", h.id, h.pairHighlights);
      }
    } // for const highlight
    // remove outdated highlights:
    // first find if we have any...
    const outdatedHighlights = h.pairHighlights.filter(
      (ph) => !pairHighlightsIds.has(ph.id),
    );
    // console.log(
    //   "::: outdated",
    //   h.id,
    //   outdatedHighlights,
    //   h.pairHighlights,
    //   pairHighlightsIds
    // );

    // if so, delete
    if (outdatedHighlights.length > 0) {
      for (const ph of outdatedHighlights) {
        // console.log("::: remove", ph);
        const cells = plugin.state.data.selectQ((q) =>
          q.root.subtree().withTag(ph.id),
        );
        // console.log("::: cells", cells);
        if (cells[0]) {
          update.delete(cells[0]);
        }
      }

      // update handles on current structure to keep only active highlights
      h.pairHighlights = h.pairHighlights.filter((ph) =>
        pairHighlightsIds.has(ph.id),
      );
    }
  } // for const h

  // for removal, follow logic here: https://github.com/molstar/molstar/issues/375
  // (since we can't get a direct handle onto the representation with the approach from addDistance)
  /*const cells = plugin.state.data.selectQ((q) =>
    q.root.subtree().withTag("removal_tag_test")
  );
  // console.log("::: cells", cells);
  if (cells[0]) {
    update.delete(cells[0]);
    return; // TODO: Remove!
  }
  */
  // ---- legacy implementation below ----------------------------
  // TODO: remove??
  // if (structureHandles.length === 0) return;
  // TODO: remove??

  // // define residue queries
  // const queryFirst = selectResidueAtomQuery(
  //   "A",
  //   {
  //     authSeqId: 38,
  //     insertionCode: "",
  //   },
  //   DEFAULT_ATOM_SELECTION
  // );

  // const querySecond = selectResidueAtomQuery(
  //   "A",
  //   {
  //     authSeqId: 86,
  //     insertionCode: "",
  //   },
  //   DEFAULT_ATOM_SELECTION
  // );

  // // get loci corresponding to each query
  // const lociFirst = getSelectionFromStructure(
  //   structureHandles[0].structure.data,
  //   queryFirst
  // );

  // const lociSecond = getSelectionFromStructure(
  //   structureHandles[0].structure.data,
  //   querySecond
  // );
  // console.log("::: l12", lociFirst, lociSecond);

  // // https://github.com/molstar/molstar/blob/b53debcfef324066f71ba0f60a8b3f45ef6f2a31/src/mol-plugin-ui/structure/measurements.tsx#L90
  // // plugin.managers.structure.measurement.addDistance(lociFirst, lociSecond);
  // const id = "removal_tag_test";
  // const props = {};
  // addDistance(plugin, update, id, lociFirst, lociSecond, props);
};

const generateHighlightComponentId = (highlight: SiteHighlight) => {
  let residueIdsJoined;
  if (highlight.authResidueIds !== undefined) {
    residueIdsJoined = highlight.authResidueIds
      .map(
        (pos) =>
          `auth:${pos.authSeqId}${pos.insertionCode ? pos.insertionCode : ""}`,
      )
      .join("/");
  } else if (highlight.labelResidueIds !== undefined) {
    residueIdsJoined = highlight.labelResidueIds
      .map((pos) => `label:${pos}`)
      .join("/");
  } else {
    throw new Error(
      "Need to define authResidueIds or labelResidueIds for highlighting",
    );
  }

  const chainId = highlight.labelAsymId
    ? `label:${highlight.labelAsymId}`
    : `auth:${highlight.authAsymId}`;

  return `${highlight.inputStructureId}_${chainId}_${residueIdsJoined}___${highlight.representationId}`;
};

// create components for highlights; to avoid "flickering" during display
// representations are added in a second step together with main structure
// represetations
export const createSiteHighlightComponents = async (
  plugin: PluginContext,
  structureHandles: StructureHandle[],
  siteHighlights: SiteHighlight[],
) => {
  // console.log("+++ build components");
  // build highlight components for each structure as needed
  for (const h of structureHandles) {
    // determine which highlights we have for current structure
    const curSiteHighlights = siteHighlights.filter(
      (sh) => sh.inputStructureId === h.id,
    );
    // console.log("+++ current:", curSiteHighlights);

    // initialize site highlights for current structure
    if (!h.siteHighlights) {
      h.siteHighlights = [];
    }

    for (const highlight of curSiteHighlights) {
      // generate unique identifier of highlight
      const id = generateHighlightComponentId(highlight);

      if (!h.siteHighlights.find((sh) => sh.id === id)) {
        // console.log("+++ create highlight component", highlight);
        // Examples how to select: https://github.com/molstar/molstar/blob/master/src/mol-plugin-state/helpers/structure-selection-query.ts
        // https://github.com/molstar/molstar/issues/168 for logic how to select multiple positions but doesn't work so build
        // up from individual residues (also have to deal with insertion codes)

        // construct the individual position query across all positions (will be joined by "or");
        // select by label or author residue Ids
        let resQueryExpr;

        // Author chain or PDB chain selector?
        let chainSelector: string;
        let isAuthChain: boolean;

        // determine what selector we have
        if (highlight.labelAsymId) {
          chainSelector = highlight.labelAsymId;
          // use clunky boolean assignment here to work around typescript complaining below
          isAuthChain = false;
        } else if (highlight.authAsymId) {
          chainSelector = highlight.authAsymId;
          isAuthChain = true;
        } else {
          throw new Error(
            "Need to define labelAsymId or authAsymId for highlighting",
          );
        }

        if (highlight.authResidueIds !== undefined) {
          resQueryExpr = highlight.authResidueIds.map((res) =>
            MS.core.logic.and([
              MS.core.rel.eq([
                MS.ammp(isAuthChain ? "auth_asym_id" : "label_asym_id"),
                chainSelector,
              ]),
              MS.core.rel.eq([MS.ammp("auth_seq_id"), res.authSeqId]),
              MS.core.rel.eq([MS.ammp("pdbx_PDB_ins_code"), res.insertionCode]),
            ]),
          );
        } else if (highlight.labelResidueIds !== undefined) {
          resQueryExpr = highlight.labelResidueIds.map((res) =>
            MS.core.logic.and([
              MS.core.rel.eq([
                MS.ammp(isAuthChain ? "auth_asym_id" : "label_asym_id"),
                chainSelector,
              ]),
              MS.core.rel.eq([MS.ammp("label_seq_id"), res]),
            ]),
          );
        } else {
          throw new Error(
            "Need to define authResidueIds or labelResidueIds for highlighting",
          );
        }

        const query = StructureSelectionQuery(
          "All",
          MS.struct.generator.atomGroups({
            // "residue-test": MS.core.rel.eq([MS.ammp("auth_seq_id"), 100]),
            // "residue-test": MS.core.logic.and([
            //   MS.core.rel.eq([MS.ammp("auth_seq_id"), 14]),
            //   MS.core.rel.eq([MS.ammp("pdbx_PDB_ins_code"), "K"]),
            // ]),
            "residue-test": MS.core.logic.or(resQueryExpr),
          }),
          { category: "", priority: 1000 },
        );

        const component =
          await plugin.builders.structure.tryCreateComponentFromSelection(
            h.structure,
            query,
            id,
          );

        // console.log("+++ COMPONENT", component);
        // only record component if we had success creating it (will be undefined otherwise)
        if (component) {
          h.siteHighlights.push({
            id: id,
            componentRef: component,
            representationRef: undefined,
            props: highlight.props,
          });
        }
      }
    }
  }
  // console.log("+++ final handles:", structureHandles);
};

// create representations for site highlights, and delete any outdated ones
// note that components were created earlier so we can use the same "update"
// object as for main component representations to avoid "flickering" (highlight
// appearing later than main structure representation).
export const updateSiteHighlightRepresentations = async (
  plugin: PluginContext,
  structureHandles: StructureHandle[],
  siteHighlights: SiteHighlight[],
  update: StateBuilder.Root,
) => {
  // console.log("+++ render highlights", siteHighlights, structureHandles);

  // Track all currently defined highlight IDs, to identify any others that should be removed
  const siteHighlightsIds = new Set(
    siteHighlights.map((sh) => generateHighlightComponentId(sh)),
  );
  // console.log("+++ defined highlights", siteHighlightsIds);

  // build highlight representations for each structure as needed
  for (const h of structureHandles) {
    // siteHighlights already initialized in component creation function
    for (const highlight of h.siteHighlights!) {
      // console.log("+++ handle", highlight.id);
      // check if the highlight we are looking at is still an up-to-date requested highlight
      if (siteHighlightsIds.has(highlight.id)) {
        // if we haven't assigned the representation reference, we need to create the representation;
        // if we already have a representation, do nothing
        if (!highlight.representationRef) {
          // console.log("+++ create", highlight.id);
          highlight.representationRef =
            plugin.builders.structure.representation.buildRepresentation(
              update,
              highlight.componentRef,
              highlight.props,
            );
        }
      } else {
        // remove out-of-date highlights
        // console.log("+++ delete", highlight.id);
        update.delete(highlight.representationRef);
        // also tear down component
        update.delete(highlight.componentRef);
      }
    }

    // finally, remove highlights from handle list on structure
    h.siteHighlights = h.siteHighlights!.filter((sh) =>
      siteHighlightsIds.has(sh.id),
    );
  }
};

// TODO: Temporary registration of color map
// const colorMap = generateColormap(() => {
//   return 1;
// });
// if (
//   !plugin.current.representation.structure.themes.colorThemeRegistry.has(
//     colorMap
//   )
// ) {
//   plugin.current.representation.structure.themes.colorThemeRegistry.add(
//     colorMap
//   );
// }

export const describeAtom = (
  l: StructureElement.Location<Unit>,
  modelIdMap?: Map<string, string>,
): AtomInfo => {
  // console.log(
  //   "*** SSE",
  //   StructureProperties.residue.secondary_structure_type(l)
  // );
  const labelCompId = StructureProperties.atom.label_comp_id(l);
  const secondaryStructureType =
    StructureProperties.residue.secondary_structure_type(l);

  const a: AtomInfo = {
    id: StructureProperties.atom.id(l),
    labelCompId: labelCompId,
    authSeqId: StructureProperties.residue.auth_seq_id(l),
    labelSeqId: StructureProperties.residue.label_seq_id(l),
    authAsymId: StructureProperties.chain.auth_asym_id(l),
    labelAsymId: StructureProperties.chain.label_asym_id(l),
    insertionCode: StructureProperties.residue.pdbx_PDB_ins_code(l),
    atomName: StructureProperties.atom.auth_atom_id(l),
    modelEntryId: StructureProperties.unit.model_entry_id(l),
    modelLabel: StructureProperties.unit.model_label(l),
    modelIndex: StructureProperties.unit.model_index(l),
    modelId: StructureProperties.unit.id(l),
    inputStructureId: modelIdMap ? modelIdMap.get(l.unit.model.id) : undefined,
    secondaryStructureType: secondaryStructureType,
    secondaryStructureTypeMapped: mapSecondaryStructure(secondaryStructureType),
    isResidue: AminoAcidNamesL.has(labelCompId),
    isWater: WaterNames.has(labelCompId),
  };

  return a;
};

// Source: https://github.com/molstar/molstar/issues/350#issuecomment-1021811264
export function getAtomInfo(loci: Loci, structureHandles: StructureHandle[]) {
  const atomInfo: AtomInfo[] = [];
  // create map from model IDs to input structure IDs
  // (compute on the fly for now for easier data consistency maintenance)
  const modelIdMap = createModelIdMap(structureHandles);

  // map all loci elements
  if (StructureElement.Loci.is(loci)) {
    const l = StructureElement.Location.create(loci.structure);
    for (const e of loci.elements) {
      if (Unit.isAtomic(e.unit)) {
        l.unit = e.unit;
        OrderedSet.forEach(e.indices, (v) => {
          l.element = e.unit.elements[v];
          // console.log("*** MODEL:", e.unit.model);
          atomInfo.push(describeAtom(l, modelIdMap));
        });
      }
    }
  }

  return atomInfo;
}

export const addEventHandler = (
  // @ts-ignore
  plugin: PluginContext,
  structureHandles: StructureHandle[],
  behavior: BehaviorSubject<
    InteractivityManager.HoverEvent | InteractivityManager.ClickEvent | any
  >,
  handler: MolstarEventHandler,
) => {
  // create subscription
  const subscriber = behavior.subscribe((e) => {
    const atomInfo = getAtomInfo(e.current.loci, structureHandles);
    // handler({atomInfo, e.modifiers, e.button, e.buttons);
    handler({
      atomInfo: atomInfo,
      modifiers: e.modifiers,
      button: e.button,
      buttons: e.buttons,
    });
  });

  // return cleanup function for useEffect which unsubscribes
  return () => subscriber.unsubscribe();
};

export const useBehaviorReact = (s: Behavior | undefined) => {
  return useSyncExternalStore(
    useCallback(
      (callback: () => void) => {
        const sub = (s as any)?.pipe(skip(1)).subscribe(callback);
        return () => sub?.unsubscribe();
      },
      [s],
    ),
    //@ts-ignore
    useCallback(() => s?.value, [s]),
  );
};

export const applyHandler = (
  handler: any,
  behaviour: any,
  structureHandlesRef: any,
) => {
  if (!handler || !behaviour || !structureHandlesRef.current) {
    return;
  }

  const atomInfo = getAtomInfo(
    behaviour.current.loci,
    structureHandlesRef.current,
  );

  handler({
    atomInfo: atomInfo,
    modifiers: behaviour.modifiers,
    button: behaviour.button,
    buttons: behaviour.buttons,
  });
};

export const toggleAxes = (plugin: PluginContext, showAxes: boolean) => {
  if (!showAxes) {
    plugin.canvas3d?.setProps({
      camera: {
        helper: {
          axes: {
            name: "off",
            params: {},
          },
        },
      },
    });
  } else {
    plugin.canvas3d?.setProps({
      camera: {
        helper: {
          axes: ParamDefinition.getDefaultValues(CameraHelperParams).axes,
        },
      },
    });
  }
};

export const toggleStereo = (plugin: PluginContext, stereo: boolean) => {
  if (!stereo) {
    plugin.canvas3d?.setProps({
      camera: {
        stereo: {
          name: "off",
          params: {},
        },
      },
    });
  } else {
    plugin.canvas3d?.setProps({
      camera: {
        stereo: {
          name: "on",
          params: ParamDefinition.getDefaultValues(StereoCameraParams),
        },
      },
    });
  }
};

export const setColors = (
  plugin: PluginContext,
  backgroundColor?: number | ColorName,
  highlightColor?: number | ColorName,
  selectColor?: number | ColorName,
) => {
  const renderer = plugin.canvas3d!.props.renderer;
  const update: {
    backgroundColor?: Color;
    highlightColor?: Color;
    selectColor?: Color;
  } = {};

  const interpretColor = (color: number | ColorName) => {
    if (typeof color === "number") {
      return color as Color;
    } else {
      return ColorNames[color];
    }
  };

  if (highlightColor) {
    update["highlightColor"] = interpretColor(highlightColor);
  }

  if (backgroundColor) {
    update["backgroundColor"] = interpretColor(backgroundColor);
  }

  if (selectColor) {
    update["selectColor"] = interpretColor(selectColor);
  }

  // update based on logic here: https://molstar.org/docs/viewer-state/#change-background-highlight-or-select-color
  PluginCommands.Canvas3D.SetSettings(plugin, {
    settings: {
      renderer: {
        ...renderer,
        ...update,
      },
    },
  });
};

// export const highlightPositions = async (
//   plugin: PluginContext,
//   structureHandles: StructureHandle[],
//   highlight: number
// ) => {
//   const modelIdMap = createModelIdMap(structureHandles);
//   console.log("*** Mapping", modelIdMap);

//   if (structureHandles.length > 0) {
//     // const structure = structureHandles[0].structure;
//     const xs = plugin.managers.structure.hierarchy.current.structures;

//     // General information on structure overpaint:
//     // https://github.com/molstar/molstar/issues/264
//     // https://github.com/molstar/molstar/issues/297
//     //
//     // > To get started you can search the source code for setStructureOverpaint.
//     // > You can use it together with this.plugin.managers.structure.hierarchy and generating a query
//     // >  to get the required loci.
//     // >  Many query examples are in https://github.com/molstar/molstar/blob/master/src/mol-plugin-state/helpers/structure-selection-query.ts
//     // > and you find some ways to query for example in examples/basic-wrapper.

//     console.log("*** highlighting...", highlight, xs);

//     const lociGetter = async (s: Structure) => {
//       // based on https://github.com/molstar/molstar/blob/master/src/examples/basic-wrapper/index.ts
//       // const data = s?.cell.obj?.data;
//       // if (!data) return;
//       console.log("... getter", s);

//       const seq_id = 50;
//       const sel = Script.getStructureSelection(
//         (Q) =>
//           Q.struct.generator.atomGroups({
//             "residue-test": Q.core.rel.eq([
//               Q.struct.atomProperty.macromolecular.label_seq_id(),
//               seq_id,
//             ]),
//             "group-by": Q.struct.atomProperty.macromolecular.residueKey(),
//           }),
//         s
//       );

//       console.log("... getter", s);
//       console.log("... selection", sel);
//       return StructureSelection.toLociWithSourceUnits(sel);
//       // const loci = StructureSelection.toLociWithSourceUnits(sel);
//       // return loci;

//       // const query = StructureSelectionQueries.polymer;

//       // const selections = StructureSelection.toLociWithSourceUnits(
//       //   query.query(new QueryContext(s.cell.obj!.data))
//       // );

//       // console.log("... getter", s);
//       // return EmptyLoci;
//     };

//     // const query = StructureSelectionQueries.polymer;
//     // const lociGetter = async (s: Structure) =>
//     //   StructureSelection.toLociWithCurrentUnits(
//     //     query.query(new QueryContext(s))
//     //   );
//     if (highlight > 0) {
//       await setStructureOverpaint(
//         plugin,
//         xs[0].components,
//         0xff0000 as Color,
//         lociGetter
//         // ["cartoon", "ball-and-stick"]
//       );
//     } else {
//       await clearStructureOverpaint(plugin, xs[0].components, ["cartoon"]);
//     }

//     // await setStructureOverpaint(
//     //   plugin,
//     //   // structure.cell.obj!,
//     //   structure,
//     //   0xff0000 as Color,
//     //   lociGetter
//     // );
//     console.log("*** highlight done");

//     // s => query.query(new QueryContext(s.cell.obj!.data))

//     /*const query = StructureSelectionQueries.polymer;
//     const selections = xs.map((s) =>
//       StructureSelection.toLociWithCurrentUnits(
//         query.query(new QueryContext(s.cell.obj!.data))
//       )
//     );*/
//   }

//   // TODO: change query
//   // TODO: how to define on a per-structure basis? -> based on components list
//   //   const query = StructureSelectionQueries.polymer;
//   //   await setStructureOverpaint(
//   //     plugin,
//   //     [components.polymer],
//   //     0xff0000 as Color,
//   //     // s => query.query(new QueryContext(s.cell.obj!.data))
//   //   );
//   // }
//   // if (plugin.current && highlight && structureHandlesRef.current.length > 0) {
//   //   // get first structure for now
//   //   const structure = structureHandlesRef.current[0];
//   //   console.log("*** highlight:", highlight, structure);

//   //   const components = {
//   //     // polymer:
//   //     //   await plugin.current.builders.structure.tryCreateComponentStatic(
//   //     //     structure.structure,
//   //     //     "polymer"
//   //     //   ),
//   //     // ligand:
//   //     //   await plugin.current.builders.structure.tryCreateComponentStatic(
//   //     //     structure,
//   //     //     "ligand"
//   //     //   ),
//   //     // water: await plugin.current.builders.structure.tryCreateComponentStatic(
//   //     //   structure,
//   //     //   "water"
//   //     // ),
//   //   };
//   // / await setStructureOverpaint(plugin.current, )

//   //   // setStructureOverpaint
//   //   // clearStructureOverpaint
// };
