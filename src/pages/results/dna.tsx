import { useState } from "react";
import {
  Button,
  MultiSelect,
  RangeSlider,
  Space,
  Stack,
  Switch,
  Text,
  Textarea,
  Title,
} from "@mantine/core";
import {
  PipelineApiResult,
  SingleMutationScanApiResult,
} from "../../models/api.ts";
import { RESTRICTION_SITES } from "../../utils/bio.ts";

export const DNA_SEQ_REGEXP = RegExp("^[ACGT]+$");

// TODO: improve props, receive list of instances
export interface DNAGenerationDialogProps {
  id: string;
  results: PipelineApiResult | SingleMutationScanApiResult;
}

const DEFAULT_MIN_GC_CONTENT = 40;
const DEFAULT_MAX_GC_CONTENT = 60;
const GC_CONTENT_MIN_RANGE = 20;

const normalizeDnaSeq = (seq: string) => seq.replace(/\s/g, "").toUpperCase();
const isValidDnaSeq = (seq: string): boolean => {
  return seq === "" || DNA_SEQ_REGEXP.test(seq);
};

export const DNAGenerationDialog = ({
  results,
  id,
}: DNAGenerationDialogProps) => {
  const [upstreamDna, setUpstreamDna] = useState<string>("");
  const [downstreamDna, setDownstreamDna] = useState<string>("");
  const [refEnabled, setRefEnabled] = useState(false);
  const [refDna, setRefDna] = useState<string>("");

  const [avoidSites, setAvoidSites] = useState<string[]>([]);
  const [gcContentRange, setGcContentRange] = useState<[number, number]>([
    DEFAULT_MIN_GC_CONTENT,
    DEFAULT_MAX_GC_CONTENT,
  ]);

  console.log(results, id);
  /*

  class DnaChiselArgsSpec(BaseModel):
    """
    Constructor arguments to instantiate
    """
    method: Literal["use_best_codon", "match_codon_usage"]
    codon_usage_table: Literal[
        "b_subtilis",
        "d_melanogaster",
        "m_musculus_domesticus",
        "m_musculus",
        "e_coli",
        "g_gallus",
        "c_elegans",
        "s_cerevisiae",
        "h_sapiens",
    ] | str

    gc_window: int | None = Field(30)
    max_homopolymer_length: int | None = Field(5)
    max_repeat_length: int | None = Field(9)

   */

  const upstreamDnaNorm = normalizeDnaSeq(upstreamDna);
  const downstreamDnaNorm = normalizeDnaSeq(downstreamDna);
  const refDnaNorm = normalizeDnaSeq(refDna);
  const isValidUpstream = isValidDnaSeq(upstreamDnaNorm);
  const isValidDownstream = isValidDnaSeq(downstreamDnaNorm);
  const isValidRef = isValidDnaSeq(refDnaNorm);

  return (
    <Stack>
      <Space />
      <Title order={4} c="blue">
        Define your nucleotide vector
      </Title>
      <Textarea
        label="Upstream DNA sequence"
        description="Sequence upstream from start of your library DNA insert to include during codon optimization"
        placeholder="Enter DNA sequence (optional, e.g. 20 bp)"
        autosize
        value={upstreamDna}
        onChange={(e) => setUpstreamDna(e.target.value)}
        error={isValidUpstream ? undefined : "Invalid DNA sequence"}
      />
      <Textarea
        label="Downstream DNA sequence"
        description="Sequence downstream from end of your library DNA insert to include during codon optimization"
        placeholder="Enter DNA sequence (optional, e.g. 20 bp)"
        autosize
        value={downstreamDna}
        onChange={(e) => setDownstreamDna(e.target.value)}
        error={isValidDownstream ? undefined : "Invalid DNA sequence"}
      />

      <Space />
      <Switch
        checked={refEnabled}
        onChange={(event) => setRefEnabled(event.currentTarget.checked)}
        label="Optimize sequences relative to target sequence"
        description="If enabled, codons will be kept fixed for positions with same amino acid as target sequence"
      />
      {refEnabled ? (
        <Textarea
          label="Reference DNA sequence"
          description="DNA sequence translating into your target protein; if empty, will create new reference DNA on the fly"
          placeholder="Enter coding DNA sequence (optional)"
          autosize
          value={refDna}
          onChange={(e) => setRefDna(e.target.value)}
          error={isValidRef ? undefined : "Invalid DNA sequence"}
        />
      ) : null}

      <Space />
      <Title order={4} c="blue">
        Specify codon optimization settings
      </Title>
      <MultiSelect
        label="Avoid sites"
        description="Selected restriction enzyme motifs will be avoided on both strands"
        placeholder={avoidSites.length === 0 ? "Select sites..." : ""}
        value={avoidSites}
        onChange={setAvoidSites}
        data={RESTRICTION_SITES}
        searchable={true}
        clearable={true}
      />
      <Stack gap={0}>
        <Text size={"sm"}>GC content</Text>
        <Text size={"xs"} c={"dimmed"}>
          Minimum and maximum acceptable GC content in sliding window
        </Text>
      </Stack>
      <RangeSlider
        min={0}
        max={100}
        value={gcContentRange}
        onChange={setGcContentRange}
        minRange={GC_CONTENT_MIN_RANGE}
        marks={[0, 20, 40, 60, 80, 100].map((pct) => ({
          value: pct,
          label: `${pct}%`,
        }))}
      />
      <Space h="xl" />
      <Button disabled={!isValidUpstream || !isValidDownstream || !isValidRef}>
        Generate DNA sequences
      </Button>
    </Stack>
  );
};
