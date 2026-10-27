import { supabaseAuth } from "./supabase";
import type { AuthService } from "./types";
import { AUTH_PROVIDER } from "../config.ts";

if (AUTH_PROVIDER !== "supabase") {
  throw new Error(
    `VITE_AUTH_PROVIDER is invalid, got ${JSON.stringify(AUTH_PROVIDER)}`,
  );
}

export const auth: AuthService = supabaseAuth;

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
