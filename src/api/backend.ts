import { useMutation, useQuery, UseQueryResult } from "@tanstack/react-query";
import {
  PipelineSpec,
  ProteinToDnaSpec,
  SingleMutationScanSpec,
  systemSpecFromSystemArray,
} from "../models/design.ts";
// import { useJobList } from "./local.ts";
import {
  ApiBalanceResult,
  ApiJobResult,
  JobListResponse,
  PipelineApiResult,
  ProteinToDnaApiResult,
  SingleMutationScanApiResult,
} from "../models/api.ts";
import { useAccessToken, useAuth } from "../auth";
import { useMemo } from "react";

export const getBackendUrl = () => import.meta.env.VITE_BACKEND_BASE_URL;

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
  const getToken = useAccessToken();

  return useMutation({
    mutationFn: async (params: SubmissionParams) => {
      // Fresh token per submission (cached by MSAL/Supabase until close to expiry)
      const token = await getToken();

      if (!token) throw new Error("Not signed in");

      const res = await fetch(getBackendUrl() + "job", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(params),
      });

      if (!res.ok) {
        throw new Error(`${res.status}`);
      }

      return res.json();
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
  const getToken = useAccessToken();

  // status options: initialized, running, failed, finished, invalid
  return useQuery({
    queryKey: ["jobdata", id],
    queryFn: async (): Promise<ApiJobResult> => {
      // Called on every fetch and poll; served from cache until close to expiry
      const token = await getToken();
      if (!token) {
        throw new Error("Not signed in");
      }

      const res = await fetch(getBackendUrl() + "job/" + id, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      if (!res.ok) {
        throw new Error(`${res.status}`);
      }
      return res.json();
    },
    refetchInterval: (query) =>
      query.state.data?.status === "initialized" ||
      query.state.data?.status === "pending" ||
      query.state.data?.status === "running"
        ? POLLING_INTERVAL
        : false,
    // staleTime: Infinity,
  });
};

export const useJobDataTransformed = (
  qJob: UseQueryResult<ApiJobResult, Error>,
) => {
  // transform old result JSON format to new format for backwards compatibility
  return useMemo(() => {
    if (qJob.isSuccess && qJob.data?.type && qJob.data?.results) {
      if (
        qJob.data.type === "pipeline" ||
        qJob.data.type === "single_mutation_scan"
      ) {
        const results = structuredClone(qJob.data.results) as
          | PipelineApiResult
          | SingleMutationScanApiResult;
        // update old list-only system format
        if (Array.isArray(results.spec.system)) {
          results.spec.system = systemSpecFromSystemArray(results.spec.system);
        }
        return results;
      } else if (qJob.data.type === "protein_to_dna") {
        const resultsDna = structuredClone(
          qJob.data.results,
        ) as ProteinToDnaApiResult;
        // update old list-only system format
        if (Array.isArray(resultsDna.spec.args.system)) {
          resultsDna.spec.args.system = systemSpecFromSystemArray(
            resultsDna.spec.args.system,
          );
        }
        return resultsDna;
      }
      // should not happen currently
      return qJob.data.results;
    } else {
      return undefined;
    }
  }, [qJob.isSuccess, qJob.data]);
};

export const useBalance = () => {
  const { user } = useAuth();
  const getToken = useAccessToken();

  // status options: initialized, running, failed, finished, invalid
  const query = useQuery({
    // Key on the user, not the token: tokens rotate, users don't
    queryKey: ["balance", user?.id],
    queryFn: async (): Promise<ApiBalanceResult> => {
      const token = await getToken();
      if (!token) {
        throw new Error("Not signed in");
      }

      const res = await fetch(getBackendUrl() + "balance", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      if (!res.ok) {
        throw new Error(`${res.status}`);
      }
      return res.json();
    },
    refetchInterval: () => 60 * 1000, // refresh once per minute
    enabled: !!user,
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
  const { user } = useAuth();
  const getToken = useAccessToken();

  // status options: initialized, running, failed, finished, invalid
  return useQuery({
    queryKey: ["joblist", user?.id], // reload when switching accounts (stable across token refreshes)
    queryFn: async (): Promise<JobListResponse> => {
      const token = await getToken();
      if (!token) {
        throw new Error("Not signed in");
      }

      const res = await fetch(getBackendUrl() + "job", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      if (!res.ok) {
        throw new Error(`${res.status}`);
      }
      return res.json();
    },
    enabled: !!user,
  });
};
