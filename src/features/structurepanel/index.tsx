import {
  AtomInfo,
  RawStructure,
  Representation,
  StructureHandle,
} from "../../components/structureviewer/molstar-utils.tsx";
import { Color } from "molstar/lib/mol-util/color";
import { StructureAlignment } from "../../models/structure.ts";
import {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  createMolstarClickHandler,
  createStructureSelectionPayload,
  generateStructureQueries,
  SelectedStructureHit,
  structureSelectionReducer,
} from "./reducers.ts";
import {
  extractMappings,
  makeMolstarColorCallback,
  mapSiteHighlights,
  rankStructureHits,
  selectDefaultStructureHits,
  SiteHighlightTargetPos,
} from "./data.ts";
import { useQueries } from "@tanstack/react-query";
import {
  Molstar,
  MolstarHandle,
} from "../../components/structureviewer/molstar.tsx";
import { ModifiersKeys } from "molstar/lib/mol-util/input/input-observer";
import { PositionColorCallback } from "../../utils/colormap.ts";

export const DEFAULT_STYLE: Representation[] = [
  {
    component: "protein",  // protein_calpha
    props: {
      // type: "spacefill",
      type: "cartoon",
      color: "sequence-id",
      // color: "sequencemap-custom",
      // color: "secondary-structure",
      // colorParams: { default: Color(0xff0000) },
      //
      // color: "sequence-id",
      // colorParams: def,

      // size: "uniform",
      // sizeParams: { value: 1 },
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
  structureStyle: Representation[];
  structureHits: StructureAlignment[];
  firstIndex: number;
  useFullStructureModel: boolean;
  useStructureAssembly: boolean;
  backgroundColor: string;
  handleClick?: (
    pos: number | null,
    modifiers: ModifiersKeys,
    button: number,
    buttons: number,
    atomInfo: AtomInfo[],
  ) => void;
  colorCallback?: PositionColorCallback;
  siteHighlights?: SiteHighlightTargetPos[];
  loadingOverlay?: ReactNode;
  errorOverlay?: ReactNode;
}

/*
 Wrapper around Molstar component that connects "raw" viewer to structure loading, selection and mapping
 */
export const StructurePanel = ({
  structureStyle,
  structureHits,
  firstIndex,
  backgroundColor = "white",
  useFullStructureModel = true,
  useStructureAssembly = true,
  handleClick = undefined,
  colorCallback = undefined,
  siteHighlights = undefined,
  loadingOverlay = undefined,
  errorOverlay = undefined,
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

  const anyLoading = structures.filter((q) => q.isLoading).length > 0;
  const anyError = structures.filter((q) => q.isError).length > 0;

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

  // set up click handler for Molstar (needs to transform from structure coords to target seq coords),
  // needs to be updated whenever structure selection with mapping changes
  const molstarClickHandler = useMemo(
    () => createMolstarClickHandler(structureSelectionWithMapping, handleClick),
    [structureSelectionWithMapping, handleClick],
  );

  const molstarColorMap = useMemo(
    () =>
      makeMolstarColorCallback(structureSelectionWithMapping, colorCallback),
    [structureSelectionWithMapping],
  );

  const siteHighlightsMapped = useMemo(
    () => mapSiteHighlights(siteHighlights, structureSelectionWithMapping),
    [siteHighlights, structureSelectionWithMapping],
  );

  const molstarRef = useRef<MolstarHandle>(null);
  const overlay = anyError ? errorOverlay : anyLoading ? loadingOverlay : null;
  
  return (
    <>
      <Molstar
        structures={loadedStructures}
        representations={structureStyle}
        siteHighlights={siteHighlightsMapped}
        pairHighlights={[]} // pass as empty by default for now since only using site highlights in application
        showAxes={false}
        backgroundColor={Color.fromHexStyle(backgroundColor)}
        ref={molstarRef}
        getData={mappingExtractor}
        handleClick={molstarClickHandler}
        colorMap={molstarColorMap}
      />
      {overlay}
    </>
  );
};
