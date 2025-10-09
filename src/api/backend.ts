import { useMutation, useQuery } from "@tanstack/react-query";
import {
  PipelineSpec,
  ProteinToDnaSpec,
  SingleMutationScanSpec,
} from "../models/design.ts";
// import { useJobList } from "./local.ts";
import {
  ApiBalanceResult,
  ApiJobResult,
  JobListResponse,
} from "../models/api.ts";
import { getAccessToken, useSession } from "../context/SessionContext.tsx";

export const getBackendUrl = () =>
  // "https://deboramarkslab--designserver-api-fastapi-app.modal.run/";
  "https://deboramarkslab--designserver-api-nextgen-api.modal.run/";
// "http://127.0.0.1:8000/";

export interface SubmissionParams {
  spec: PipelineSpec | SingleMutationScanSpec | ProteinToDnaSpec;
  name: string | null;
  project_id: string | null;
  parent_job_id: string | null;
  public: boolean;
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
  // const [jobList, setJobList] = useJobList();
  const { session } = useSession();
  const token = getAccessToken(session);

  return useMutation({
    mutationFn: (params: SubmissionParams) => {
      // const { spec, token } = params;
      // const { spec } = params;
      return fetch(getBackendUrl() + "job", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(params),
      }).then((res) => {
        if (!res.ok) {
          throw new Error(`${res.status}`);
        }

        return res.json();
      });
    },
    onSuccess: (data, _params) => {
      // const { parent_job_id, spec } = params;
      if (typeof data?.job_id !== "string") {
        return;
      }

      // setJobList(
      //   jobList.concat({
      //     jobId: data.job_id,
      //     submissionDate: new Date().toJSON(),
      //     parentId: parent_job_id,
      //     specType: spec.key,
      //   }),
      // );
    },
  });
};

export const useJobData = (id: string) => {
  const { session } = useSession();
  const token = getAccessToken(session);

  // status options: initialized, running, failed, finished, invalid
  return useQuery({
    queryKey: ["jobdata", id],
    queryFn: (): Promise<ApiJobResult> =>
      fetch(getBackendUrl() + "job/" + id, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      }).then((res) => {
        if (!res.ok) {
          throw new Error(`${res.status}`);
        }
        return res.json();
      }),
    refetchInterval: (query) =>
      query.state.data?.status === "initialized" ||
      query.state.data?.status === "pending" ||
      query.state.data?.status === "running"
        ? POLLING_INTERVAL
        : false,
    // staleTime: Infinity,
    // enabled: token !== null,
  });
};

export const useBalance = () => {
  const { session } = useSession();
  const token = getAccessToken(session);

  // status options: initialized, running, failed, finished, invalid
  const query = useQuery({
    queryKey: ["balance", token],
    queryFn: (): Promise<ApiBalanceResult> =>
      fetch(getBackendUrl() + "balance", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      }).then((res) => {
        if (!res.ok) {
          throw new Error(`${res.status}`);
        }
        return res.json();
      }),
    refetchInterval: () => 60 * 1000, // refresh once per minute
    enabled: token !== null,
  });

  if (query.isSuccess) {
    return {
      finished: true,
      balance: query.data?.balance,
    };
  } else {
    return {
      finished: false,
      balance: null,
    };
  }
};

export const useJobList = () => {
  const { session } = useSession();
  const token = getAccessToken(session);

  // status options: initialized, running, failed, finished, invalid
  return useQuery({
    queryKey: ["joblist", token], // include token in case we switch accounts and need to reload
    queryFn: (): Promise<JobListResponse> =>
      fetch(getBackendUrl() + "job", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      }).then((res) => {
        if (!res.ok) {
          throw new Error(`${res.status}`);
        }
        return res.json();
      }),
    enabled: token !== null,
  });
};
