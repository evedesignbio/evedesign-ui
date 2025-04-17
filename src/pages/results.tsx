import { useLocalStorage } from "@mantine/hooks";
import {
  JOB_LIST_STORAGE_KEY,
  JobListEntry,
  useJobData,
} from "../api/modal.ts";
import { Button } from "@mantine/core";
import { Link } from "wouter";

interface ResultsPageProps {
  id: string;
}

export const ResultsPage = ({ id }: ResultsPageProps) => {
  // TODO: create page to retrieve old jobs
  const [jobList, _] = useLocalStorage<JobListEntry[]>({
    key: JOB_LIST_STORAGE_KEY,
    defaultValue: [],
  });
  console.log("JOB LIST", jobList);

  const qJob = useJobData(id);

  // TODO: also render waiting/errors
  return (
    <>
      <div>Job ID: {id}</div>
      <div>Job status: {qJob.data?.status}</div>
      <Button component={Link} href="/">
        Submit another job
      </Button>
    </>
  );
};
