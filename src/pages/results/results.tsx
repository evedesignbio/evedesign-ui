import { Button } from "@mantine/core";
import { Link } from "wouter";
import { useJobData } from "../../api/modal.ts";

interface ResultsPageProps {
  id: string;
}

export const ResultsPage = ({ id }: ResultsPageProps) => {
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
