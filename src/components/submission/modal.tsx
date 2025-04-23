import {UseMutationResult} from "@tanstack/react-query";
import {SubmissionParams} from "../../api/modal.ts";
import {Button, Code, Group, Loader, Modal, Stack, Text, Title} from "@mantine/core";
import {Link} from "wouter";

export interface SubmissionModalProps {
  isSubmitting: boolean;
  close: () => void;
  submission: UseMutationResult<any, Error, SubmissionParams, unknown>;
}

export const SubmissionModal = ({
                                  isSubmitting,
                                  close,
                                  submission,
                                }: SubmissionModalProps) => {
  return (
      <Modal
          opened={isSubmitting}
          onClose={close}
          withCloseButton={false}
          closeOnClickOutside={false}
          closeOnEscape={false}
          overlayProps={{
            // backgroundOpacity: 0.55,
            blur: 3,
          }}
      >
        <Stack align={"center"}>
          {submission.isPending ? (
              <>
                <Loader type="dots" size="xl"></Loader>
                <Text>Submitting your job...</Text>
              </>
          ) : null}
          {submission.isSuccess ? (
              <>
                <Title order={2}>Submission successful!</Title>
                <Group>
                  <Text>Your job ID is</Text>
                  <Code>{submission.data?.job_id}</Code>
                </Group>
                <Group>
                  <Button variant="default" onClick={close}>
                    Submit another job
                  </Button>
                  <Button
                      component={Link}
                      href={`/results/${submission.data?.job_id}`}
                  >
                    Go to results
                  </Button>
                </Group>
              </>
          ) : null}
          {submission.isError ? (
              <>
                <Title order={1}>Error :(</Title>

                <Text>
                  Submission failed with error code {submission.error.message}.{" "}
                  {submission.error.message === "401"
                      ? " Please make sure to use a valid submission token."
                      : " Please try again later."}
                </Text>

                <Group>
                  <Button onClick={close}>Close</Button>
                </Group>
              </>
          ) : null}
        </Stack>
      </Modal>
  );
};