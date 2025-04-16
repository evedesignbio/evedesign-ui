import { useMutation } from "@tanstack/react-query";
import { PipelineSpec } from "../models/design.ts";

const getBackendUrl = () =>
  "https://deboramarkslab--designserver-api-fastapi-app.modal.run/";

interface SubmissionParams {
  spec: PipelineSpec;
  token: string;
}

export const useSubmission = () => {
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
      });
    },
    onSuccess: (x) => {
      console.log("SUCCESS", x);
    },
  });
};
