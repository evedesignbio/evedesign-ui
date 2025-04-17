import { useMutation, useQuery } from "@tanstack/react-query";
import { PipelineSpec, SingleMutationScanSpec } from "../models/design.ts";
import { useJobList } from "./local.ts";

export const getBackendUrl = () =>
  "https://deboramarkslab--designserver-api-fastapi-app.modal.run/";

interface SubmissionParams {
  spec: PipelineSpec | SingleMutationScanSpec;
  token: string;
}

export interface JobListEntry {
  jobId: string;
  submissionDate: string;
}

export const JOB_LIST_STORAGE_KEY = "job-list";

export const useSubmission = () => {
  const [jobList, setJobList] = useJobList();

  return useMutation({
    mutationFn: (params: SubmissionParams) => {
      const { spec, token } = params;
      return fetch(getBackendUrl() + "job/", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(spec),
      }).then((res) => {
        if (!res.ok) {
          throw new Error(`${res.status}`);
        }

        return res.json();
      });
    },
    onSuccess: (data) => {
      if (typeof data?.job_id !== "string") {
        return;
      }

      setJobList(
        jobList.concat({
          jobId: data.job_id,
          submissionDate: new Date().toJSON(),
        }),
      );
    },
  });
};

export const useJobData = (id: string) => {
  return useQuery({
    queryKey: ["jobdata", id],
    queryFn: () =>
      fetch(getBackendUrl() + "job/" + id).then((res) => {
        if (!res.ok) {
          throw new Error(`${res.status}`);
        }

        return res.json();
      }),
  });
};
