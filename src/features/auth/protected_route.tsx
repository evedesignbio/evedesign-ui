import type { ReactNode } from "react";
import { Button, Stack, Text } from "@mantine/core";
import { auth, useAuth } from "../../auth";
import { AuthenticationForm } from "./index.tsx";

// Fixed per build, so the hook is always called the same way.
const useAutoSignIn = auth.useAutoSignIn ?? (() => null);

export const AuthProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { user, isLoading } = useAuth();
  const autoSignIn = useAutoSignIn(); // redirect-based sign-in

  if (isLoading) return null; // or <Loader />
  if (user) return <>{children}</>;

  // Redirect providers
  if (autoSignIn) {
    if (!autoSignIn.error) return null; // navigating to Microsoft
    return (
      <Stack align="center" mt="xl">
        <Text>Sign-in failed: {autoSignIn.error}</Text>
        <Button onClick={autoSignIn.retry}>Try again</Button>
      </Stack>
    );
  }

  // Password providers (Supabase)
  if (auth.password) return <AuthenticationForm title={"Login required"} />;

  throw new Error(`Auth provider "${auth.kind}" has no sign-in method`);
};
