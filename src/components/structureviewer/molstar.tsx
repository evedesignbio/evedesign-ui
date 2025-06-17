/*
  React Wrapper around Mol* structure viewer
  
  Basic init based on https://github.com/samirelanduk/molstar-react  
  
  Relevant documentation:
  General plugin integration: https://molstar.org/docs/plugin/#plugincontext-without-built-in-react-ui
  Basic React integration information: https://github.com/molstar/molstar/issues/226
*/
import React, {
  useEffect,
  useRef,
  MutableRefObject,
  useImperativeHandle,
  useState,
} from "react";
// import useResizeObserver from "use-resize-observer";  // not needed anymore due to Mol* handling resizing
// import { useDebouncedCallback } from "use-debounce";   // not needed anymore due to Mol* handling resizing
import { DefaultPluginSpec, PluginSpec } from "molstar/lib/mol-plugin/spec";
import { PluginBehaviors } from "molstar/lib/mol-plugin/behavior";
import { PluginContext } from "molstar/lib/mol-plugin/context";
import { ColorName } from "molstar/lib/mol-util/color/names";
import { Color } from "molstar/lib/mol-util/color";

import "molstar/build/viewer/molstar.css";
import {
  updateStructures,
  updateStructureVisibility,
  createSiteHighlightComponents,
  buildRepresentations,
  StructureHandle,
  addEventHandler,
  MolstarEventHandler,
  toggleAxes,
  setColors,
  toggleStereo,
} from "./molstar-utils";

// import and re-export following types for easier import of component together
// with relevant types for functions
import type {
  RawStructure,
  AtomInfo,
  MolstarEventHandlerArgs,
  Representation,
  ColorMapHandle,
  SuperpositionMethod,
  SiteHighlight,
  PairHighlight,
  DataUpdateCallback,
} from "./molstar-utils";
import type { ColorCallback } from "./molstar-color";

// reexport own viewer types defined in utils file for coherent import experience
export type {
  RawStructure,
  AtomInfo,
  MolstarEventHandlerArgs,
  Representation,
  ColorCallback,
  SuperpositionMethod,
  SiteHighlight,
  PairHighlight,
  DataUpdateCallback,
  StructureHandle,
};

// export Mol* color fields so user can specify right types
// without having to import from indirect dependency
// export type { Color, ColorName, ColorNames };

type ViewerProps = {
  structures: RawStructure[];
  representations: Representation[];
  siteHighlights: SiteHighlight[];
  pairHighlights: PairHighlight[];
  colorMap?: ColorCallback;
  handleClick?: MolstarEventHandler;
  handleHover?: MolstarEventHandler;
  showAxes?: boolean;
  backgroundColor?: Color | ColorName;
  selectColor?: Color | ColorName;
  highlightColor?: Color | ColorName;
  resizeDebounceTime?: number;
  superpositionMethod?: SuperpositionMethod;
  stereo?: boolean;
  resetCameraKey?: number;
  getRefs?: (
    pluginRef: MutableRefObject<PluginContext | null>,
    structureRef: MutableRefObject<StructureHandle[]>
  ) => void;
  getData?: DataUpdateCallback;
};

// https://stackoverflow.com/questions/62210286/declare-type-with-react-useimperativehandle
export type MolstarHandle = {
  resetCamera: () => void;
  downloadScreenshot: (filename?: string) => void;
  copyScreenshot: () => void;
};

// const DEFAULT_DEBOUNCE_TIME = 50;

/**
 * React component wrapping around Mol* molecular structure viewer
 *
 * @param props: Behavior of props on expensive component updates:
 * - structures: Shallow change will trigger structure cascade. The .id property is used to perform a diff on already loaded vs updated structures
 * - representations: Shallow change will trigger structure cascade *and* representation updates on the actual structures (expensive).
 * - siteHighlights: Shallow change will trigger structure cascade. Current vs updated highlights are diffed using a string-based identifier approach.
 * - colorMap (expensive): Shallow change will trigger structure cascade, *and* representation updates on all structures (expensive).
 * - superpositionMethod: Will trigger structure cascade, but will not affect structures already loaded.
 */
