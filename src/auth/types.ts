import type { FC, ReactNode } from "react";

export type AuthProviderKind = "supabase" | "oidc";

// provider agnostic view of the signed in user
export type AuthUser = {
  id: string;
  email: string | null;
  name: string | null;
};

// useAuth return type
export type AuthState = {
  user: AuthUser | null;

  // True until the provider has restored or ruled out an existing session
  isLoading: boolean;

  // Bearer token for API, refreshed as needed
  getAccessToken(): Promise<string | null>;
};

export type AuthResult = { error: { message: string } | null };

export interface PasswordAuth {
  signIn(email: string, password: string): Promise<AuthResult>;
  signUp(email: string, password: string): Promise<AuthResult>;
  resetPassword(email: string): Promise<AuthResult>;
  updatePassword(newPassword: string): Promise<AuthResult>;
}

// result of a provider's automatic sign-in
export type AutoSignIn = {
  // error code of a failed sign-in, null while signed in or redirecting
  error: string | null;
  retry: () => void;
};

// global shared auth interface
export interface AuthService {
  kind: AuthProviderKind;
  SessionProvider: FC<{ children: ReactNode }>;
  useAuth(): AuthState;

  // hook that starts sign-in by itself when signed out (redirect providers),
  // undefined for password-based providers, which show their own sign-in form
  useAutoSignIn?: () => AutoSignIn;

  // redirect-based sign in, undefined for direct password-based sign in
  signInWithRedirect?: () => Promise<void>;

  // password-based sign-in, undefined for redirect-only providers
  password?: PasswordAuth;
  signOut(): Promise<void>;
}
