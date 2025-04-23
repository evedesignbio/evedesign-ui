import { useMutation, useQuery } from "@tanstack/react-query";
import {
  PipelineSpec,
  ProteinToDnaSpec,
  SingleMutationScanSpec,
} from "../models/design.ts";
import { useJobList } from "./local.ts";
import { ApiJobResult } from "../models/api.ts";

export const getBackendUrl = () =>
  "https://deboramarkslab--designserver-api-fastapi-app.modal.run/";

interface SubmissionParams {
  spec: PipelineSpec | SingleMutationScanSpec | ProteinToDnaSpec;
  token: string;
  parentId: string | null;
}

export interface JobListEntry {
  jobId: string;
  submissionDate: string;
  parentId: string | null;
  specType: string;
}

export const JOB_LIST_STORAGE_KEY = "design-job-list";
const POLLING_INTERVAL = 5000;

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
    onSuccess: (data, params) => {
      const { parentId, spec } = params;
      if (typeof data?.job_id !== "string") {
        return;
      }

      setJobList(
        jobList.concat({
          jobId: data.job_id,
          submissionDate: new Date().toJSON(),
          parentId: parentId,
          specType: spec.key,
        }),
      );
    },
  });
};

export const useJobData = (id: string) => {
  // status options: initialized, running, failed, finished, invalid
  return useQuery({
    queryKey: ["jobdata", id],
    queryFn: (): Promise<ApiJobResult> =>
      fetch(getBackendUrl() + "job/" + id).then((res) => {
        if (!res.ok) {
          throw new Error(`${res.status}`);
        }
        return res.json();
      }),
    refetchInterval: (query) =>
      query.state.data?.status === "initialized" ||
      query.state.data?.status === "running"
        ? POLLING_INTERVAL
        : false,
    staleTime: Infinity,
  });
};
