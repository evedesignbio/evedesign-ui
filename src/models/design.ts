import { StructureAlignment } from "./structure.ts";
import {
  GAP,
  MASK,
  VALID_AA_OR_GAP_SORTED,
  VALID_AA_SORTED,
  VALID_DNA_OR_GAP_SORTED,
  VALID_DNA_SORTED,
  VALID_RNA_OR_GAP_SORTED,
  VALID_RNA_SORTED,
} from "../utils/bio.ts";

export interface SequenceMetadata {
  seqspace_projection?: number[];
  taxonomy_id?: number;
  taxonomy_lineage?: string;
}

export type BioPolymer = "protein" | "dna" | "rna";
export const BioPolymerValues = ["protein", "dna", "rna"];

export interface Sequence {
  seq: string;
  id: string | null;
  key: string | null;
  type: BioPolymer;
  metadata: SequenceMetadata | null;
}

export interface SequencesSpec {
  seqs: Sequence[];
  aligned: boolean;
  type: string;
  weights: number[] | null;
  format: string;
}

export interface EntitySpec {
  type: string;
  rep: string;
  id: string;
  first_index: number;
  sequences: SequencesSpec | null;
}

export interface EntityInstanceSpec {
  rep: string;
  models: object | null;
}

export interface Mutation {
  entity: number;
  pos: number;
  ref: string;
  to: string;
}

export type Mutant = Mutation[];

export interface SystemInstanceMetadata {
  seqspace_projection?: number[];
}

export interface SystemInstanceSpec {
  entity_instances: EntityInstanceSpec[];
  score: number | null;
  confidence: number | null;
  metadata: SystemInstanceMetadata | null;
  id: string | null;
}

export interface SystemInstanceSpecEnhanced extends SystemInstanceSpec {
  id: string;
  mutant: Mutant;
  seqMap?: Map<string, string>;
  count: number;
}

export const systemInstanceFromSystem = (
  system: EntitySpec[],
): SystemInstanceSpec => {
  return {
    entity_instances: system.map((entity) => ({
      rep: entity.rep,
      models: null,
    })),
    score: null,
    confidence: null,
    metadata: null,
    id: null,
  };
};

export interface LabeledInstanceDatasetSpec {
  instances: SystemInstanceSpec[];
  labels: Record<string, (number | null)[]>;
}

export interface LabeledInstanceTrainTestDatasetSpec {
  training_set: LabeledInstanceDatasetSpec;
  test_set: LabeledInstanceDatasetSpec | null;
}

export interface JobSpecMetadata {
  msa_search_job_id: string;
  structure_search_job_id: string;
  structure_search_result: StructureAlignment[];
}

export interface GenerateArgsSpec {
  num_designs: number;
  entities: number[] | null;
  fixed_pos: Record<number, number[]> | null;
  temperature: number;
  deletions: boolean;
}

export interface GenerationStepSpec {
  key: "generate";
  generator: object;
  args: GenerateArgsSpec;
}

export interface PipelineSpec {
  key: "pipeline";
  schema_version: string;
  metadata: JobSpecMetadata | null;
  system: EntitySpec[];
  system_instances: SystemInstanceSpec[] | null;
  steps: GenerationStepSpec[]; // TODO: implement other step types from backend
}

export interface SingleMutationScanSpec {
  key: "single_mutation_scan";
  schema_version: string;
  system: EntitySpec[];
  system_instance: SystemInstanceSpec;
  scorer: object;
  entity: number | null;
  positions: number[] | null;
  metadata: JobSpecMetadata | null;
}

export interface SingleMutWithScore {
  to: string;
  score: number;
}

export interface SingleMutationScanResult {
  entity: number;
  pos: number;
  ref: string;
  subs: SingleMutWithScore[];
}

export interface ProteinToDnaOptimizerArgsSpec {
  system: EntitySpec[];
  system_instances: SystemInstanceSpec[];
  entity: number;
  upstream_dna: string;
  downstream_dna: string;
  reference: SystemInstanceSpec | null;
  reference_dna: string | null;
}

export type CodonOptimizationMethod = "use_best_codon" | "match_codon_usage";

