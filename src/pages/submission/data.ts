import {
  EntitySpec,
  Mutant,
  mutate,
  systemInstanceFromSystem,
  SystemInstanceSpec,
  validInstance,
  validMutants,
} from "../../models/design.ts";
import { GAP } from "../../utils/bio.ts";

export interface VerifiedDataset {
  rawDataSeries: string[];
  dataSeries: number[];
  dataSeriesInvalid: number[];
  rawMutantOrInstanceSeries: string[];
  isMutantSeries: boolean;
  instanceSeries: SystemInstanceSpec[];
  instanceSeriesInvalid: number[];
  fixedLength: boolean;
  containsDeletions: boolean;
  containsInsertions: boolean;
}

export interface VerifiedDatasets {
  datasets: VerifiedDataset[];
  // aggregations over individual datasets
  hasData: boolean;
  allValid: boolean;
  fixedLength: boolean;
  containsDeletions: boolean;
  containsInsertions: boolean;
}

export interface RawDataset {
  name: string;
  fields: string[];
  rows: object[];
  sequenceCol: string;
  dataCol: string;
}

export const WILDTYPE_NAMES = ["", "wt", "wildtype", "wild-type"];
export const WILDTYPE_DEFAULT_NAME = "wt";

export const parseDataSeries = (series: string[]) => {
  // try to parse all values; Number will trim whitespace internally
  const seriesParsed = series.map((value) => Number(value));

  // extract all invalid indices in original series
  const invalidIdx = seriesParsed
    .map((value, idx) => (isNaN(value) ? idx : undefined))
    .filter((idx) => idx !== undefined);

  return {
    dataSeries: seriesParsed,
    dataSeriesInvalid: invalidIdx,
  };
};

/*
Note: For simplicity, does currently not handle multi-entity case, assumes fixed entity for
which mutants or sequences are specified. Will need to encode entity information
in input by entity index or id as a prefix (e.g., 0:M180T)

Allows the same sequences/mutants to be present multiple times so biological replicate information
can be input for training / testing
 */
export const parseMutantOrInstanceSeries = (
  mutantsOrInstances: string[],
  system: EntitySpec[],
  entity: number = 0,
) => {
  // need at least one mutant or entity instance sequence in the following
  if (mutantsOrInstances.length === 0) {
    throw new Error("No mutants or instances specified");
  }

  // guess if mutants or sequences specified based on whether a number is present
  // in string somewhere, if so, assume mutants, otherwise assume sequences; all other
  // elements in the list are assumed to be the same (will fail verification otherwise)
  const isMutantSeries = mutantsOrInstances.some(
    (cur) => cur.match(/\d/) !== null,
  );

  // create WT instance for mutant testing
  const targetInstance = systemInstanceFromSystem(system);

  let fixedLength = true;
  let containsInsertions = false;
  let containsDeletions = false;

  // record instances and invalid indices
  const instances: SystemInstanceSpec[] = [];
  const invalidIdx: number[] = [];

  mutantsOrInstances.forEach((curMutantOrInstance, i) => {
    // remove any whitespace
    const moi = curMutantOrInstance.trim();

    if (isMutantSeries) {
      // lowercase mutant first for easy identification of WT names
      const moiLc = moi.toLowerCase();
      const parsedMutant: Mutant = [];
      let validParsing = true;

      // if not wildtype, try to parse piece by piece
      if (!WILDTYPE_NAMES.includes(moiLc)) {
        // split multiple mutations in mutant on any whitespace or underscore;
        // note: do not use lowercase variant here as lowercase symbol codes for insertions
        const mutantSplit = moi.split(/[\s_]+/);

        mutantSplit.forEach((mutation) => {
          // parse individual mutations here
          const mutationPattern = /^([A-Z]?)(\d+)([A-Za-z\-])$/;
          const match = mutation.match(mutationPattern);

          if (match) {
            const [, ref, posStr, to] = match;
            const pos = parseInt(posStr, 10);
            parsedMutant.push({
              entity: entity,
              pos: pos,
              ref: ref,
              to: to,
            });
          } else {
            validParsing = false;
            return;
          }
        });
      }

      // verify mutant against target instance
      const mutantValidation = validMutants(
        system,
        targetInstance,
        [parsedMutant],
        true,
        true,
      );

      if (validParsing && mutantValidation.valid) {
        // apply mutation (creates deep copy)
        const curInstance = mutate(system, targetInstance, [parsedMutant])[0];

        // attach mutant as identifier and store instance
        curInstance.id =
          parsedMutant.length > 0
            ? parsedMutant
                .map((m) => `${m.entity}:${m.ref}${m.pos}${m.to}`)
                .join("_")
            : WILDTYPE_DEFAULT_NAME;
        instances.push(curInstance);
      } else {
        invalidIdx.push(i);
      }

      // update insertion/deletion/length status
      containsInsertions =
        containsInsertions || parsedMutant.some((m) => m.ref === "");
      containsDeletions =
        containsDeletions || parsedMutant.some((m) => m.to === GAP);
      fixedLength = fixedLength && !containsInsertions;
    } else {
      // copy instance
      const curInstance = structuredClone(targetInstance);

      // update representation of specified entity
      curInstance.entity_instances[entity].rep = moi;

      // validate instance
      if (validInstance(system, curInstance, true, true, false, true)) {
        instances.push(curInstance);
      } else {
        // only push invalid index in *source* list here, do not record invalid instance in parsed list
        invalidIdx.push(i);
      }

      // may need to revisit these checks, in input we won't necessarily have insertions coded properly as
      // lowercase letters
      containsInsertions = containsInsertions || /[a-z]/.test(moi);
      containsDeletions = containsDeletions || moi.includes(GAP);
      fixedLength =
        fixedLength &&
        moi.length === targetInstance.entity_instances[entity].rep.length;
    }
  });

  return {
    isMutantSeries: isMutantSeries,
    instanceSeries: instances,
    instanceSeriesInvalid: invalidIdx,

    fixedLength: fixedLength,
    containsDeletions: containsDeletions,
    containsInsertions: containsInsertions,
  };
};

export const verifyRawDatasets = (
  datasets: RawDataset[],
  system: EntitySpec[],
): VerifiedDatasets => {
  const verified = datasets.map((curDataset) => {
    const extractedMutantSeries: string[] = curDataset.rows.map(
      (row) => row[curDataset.sequenceCol as keyof typeof row],
    );
    const extractedDataSeries: string[] = curDataset.rows.map(
      (row) => row[curDataset.dataCol as keyof typeof row],
    );
    return {
      rawDataSeries: extractedDataSeries,
      ...parseDataSeries(extractedDataSeries),
      rawMutantOrInstanceSeries: extractedMutantSeries,
      ...parseMutantOrInstanceSeries(extractedMutantSeries, system),
    };
  });

  return {
    datasets: verified,
    // compute agggregations acros all datasets
    hasData: verified.length > 0,
    allValid: verified.every(
      (ds) =>
        ds.dataSeriesInvalid.length === 0 &&
        ds.instanceSeriesInvalid.length === 0,
    ),
    fixedLength: verified.every((ds) => ds.fixedLength),
    containsDeletions: verified.some((ds) => ds.containsDeletions),
    containsInsertions: verified.some((ds) => ds.containsInsertions),
  };
};
