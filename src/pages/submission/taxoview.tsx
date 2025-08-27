import { Button, Modal, Stack } from "@mantine/core";
import "taxoview/dist/taxoview.ce.js";
import { useCallback, useMemo, useState } from "react";
import { MsaResult } from "../../models/api.ts";

export interface TaxoviewModalProps {
  opened: boolean;
  close: () => void;
  msa: MsaResult;
  submit: (filteredTaxonIds: number[]) => void;
}

const TAXONOMY_REPORT_HEADER_LINE =
  "#clade_proportion	clade_count	taxon_count	rank	taxID	name\n";

export const TaxoviewModal = ({
  opened,
  msa,
  close,
  submit,
}: TaxoviewModalProps) => {
  // State for clicked taxon IDs
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const setTaxoEl = useCallback(
    (el: HTMLElement | null) => {
      if (!el) return; // unmounted

      const onNodeClicked = (e: Event) => {
        const [node] = (e as CustomEvent).detail as [any];
        console.log("clicked node:", node.taxon_id, node);

        // Add selected node's taxon_id to list
        const id = node.taxon_id ?? node.taxID;
        if (id == null) return;
        setSelectedIds(
          (prev) => (prev.includes(id) ? prev : [...prev, id]), // avoid duplicates
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

  // TODO: if taxonomic filter selected here, submit filtered sequences to outside component
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
        <div>
          <strong>Selected taxon IDs:</strong>{" "}
          {selectedIds.length ? selectedIds.join(", ") : "-"}
        </div>
        <taxo-view
          ref={setTaxoEl}
          raw-data={transformedReport}
          font-fill="white"
        />
        <Button
          onClick={() => {
            // TODO: this is just a dummy for actual taxonomic filtering based on selection in TaxoView component
            submit(selectedIds);
            close();
          }}
        >
          Apply taxonomic filter
        </Button>
      </Stack>
    </Modal>
  );
};