export interface DnaChiselArgsSpec {
  method: CodonOptimizationMethod;
  codon_usage_table: string; // do not use literal as we might allow TaxIDs as well eventually
  avoid_sites: string[];
  gc_min: number | null;
  gc_max: number | null;
  gc_window: number | null;
  max_homopolymer_length: number | null;
  max_repeat_length: number | null;
  avoid_hairpins: boolean;
  genetic_code: "Standard";
}

export interface DnaChiselSpec {
  key: "dnachisel";
  variant: "default";
  args: DnaChiselArgsSpec;
}

export interface ProteinToDnaSpec {
  key: "protein_to_dna";
  schema_version: string;
  optimizer: DnaChiselSpec;
  args: ProteinToDnaOptimizerArgsSpec;
}

export interface ProteinToDnaResult {
  rep: string;
  dna: string;
  score: number | null;
}

export interface Position {
  entity: number;
  pos: number;
}

export type InputSpecTypeKeys =
  | "pipeline"
  | "single_mutation_scan"
  | "protein_to_dna";

// equivalent of protdesign.entity.Entity.alphabet()
export const alphabet = (
  entity: EntitySpec,
  includeGap: boolean = true,
  includeInserts: boolean = true,
): string[] => {
  let a: string[];
  if (entity.type === "protein") {
    a = includeGap ? VALID_AA_OR_GAP_SORTED : VALID_AA_SORTED;
  } else if (entity.type === "dna") {
    a = includeGap ? VALID_DNA_OR_GAP_SORTED : VALID_DNA_SORTED;
  } else if (entity.type === "rna") {
    a = includeGap ? VALID_RNA_OR_GAP_SORTED : VALID_RNA_SORTED;
  } else {
    throw new Error(`Alphabet for type ${entity.type} not implemented`);
  }

  if (includeInserts) {
    a = [...a, ...a.filter((s) => s !== GAP).map((s) => s.toLowerCase())];
  }

  return a;
};

// equivalent of protdesign.sequence.valid_sequence()
export const validSequence = (
  seq: string,
  alphabet: string[],
  allowMask: boolean = false,
) => {
  const invalid = [...seq]
    .map((symbol, i) =>
      !(alphabet.includes(symbol) || (allowMask && symbol === MASK))
        ? { pos: i, symbol: symbol }
        : undefined,
    )
    .filter((e) => e !== undefined);

  return {
    valid: invalid.length === 0,
    invalidPos: invalid,
  };
};

// equivalent of protdesign.entity.System.valid_instance(), but simplified to only
// validate rep for now but not embeddings or models
export const validInstance = (
  system: EntitySpec[],
  instance: SystemInstanceSpec,
  validateReps: boolean = true,
  requireReps: boolean = false,
  // validateEmbeddings: boolean = true,
  fixedLength: boolean = true,
  allowDeletions: boolean = false,
) => {
  let valid = system.length === instance.entity_instances.length;

  system.forEach((entity, entityIdx) => {
    const entityInstance = instance.entity_instances[entityIdx];
    // verification for biopolymer entities
    if (BioPolymerValues.includes(entity.type)) {
      if (fixedLength) {
        valid =
          valid &&
          (entity.rep === null ||
            (entityInstance.rep !== null &&
              entityInstance.rep.length === entity.rep.length));
      }

      if ((validateReps && entityInstance.rep !== null) || requireReps) {
        const isValidSeq =
          entityInstance.rep !== null &&
          validSequence(
            entityInstance.rep,
            alphabet(entity, allowDeletions, !fixedLength),
            false,
          ).valid;

        valid = valid && isValidSeq;
      }
    }
  });

  return valid;
};

