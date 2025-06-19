import {
  RawStructure,
  Representation,
  StructureHandle,
} from "../../components/structureviewer/molstar-utils.tsx";
import { Color } from "molstar/lib/mol-util/color";
import { StructureAlignment } from "../../models/structure.ts";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  createStructureSelectionPayload,
  generateStructureQueries,
  SelectedStructureHit,
  structureSelectionReducer,
} from "../../pages/results/reducers.ts";
import {
  extractMappings,
  rankStructureHits,
  selectDefaultStructureHits,
} from "../../pages/results/data.ts";
import { useQueries } from "@tanstack/react-query";
import {
  Molstar,
  MolstarHandle,
} from "../../components/structureviewer/molstar.tsx";

const DEFAULT_STYLE: Representation[] = [
  {
    component: "protein",
    props: {
      type: "cartoon",
      color: "sequence-id",
      // color: "sequencemap-custom",
      // color: "secondary-structure",
      // colorParams: { default: Color(0xff0000) },
      //
      // color: "sequence-id",
      // colorParams: def,
    },
    // props: { type: "cartoon", color: "residue-id", colorParams: def },
  },
  {
    component: "ligand",
    props: {
      type: "ball-and-stick",
      color: "uniform",
      colorParams: { value: Color(0x676767) },
    },
  },
];

export interface StructurePanelProps {
  structureHits: StructureAlignment[];
  firstIndex: number;
  useFullStructureModel: boolean;
  useStructureAssembly: boolean;
  backgroundColor: string;
}

/*
 Wrapper around Molstar component that connects "raw" viewer to structure loading, selection and mapping
 */
export const StructurePanel = ({
  structureHits,
  firstIndex,
  backgroundColor = "white",
  useFullStructureModel = true,
  useStructureAssembly = true,
}: StructurePanelProps) => {
  // initialize structure selection reducer
  const [structureSelection, dispatchStructureSelection] = useReducer(
    structureSelectionReducer,
    new Map<string, SelectedStructureHit>(),
  );

  // rank available structure information
  const structureHitsSorted = useMemo(
    () => rankStructureHits(structureHits),
    [structureHits],
  );

  // initialize structure selection based on available structures;
  // note this will automatically reset the structure selection if we navigate to a new protein page
  useEffect(() => {
    const payload = createStructureSelectionPayload(
      selectDefaultStructureHits(structureHitsSorted),
      useFullStructureModel,
      useStructureAssembly,
    );
    dispatchStructureSelection(payload);
  }, [structureHitsSorted, useFullStructureModel, useStructureAssembly]);

  // fetch structure coordinates, then filter down to loaded structures
  const structures = useQueries({
    queries: generateStructureQueries(structureSelection),
  });

  const loadedStructures = structures
    .filter((s) => s.isSuccess)
    .map((s) => s.data as RawStructure);

  // holds structure hits with mappings once 3D info is loaded
  const [structureSelectionWithMapping, setStructureSelectionWithMapping] =
    useState<Map<string, SelectedStructureHit>>();

  // establish position mappings based on loaded structures via callback
  const mappingExtractor = useCallback(
    (structures: StructureHandle[]) =>
      setStructureSelectionWithMapping(
        extractMappings(structures, structureSelection, firstIndex),
      ),
    [structureSelection, setStructureSelectionWithMapping],
  );

  const molstarRef = useRef<MolstarHandle>(null);

  return (
    <Molstar
      structures={loadedStructures}
      representations={DEFAULT_STYLE}
      siteHighlights={[]}
      pairHighlights={[]}
      showAxes={false}
      backgroundColor={Color.fromHexStyle(backgroundColor)}
      ref={molstarRef}
      getData={mappingExtractor}
      // handleClick={(s) => console.log("click", s.atomInfo[0])}
    />
  );
};
