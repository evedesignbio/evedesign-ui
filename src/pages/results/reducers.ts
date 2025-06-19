import { StructureAlignment } from "../../models/structure.ts";
import {RawStructure} from "../../components/structureviewer/molstar-utils.tsx";

const PREDICTED_DEFAULT_CHAIN = "A";

// encode a position in a protein chain using seqres numbering
export interface StructurePosition {
  labelAsymId: string;
  labelSeqId: number;
}

// Captures individual structure selection as pair of
// i) underlying structure map and ii) whether to load full structure or not
export interface SelectedStructureHit {
  targetToStructure: StructureAlignment;
  database: "pdb" | "afdb";
  structureId: string;
  chainId: string;
  useFullModel: boolean;
  useAssembly: boolean;
  assemblyId?: string;
  mapSeqToStruct?: Map<number, StructurePosition[]>;
  mapStructToSeq?: Map<string, number>;
}

export type SelectedStructureMap = Map<string, SelectedStructureHit>;

export interface StructureReducerAddPayload {
  selectedStructures: SelectedStructureHit[];
}

export interface StructureReducerAction {
  type: "SET";
  payload: StructureReducerAddPayload;
}

// helper function to prepare payload for reducer;
// note this applies a global setting about model/assembly use
// to individual structure selection as a simplifying assumption
// to create the payload; will retrieve individual assemblies
// per structure on the fly inside this function
export const createStructureSelectionPayload = (
  selectedStructureHits: StructureAlignment[],
  useFullModel: boolean,
  useAssembly: boolean,
): StructureReducerAction => {
  return {
    type: "SET",
    payload: {
      selectedStructures: selectedStructureHits.map((s) => {
        // const { canUseAssembly, assemblyId, assembly } = findPreferredAssembly(
        //  s,
        //  structureMaps,
        //);

        const fullId = s.target.split(/\s/)[0];
        const database = s.db.toLowerCase().startsWith("pdb") ? "pdb" : "afdb";
        const structureId = database === "pdb" ? fullId.split("-")[0] : fullId;
        const chainId =
          database === "pdb" ? fullId.split("_")[1] : PREDICTED_DEFAULT_CHAIN;

        const canUseAssembly = s.db.toLowerCase().startsWith("pdb");

        return {
          targetToStructure: s,
          database: database,
          structureId: structureId,
          chainId: chainId,
          useFullModel: useFullModel,
          useAssembly: useAssembly && canUseAssembly,
          // assemblyId: assemblyId,
          // assembly: assembly,
        };
      }),
    },
  };
};

/**
 * Generate unique identifier for a selected structure
 * @param sel Requested target structure and info if full chain should be used or not
 * than just the target chain
 */
export const structureSelectionId = (sel: SelectedStructureHit) => {
  const id = `${sel.structureId}:${sel.chainId}_${sel.targetToStructure.dbStartPos}-${sel.targetToStructure.dbEndPos}`;

  const suffix = sel.useFullModel
    ? sel.useAssembly
      ? "assembly"
      : "full"
    : "chain";

  return `${id}_${suffix}`;
};

// for now just very simple reducer that allows to set structures in bulk
// (i.e. only case where same state is returned would be if identical selection is
// given as payload), but might add more fine-grained options later on
export const structureSelectionReducer = (
  state: SelectedStructureMap,
  action: StructureReducerAction,
) => {
  const { type, payload } = action;
  switch (type) {
    // define new structure set
    case "SET":
      // construct new state based on mapping
      const newState = new Map<string, SelectedStructureHit>();
      payload.selectedStructures.forEach((sel) =>
        // newState.set(structureSelectionId(sel), expandPositionMapping(sel)),
        // note that for design server, we don't expand position mapping yet as we need to load structure
        // first to establish full mapping
        newState.set(structureSelectionId(sel), sel),
      );

      // if keys are identical to previous state, return old state, otherwise new
      if (
        Array.from(newState.keys()).every((k) => state.has(k)) &&
        Array.from(state.keys()).every((k) => newState.has(k))
      ) {
        return state;
      } else {
        return newState;
      }

    // default should never be reached
    default:
      throw new Error("Illegal reducer action specified");
  }
};

