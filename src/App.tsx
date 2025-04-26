import "@mantine/core/styles.css";
import { MantineProvider } from "@mantine/core";
import { Route, Switch } from "wouter";
import { SubmissionPage } from "./pages/submission";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ResultsPageWrapper } from "./pages/results/results.tsx";
import {JobListPage} from "./pages/results/joblist.tsx";
import {NavBar} from "./features/navbar";

const queryClient = new QueryClient();

const App = () => {
  return (
    <MantineProvider defaultColorScheme="dark">
      <QueryClientProvider client={queryClient}>
        <NavBar />
        <Switch>
          <Route path="/" component={SubmissionPage} />
          <Route path="/results/" component={JobListPage} />
          <Route path="/results/:id/*?">
            {(params) => <ResultsPageWrapper id={params.id} />}
          </Route>
        </Switch>
      </QueryClientProvider>
    </MantineProvider>
  );
};

export default App;