// equivalent of protdesign.entity.System._entity_to_pos_and_subs()
export const entityToPosAndSubs = (
  system: EntitySpec[],
  instance: SystemInstanceSpec,
  deletions: boolean = false,
  insertions: boolean = false,
) => {
  const entityToPos = new Map<number, Map<number, string>>();

  // create mapping of valid position and reference symbol in each biopolymer entity instance with defined
  // sequence and first_index
  system.forEach((entity, entityIdx) => {
    const entityInstance = instance.entity_instances[entityIdx];
    if (
      !BioPolymerValues.includes(entity.type) ||
      entity.first_index === null ||
      entityInstance.rep === null
    )
      return;

    const posToRef = new Map<number, string>();
    [...entityInstance.rep].forEach((symbol, pos) => {
      posToRef.set(pos + entity.first_index, symbol);
    });
    entityToPos.set(entityIdx, posToRef);
  });

  // also record possible positions for insertion including N-terminal of first_index
  const entityToInsPos = new Map<number, number[]>();
  entityToPos.forEach((_posToRef, entityIdx) => {
    if (insertions) {
      const allPos = [..._posToRef.keys()];
      entityToInsPos.set(entityIdx, [Math.min(...allPos) - 1, ...allPos]);
    } else {
      entityToInsPos.set(entityIdx, []);
    }
  });

  // entity to valid substitutions
  const entityToValidSubs = new Map<number, string[]>();
  entityToPos.forEach((_posToRef, entityIdx) => {
    const entityAlphabet = alphabet(system[entityIdx], deletions, insertions);
    entityToValidSubs.set(entityIdx, entityAlphabet);
  });

  return {
    entityToPos: entityToPos,
    entityToInsPos: entityToInsPos,
    entityToValidSubs: entityToValidSubs,
  };
};

// equivalent of protdesign.entity.System.valid_mutants()
export const validMutants = (
  system: EntitySpec[],
  instance: SystemInstanceSpec,
  mutants: Mutant[],
  deletions: boolean = false,
  insertions: boolean = false,
) => {
  const { entityToPos, entityToInsPos, entityToValidSubs } = entityToPosAndSubs(
    system,
    instance,
    deletions,
    insertions,
  );

  const invalidSubs: { mutantIdx: number; mutation: Mutation }[] = [];

  mutants.forEach((mutant, mutantIdx) => {
    mutant.forEach((mutation, _mutationIdx) => {
      const invalid =
        // valid entity
        !entityToPos.has(mutation.entity) ||
        // valid change
        !entityToValidSubs.get(mutation.entity)?.includes(mutation.to) ||
        // insertion
        (mutation.ref === "" &&
          (!entityToInsPos.get(mutation.entity)!.includes(mutation.pos) ||
            mutation.to === GAP ||
            mutation.to.toLowerCase() !== mutation.to)) ||
        // mutation/deletion
        (mutation.ref !== "" &&
          (!entityToPos.get(mutation.entity)!.has(mutation.pos) ||
            mutation.ref !==
              entityToPos.get(mutation.entity)!.get(mutation.pos) ||
            mutation.to.toUpperCase() !== mutation.to));

      if (invalid) {
        invalidSubs.push({ mutantIdx: mutantIdx, mutation: mutation });
      }
    });
  });

  return {
    valid: invalidSubs.length === 0,
    invalidSubs: invalidSubs,
  };
};

// full functional equivalent of protdesign.entity.System.mutate()
export const mutate = (
  system: EntitySpec[],
  instance: SystemInstanceSpec,
  mutants: Mutant[],
) => {
  return mutants.map((mutant) => {
    // make deep copy even if we shallow copy in evedesign framework
    const curInstance = structuredClone(instance);

    // identify mutated entities and create mutable versions
    const mutatedEntities = [
      ...new Set(mutant.map((mutation) => mutation.entity)),
    ];

    const entityToRep = new Map(
      mutatedEntities.map((entity) => [entity, [...system[entity].rep]]),
    );

    // sort mutations in mutant by position, this will allow us to apply
    // any insertions without breaking position indexing;
    // as insertions are made after substitution/deletion with the same position, do
    // not need to worry about their relative ordering
    const mutantSorted = [...mutant].sort((a, b) => {
      if (a.entity !== b.entity) {
        return a.entity - b.entity;
      }
      return b.pos - a.pos; // reverse order within entity
    });

    // iterate mutations and update
    mutantSorted.forEach((mutation) => {
      const posAdj = mutation.pos - system[mutation.entity].first_index;
      // mutation/deletion
      if (mutation.ref !== "") {
        entityToRep.get(mutation.entity)![posAdj] = mutation.to;
      } else {
        // insertion
        entityToRep.get(mutation.entity)!.splice(posAdj + 1, 0, mutation.to);
      }
    });

    // reassign updated reps to current instance
    entityToRep.forEach((rep, entity) => {
      curInstance.entity_instances[entity].rep = rep.join("");
    });

    return curInstance;
  });
};