export const generateStructureQueries = (
  structureSelection: SelectedStructureMap,
) => {
  // iterate through selected structures to define queries and how they map to output
  const queries = Array.from(structureSelection).map(([id, sel]) => {
    let url: string;
    if (sel.database === "afdb") {
      // predicted AlphaFold structure
      url = `https://alphafold.ebi.ac.uk/files/${sel.structureId}.cif`;
    } else {
      // experimental PDB structure
      if (sel.useFullModel) {
        if (sel.useAssembly) {
          url = `https://www.ebi.ac.uk/pdbe/model-server/v1/${sel.structureId}/assembly?encoding=cif`;
          // append assembly id to retrieve specific assembly instead of default one (if defined);
          // note that "preferred" assembly is not necessarily assembly 1
          if (sel.assemblyId) {
            url += `&name=${sel.assemblyId}`;
          }
        } else {
          url = `https://files.rcsb.org/download/${sel.structureId}.cif`;
        }
      } else {
        // API spec here: https://www.ebi.ac.uk/pdbe/coordinates/#/
        // could switch to bcif but keep all text-based now for simplicity
        url = `https://www.ebi.ac.uk/pdbe/model-server/v1/${sel.structureId}/atoms?auth_asym_id=${sel.chainId}&encoding=cif`;
      }
    }

    return {
      queryKey: ["3d_structure", id],
      queryFn: () =>
        // axios.get<string>(url).then(
        fetch(url)
          .then((res) => {
            // raise errors so react query can catch them
            // https://tanstack.com/query/latest/docs/react/guides/query-functions#usage-with-fetch-and-other-clients-that-do-not-throw-by-default
            if (!res.ok) {
              throw new Error("Error fetching structure");
            }
            return res.text();
          })
          .then(
            (res): RawStructure => ({
              id: id,
              data: res,
              format: "mmcif",
              visible: true,
            }),
          ),
      staleTime: Infinity,
    };
  });

  return queries;
};

// /**
//  * Compute explicit position mapping between target sequence and structure
//  * @param s Structure for which target-to-structure mapping should be computed
//  * @returns New enhanced object with position mapping
//  */
// export const expandPositionMapping = (s: SelectedStructure) => {
//   // initialize mappings
//   const mapSeqToStruct = new Map<number, StructurePosition[]>();
//   const mapStructToSeq = new Map<string, number>();
//
//   // identify relevant chains
//   let chains: string[];
//
//   if (s.useAssembly) {
//     if (!s.assembly) {
//       throw new Error(
//         `No assembly specified for ${s.targetToStructure.pdb_id} but useAssembly is true`,
//       );
//     }
//
//     const targetEntity = s.assembly.entity_map
//       .filter((ent) => ent.is_target)
//       .at(0);
//     if (!targetEntity) {
//       throw new Error(
//         `Invalid assembly specification for ${s.targetToStructure.pdb_id}, at least one entity must have is_target be True`,
//       );
//     }
//
//     chains = targetEntity.assembly_chains;
//   } else {
//     // use assembly as a crutch to map to label_asym_id
//     if (s.targetToStructure.structure_type === "pdb") {
//       const targetEntity = s.assembly?.entity_map
//         .filter((ent) => ent.is_target)
//         .at(0);
//
//       // if we can't map through target entity (We should always be able to by construction, if assembly is available);
//       // otherwise, return empty chain set - will "grey out" structure
//       chains = targetEntity ? targetEntity.asym_chains : [];
//     } else {
//       // for predicted structure assume author ID = asym ID
//       chains = [s.targetToStructure.pdb_chain];
//     }
//   }
//
//   // iterate through continuous segments and expand into explicit position-wise mapping
//   for (const segment of s.targetToStructure.position_mapping) {
//     // initialize current position to start of segment in target and structure
//     let curT = segment.target_start;
//     let curS = segment.structure_start;
//
//     // go through segment step by step
//     while (curT <= segment.target_end) {
//       // encode chain/position pair as string for easy immutable lookup
//       for (const chain of chains) {
//         const encSeqres = encodeStructurePosSeqres(chain, curS);
//         mapStructToSeq.set(encSeqres, curT);
//       }
//
//       // for reverse map, we can leave value in structured form;
//       // create position list on structure side first;
//       // copy value from outside scope to silence ESlint warning
//       const labelSeqId = curS;
//       const m = chains.map((chain) => ({
//         // authAsymId: chain,
//         labelAsymId: chain,
//         labelSeqId: labelSeqId,
//       }));
//       // then assign to mapping
//       mapSeqToStruct.set(curT, m);
//
//       curT++;
//       curS++;
//     }
//   }
//
//   return {
//     ...s,
//     mapSeqToStruct: mapSeqToStruct,
//     mapStructToSeq: mapStructToSeq,
//   };
// };
