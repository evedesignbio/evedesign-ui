import "@mantine/core/styles.css";
import { MantineProvider } from "@mantine/core";
import { Route, Switch } from "wouter";
import { SubmissionPage } from "./pages/submission.tsx";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();

const App = () => {
  return (
    <MantineProvider defaultColorScheme="dark">
      <QueryClientProvider client={queryClient}>
        <Switch>
          <Route path="/" component={SubmissionPage} />
        </Switch>
      </QueryClientProvider>
    </MantineProvider>
  );
};

export default App;
