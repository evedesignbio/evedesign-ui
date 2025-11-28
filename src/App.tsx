import "@mantine/core/styles.css";
import "@mantine/dropzone/styles.css";
import { MantineProvider } from "@mantine/core";
import { Route, Switch } from "wouter";
import { SubmissionPage } from "./pages/submission";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ResultsPageWrapper } from "./pages/results";
import { JobListPage } from "./pages/results/joblist.tsx";
import { NavBar } from "./features/navbar";
import { SessionProvider } from "./context/SessionContext.tsx";
import { AuthProtectedRoute } from "./features/auth/protected_route.tsx";
import {
  ResetPasswordPage,
  ChangePasswordPage,
  SignUpPage,
} from "./pages/auth/account.tsx";
import { DocumentationPage } from "./pages/docs";
import { StartPage } from "./pages/start";
import { PrivacyPolicyPage, TermsOfServicePage } from "./pages/legal";

const queryClient = new QueryClient();

const App = () => {
  return (
    <MantineProvider defaultColorScheme="dark">
      <SessionProvider>
        <QueryClientProvider client={queryClient}>
          <NavBar />
          <Switch>
            <Route path="/" component={StartPage} />
            <Route path="/terms" component={TermsOfServicePage} />
            <Route path="/privacy" component={PrivacyPolicyPage} />
            <Route path="/submit" component={SubmissionPage} />
            <Route path="/auth/sign-up" component={SignUpPage} />
            <Route path="/auth/reset-password" component={ResetPasswordPage} />
            <Route path="/auth/change-password">
              <AuthProtectedRoute>
                <ChangePasswordPage />
              </AuthProtectedRoute>
            </Route>
            <Route path="/docs" component={DocumentationPage} />
            <Route path="/results/">
              <AuthProtectedRoute>
                <JobListPage />
              </AuthProtectedRoute>
            </Route>
            <Route path="/results/:id">
              {(params) => (
                <AuthProtectedRoute>
                  <ResultsPageWrapper id={params.id} />
                </AuthProtectedRoute>
              )}
            </Route>
            <Route>Error: invalid route</Route>
          </Switch>
        </QueryClientProvider>
      </SessionProvider>
    </MantineProvider>
  );
};

export default App;
