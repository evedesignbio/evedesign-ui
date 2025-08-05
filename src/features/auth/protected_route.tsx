import React from "react";
import { useSession } from "../../context/SessionContext.tsx";
import { AuthenticationForm } from "./index.tsx";
import { Container } from "@mantine/core";

type AuthProtectedRouteProps = { children: React.ReactNode };
export const AuthProtectedRoute = ({ children }: AuthProtectedRouteProps) => {
  const { session } = useSession();
  if (session === null) {
    return (
      <Container size="sm" pt="xl">
        <AuthenticationForm />
      </Container>
    );
  } else {
    return children;
  }
};
