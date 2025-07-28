import "@mantine/core/styles.css";
import { MantineProvider } from "@mantine/core";
import { Route, Switch } from "wouter";
import { SubmissionPage } from "./pages/submission";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ResultsPageWrapper } from "./pages/results";
import { JobListPage } from "./pages/results/joblist.tsx";
import { NavBar } from "./features/navbar";
import { SessionProvider } from "./context/SessionContext.tsx";

const queryClient = new QueryClient();

const App = () => {
  return (
    <MantineProvider defaultColorScheme="dark">
      <SessionProvider>
        <QueryClientProvider client={queryClient}>
          <NavBar />
          <Switch>
            <Route path="/" component={SubmissionPage} />
            <Route path="/results/" component={JobListPage} />
            <Route path="/results/:id">
              {(params) => <ResultsPageWrapper id={params.id} />}
            </Route>
            <Route>Error: invalid route</Route>
          </Switch>
        </QueryClientProvider>
      </SessionProvider>
    </MantineProvider>
  );
};

export default App;
