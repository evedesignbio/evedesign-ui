import React from "react";
import { useSession } from "../../context/SessionContext.tsx";
import { AuthenticationForm } from "./index.tsx";

type AuthProtectedRouteProps = { children: React.ReactNode };
export const AuthProtectedRoute = ({ children }: AuthProtectedRouteProps) => {
  const { session } = useSession();
  if (session === null) {
    return <AuthenticationForm title={"Login required"} />;
  } else {
    return children;
  }
};
