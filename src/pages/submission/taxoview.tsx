import { Button, Modal, Stack } from "@mantine/core";
import { Sequence } from "../../models/design.ts";

export interface TaxoviewModalProps {
  opened: boolean;
  close: () => void;
  msa: Sequence[];
  submit: (msaFiltered: Sequence[]) => void;
}

export const TaxoviewModal = ({
  opened,
  msa,
  close,
  submit,
}: TaxoviewModalProps) => {
  // TODO: if taxonomic filter selected here, submit filtered sequences to outside component
  //  with submit() function prop
  return (
    <Modal
      opened={opened}
      onClose={close}
      withCloseButton={true}
      overlayProps={{
        blur: 3,
      }}
    >
      <Stack>
        <div>TaxoView for {msa.length} sequences</div>
        <Button
          onClick={() => {
            // TODO: this is just a dummy for actual taxonomic filtering based on selection in TaxoView component
            submit(msa.slice(0, 100));
            close();
          }}
        >
          Apply taxonomic filter
        </Button>
      </Stack>
    </Modal>
  );
};
