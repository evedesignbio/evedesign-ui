import {
  Badge,
  Breadcrumbs,
  Button,
  Group,
  Modal,
  Stack,
} from "@mantine/core";
import "taxoview/dist/taxoview.ce.js";
import { useCallback, useMemo, useState } from "react";
import { MsaResult } from "../../models/api.ts";

export interface TaxoviewModalProps {
  opened: boolean;
  close: () => void;
  msa: MsaResult;
  submit: (filteredTaxonIds: number[]) => void;
  colorScheme: "light" | "dark";
}

const TAXONOMY_REPORT_HEADER_LINE =
  "#clade_proportion	clade_count	taxon_count	rank	taxID	name\n";

const MAP_RANK = new Map<string, string>([
  ["no rank", "-"],
  ["domain", "d"],
  ["kingdom", "k"],
  ["phylum", "p"],
  ["class", "c"],
  ["order", "o"],
  ["family", "f"],
  ["genus", "g"],
  ["species", "s"],
]);

export const lineageToTaxonomyString = (nodes: [any]) => {
  // reverse order to top-down, remove root
  const nodesFwd = [...nodes].reverse().filter((n) => n.taxon_id !== "1");

  // map individual levels and concatenate
  return nodesFwd
    .map((n) => {
      const rankAbbr = MAP_RANK.get(n.rank);
      // if (!rankAbbr) throw new Error("Undefined rank abbreviation: " + n.rank + " for " + n.name);
      return `${rankAbbr ? rankAbbr : "-"}_${n.name}`;
    })
    .join(";");
};

export interface SelectedTaxon {
  node: any;
  taxonomyString: string;
}

export const TaxoviewModal = ({
  opened,
  msa,
  close,
  submit,
  colorScheme,
}: TaxoviewModalProps) => {
  // State for clicked taxon IDs
  const [selectedTaxons, setSelectedTaxons] = useState<
    Map<number, SelectedTaxon>
  >(new Map());

  const setTaxoEl = useCallback(
    (el: HTMLElement | null) => {
      if (!el) return; // unmounted

      const onNodeClicked = (e: Event) => {
        const [node] = (e as CustomEvent).detail as [any];
        // console.log("clicked node:", node.taxon_id, node);
        // console.log("lineage:", lineageToTaxonomyString(node.lineage));

        // Add selected node's taxon_id to list
        const id: number = node.taxon_id ?? node.taxID;

        if (id == null) return;

        const taxonomyString = lineageToTaxonomyString(node.lineage);

        // TODO: implement proper multiselect logic here eventually
        //  first check if new addition already covered by existing taxon, then skip
        //  second, check if new addition subsumes other selections, then clean up

        setSelectedTaxons(
          new Map([
            [
              id,
              {
                node: node,
                taxonomyString: taxonomyString,
              } as SelectedTaxon,
            ],
          ]),
        );
      };

      // @ts-ignore
      // el.colorScheme = ["#FFCD73", "#8CB5B5", "#648FFF", "#785EF0"];

      el.addEventListener("node-clicked", onNodeClicked);
      return () => el.removeEventListener("node-clicked", onNodeClicked);
    },
    [msa, submit, close],
  );

  // change report format to the one expected by taxoview component
  // (remove first column from report and add header line)
  const transformedReport = useMemo(() => {
    const noFirstCol = msa
      .taxonomyReport!.split("\n")
      .map((line) => line.split("\t").slice(1).join("\t"))
      .join("\n");
    return TAXONOMY_REPORT_HEADER_LINE + noFirstCol;
  }, [msa.taxonomyReport]);

  const filteredSeqs = useMemo(() => {
    return msa.seqs.filter(
      (seq) =>
        selectedTaxons.size === 0 ||
        [...selectedTaxons.values()].some((taxon) =>
          seq.metadata?.taxonomy_lineage?.startsWith(taxon.taxonomyString),
        ),
    );
  }, [selectedTaxons, msa.seqs]);

  return (
    <Modal
      opened={opened}
      onClose={close}
      withCloseButton={true}
      overlayProps={{
        blur: 3,
      }}
      size="70%"
    >
      <Stack>
        <taxo-view
          ref={setTaxoEl}
          raw-data={transformedReport}
          font-fill={colorScheme === "dark" ? "white" : "black"}
        />
        <Group>
          <strong>Taxon filter:</strong>{" "}
          {selectedTaxons.size > 0 ? (
            <>
              <Breadcrumbs separator="→" separatorMargin={"xs"}>
                {[...selectedTaxons].map(([_taxonId, taxon]) =>
                  taxon.taxonomyString
                    .split(";")
                    .map((level) => (
                      <Badge variant={"default"}>{level.split("\_")[1]}</Badge>
                    )),
                )}
              </Breadcrumbs>
            </>
          ) : (
            <div>None</div>
          )}
        </Group>
        <Group justify={"flex-end"}>
          <Button
            variant={"default"}
            onClick={() => setSelectedTaxons(new Map())}
            disabled={selectedTaxons.size === 0}
          >
            Reset selection
          </Button>
          <Button
            onClick={() => {
              // TODO: this is just a dummy for actual taxonomic filtering based on selection in TaxoView component
              // submit(selectedIds);
              close();
            }}
          >
            Apply taxonomic filter ({filteredSeqs.length} sequences)
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};
