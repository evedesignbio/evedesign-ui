export interface StructureAlignment {
  db: string;
  alnLength: number;
  dbAln: String;
  dbEndPos: number;
  dbLen: number;
  dbStartPos: number;
  eval: number;
  gapsopened: number;
  missmatches: number;
  prob: number;
  q3di: string;
  qAln: string;
  qEndPos: number;
  qLen: number;
  qStartPos: number;
  query: string;
  score: number;
  seqId: number;
  t3di: string;
  tCa: string;
  tSeq: string;
  target: string;
  taxId: number;
  taxName: string;
  scoreAdj: number;
}
