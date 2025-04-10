export interface Sequence {
  seq: string;
  id: string | null;
  key: string | null;
  type: "protein" | "dna" | "rna"
}