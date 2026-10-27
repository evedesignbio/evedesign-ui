import { supabaseAuth } from "./supabase";
import type { AuthService } from "./types";
import { AUTH_PROVIDER } from "../config.ts";
import { oidcAuth } from "./oidc.tsx";

if (AUTH_PROVIDER !== "supabase" && AUTH_PROVIDER !== "oidc") {
  throw new Error(
    `VITE_AUTH_PROVIDER must be 'supabase' or 'oidc', got ${JSON.stringify(AUTH_PROVIDER)}`,
  );
}

export const auth: AuthService =
  AUTH_PROVIDER === "supabase" ? supabaseAuth : oidcAuth;

export const SessionProvider = auth.SessionProvider;
export const useAuth = () => ({
  ...auth.useAuth(),
  kind: auth.kind,
  signOut: auth.signOut,
  signInWithRedirect: auth.signInWithRedirect,
  password: auth.password,
});

// for backwards compatibility
export const useAccessToken = () => auth.useAuth().getAccessToken;

export * from "./types";