export const Molstar = React.forwardRef<MolstarHandle, ViewerProps>(
  (
    {
      structures,
      representations,
      siteHighlights,
      pairHighlights,
      handleClick,
      handleHover,
      colorMap = undefined,
      superpositionMethod = "alignAndSuperpose",
      showAxes = false,
      backgroundColor = "white",
      selectColor = "red",
      highlightColor = "red",
      // resizeDebounceTime = DEFAULT_DEBOUNCE_TIME,
      stereo = false,
      resetCameraKey = 0,
      getRefs = undefined,
      getData = undefined,
    }: ViewerProps,
    ref
  ) => {
    const parentRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const plugin = useRef<PluginContext | null>(null);
    const [initialized, setInitialized] = useState(false);
    const structureHandlesRef = useRef<StructureHandle[]>([]);
    const colorMapRef = useRef<ColorMapHandle>({
      callback: undefined,
      registryObject: undefined,
    });
    // const siteHighlightsRef = useRef<SiteHighlight[]>();

    // note: resizing disabled compared to popEVE version, this now appears to
    //  be handled by Mol* internally
    //
    // // observe resizes of parent div to trigger plugin resize;
    // // plugin also listens to window resize events so could use () => window.dispatchEvent(new Event("resize"))
    // // call is debounced to avoid stutter
    // const debouncedResize = useDebouncedCallback(({ width, height }) => {
    //   // only resize if we have defined size (e.g. don't resize if a containing tab is hidden)
    //   if (!width || !height) return;
    //   // console.log("##### RESIZE", width, height);
    //   plugin.current?.handleResize();
    // }, resizeDebounceTime);
    //
    // useResizeObserver({
    //   ref: parentRef,
    //   onResize: debouncedResize,
    // });

    // console.log("Rendering Mol*", initialized);

    /*
    ================================================================================================
    General initialization
    ================================================================================================
  */

    // Initialize plugin
    useEffect(() => {
      const init = async () => {
        // console.log("### init viewer ###", parentRef, canvasRef);

        // define plugin behavior using spec
        const pluginSpec = {
          ...DefaultPluginSpec(),
          behaviors: [
            PluginSpec.Behavior(PluginBehaviors.Representation.HighlightLoci),
            PluginSpec.Behavior(PluginBehaviors.Representation.SelectLoci),
            // PluginSpec.Behavior(PluginBehaviors.Representation.FocusLoci), // highlight context around focus
            // PluginSpec.Behavior(PluginBehaviors.Camera.FocusLoci), // zoom in in focus
            PluginSpec.Behavior(PluginBehaviors.Camera.CameraAxisHelper),
          ],
        };

        // perform initialization
        plugin.current = new PluginContext(pluginSpec);

        // useEffect is only run after first render when refs are set, so safe to indicate so
        plugin.current.initViewer(canvasRef.current!, parentRef.current!);
        await plugin.current.init();

        // modify screenshot settings (transparent background)
        // https://github.com/molstar/molstar/blob/eae7c11c55cf7a9fa95a5fe22291f60ccfe58b89/src/mol-plugin/util/viewport-screenshot.ts
        // https://github.com/molstar/molstar/blob/3b1513adc0048dc4879f1d70874b3e56aaffd10e/src/mol-plugin-ui/viewport/screenshot.tsx
        plugin.current.helpers.viewportScreenshot?.behaviors.values.next({
          ...plugin.current.helpers.viewportScreenshot?.behaviors.values.getValue(),
          transparent: true,
          resolution: { name: "ultra-hd", params: {} },
        });

        // store that we initialized the viewer
        setInitialized(true);
      };

      init();

      // return cleanup function
      return () => {
        // only destroy plugin in production mode, hot reloading in dev mode causes severe issues
        // with this call (use vite special variable to check if we are in production mode)
        if (import.meta.env.PROD) {
          plugin.current!.dispose();
        }

        // dispose references
        plugin.current = null;
        structureHandlesRef.current = [];
      };
    }, []);

    // allow outer components to obtain reference to plugin
    useEffect(() => {
      if (getRefs && plugin && structureHandlesRef) {
        getRefs(plugin, structureHandlesRef);
      }
    }, [getRefs]);

    // toggle axes control
    useEffect(() => {
      if (plugin.current) {
        toggleAxes(plugin.current, showAxes);
      }
    }, [initialized, showAxes]);

    // toggle stereo camera
    useEffect(() => {
      // console.log("!!! set stereo", stereo);
      if (plugin.current) {
        toggleStereo(plugin.current, stereo);
      }
    }, [initialized, stereo]);

    // set various color parameters on canvas
    useEffect(() => {
      // console.log("*** set colors");
      if (plugin.current) {
        setColors(plugin.current, backgroundColor, highlightColor, selectColor);
      }
    }, [initialized, backgroundColor, highlightColor, selectColor]);

    // reset camera (triggered by changing updateKey, and value has to be greater than 0)...
    // Can also be achieved using newly added imperative handling function below
    useEffect(() => {
      if (resetCameraKey > 0 && plugin.current) {
        plugin.current.managers.camera.reset();
      }
    }, [resetCameraKey]);

    // https://stackoverflow.com/questions/62210286/declare-type-with-react-useimperativehandle
    useImperativeHandle(ref, () => ({
      resetCamera() {
        if (plugin.current) {
          plugin.current.managers.camera.reset();
        }
      },
      async downloadScreenshot(filename) {
        if (plugin.current) {
          plugin.current.helpers.viewportScreenshot?.download(filename);
        }
      },
      async copyScreenshot() {
        if (plugin.current) {
          plugin.current.helpers.viewportScreenshot?.copyToClipboard();
        }
      },
    }));

    /*
    ================================================================================================
    Event handlers
    
    Note: kept checks on valid values out of addEventHandler for clarify, even if it
    creates some repeated boilerplate code

    plugin.current.behaviors.labels.highlight
    plugin.current.behaviors.interaction.click
    plugin.current.behaviors.interaction.hover e -> e.labels
    ================================================================================================
  */
    useEffect(() => {
      if (
        initialized &&
        plugin.current &&
        structureHandlesRef.current &&
        handleClick
      ) {
        return addEventHandler(
          plugin.current,
          structureHandlesRef.current,
          plugin.current.behaviors.interaction.click,
          handleClick
        );
      }
    }, [initialized, handleClick]);

    useEffect(() => {
      if (
        initialized &&
        plugin.current &&
        structureHandlesRef.current &&
        handleHover
      ) {
        return addEventHandler(
          plugin.current,
          structureHandlesRef.current,
          plugin.current.behaviors.interaction.hover,
          handleHover
        );
      }
    }, [initialized, handleHover]);

    /*
    ================================================================================================
    Structure loading and styling
    ================================================================================================
  */
    useEffect(() => {
      // only load structures once plugin is initialized;
      // note this will also set representations right away
      if (initialized && plugin.current && structures) {
        const loadAndPaint = async () => {
          // First load models, build structures and superimpose;
          // Behaviour to load/delete structure objects is based on evaluation on the id property of
          // each raw structure (i.e. shallow changes to structure will only trigger this useEffect,
          // but not have an effect on the update behavior)
          const dataChanged = await updateStructures(
            plugin.current!,
            structureHandlesRef.current,
            structures,
            superpositionMethod
          );

          updateStructureVisibility(
            plugin.current!,
            structureHandlesRef.current,
            structures
          );

          // first build components for site highlights after all structures are present;
          // we will update representations in second go together with all other representations
          // so there are no rendering artifacts ("flickering"/step-wise appearance).
          // Representations are diffed inside using a string-based ID approach. No further checking
          // if this should be run outside, as this function will typically be the one that is triggered
          // most often, and depends on new structures being loaded
          await createSiteHighlightComponents(
            plugin.current!,
            structureHandlesRef.current,
            siteHighlights
          );

          // Note we will always want to run this without a shallow reference check,
          // as there is somewhat more complex logic: if colormap changes, we will
          // need to trigger a representation update anyways, even if representation
          // itself hasn't changed. Also, newly added structures will need to have
          // their representations built as well.
          await buildRepresentations(
            plugin.current!,
            structureHandlesRef.current,
            representations,
            siteHighlights,
            pairHighlights,
            colorMapRef.current,
            colorMap
          );

          // trigger data callback to notify outside world about new data state
          if (getData && dataChanged) {
            getData(structureHandlesRef.current);
          }
        };

        // execute above async wrapper
        loadAndPaint();
      }
    }, [
      initialized,
      structures,
      superpositionMethod,
      representations,
      siteHighlights,
      pairHighlights,
      colorMap,
      getData,
    ]);

    /*
    ================================================================================================
    Rendering
    ================================================================================================
  */
    // note absolute position (rather than width/height 100%) should work better with flexboxes
    // wrapping around this component
    return (
      <div
        ref={parentRef}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      >
        <canvas
          ref={canvasRef}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />
      </div>
    );
  }
);
