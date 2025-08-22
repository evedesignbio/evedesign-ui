import React from "react";
import { useSession } from "../../context/SessionContext.tsx";
import { AuthenticationForm } from "./index.tsx";
import { Container, Stack } from "@mantine/core";

type AuthProtectedRouteProps = { children: React.ReactNode };
export const AuthProtectedRoute = ({ children }: AuthProtectedRouteProps) => {
  const { session } = useSession();
  if (session === null) {
    return (
      <Container size="sm" pt="xl">
        <Stack>
          <AuthenticationForm title={"Login required"} />
        </Stack>
      </Container>
    );
  } else {
    return children;
  }
};
