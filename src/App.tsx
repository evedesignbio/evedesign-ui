import "@mantine/core/styles.css";
import { MantineProvider } from "@mantine/core";
import { Route, Switch } from "wouter";
import { SubmissionPage } from "./pages/submission";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ResultsPage } from "./pages/results/results.tsx";
import {JobListPage} from "./pages/results/joblist.tsx";

const queryClient = new QueryClient();

const App = () => {
  return (
    <MantineProvider defaultColorScheme="dark">
      <QueryClientProvider client={queryClient}>
        <Switch>
          <Route path="/" component={SubmissionPage} />
          <Route path="/results/" component={JobListPage} />
          <Route path="/results/:id">
            {(params) => <ResultsPage id={params.id} />}
          </Route>
        </Switch>
      </QueryClientProvider>
    </MantineProvider>
  );
};

export default App;
