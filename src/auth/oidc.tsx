import { useCallback, useMemo } from "react";
import type { ReactNode } from "react";
import { UserManager, WebStorageStateStore } from "oidc-client-ts";
import { AuthProvider, useAuth as useOidc, useAutoSignin } from "react-oidc-context";
import type { AuthService, AuthState, AuthUser, AutoSignIn } from "./types";

export const OIDC_AUTHORITY = import.meta.env.VITE_OIDC_AUTHORITY;
export const OIDC_CLIENT_ID = import.meta.env.VITE_OIDC_CLIENT_ID;
export const OIDC_SCOPE =  import.meta.env.VITE_OIDC_SCOPE;

// Own instance (like msalInstance), so tokens and redirects work outside the provider too.
// Created inside a function so the pure call has no arguments: the bundler can then drop
// the whole module from builds that don't use it. (Arguments of a pure call are still kept
// if they have side effects, e.g. `new WebStorageStateStore(...)` or reading `window`.)
const createUserManager = () =>
  new UserManager({
    authority: OIDC_AUTHORITY, // Entra: https://login.microsoftonline.com/<tenant-id>/v2.0
    client_id: OIDC_CLIENT_ID,
    redirect_uri: window.location.origin, // the provider handles the callback; no extra page
    post_logout_redirect_uri: window.location.origin,
    scope: OIDC_SCOPE, // e.g. "openid profile email offline_access api://<api-app-id>/access_as_user"
    userStore: new WebStorageStateStore({ store: window.localStorage }), // survive new tabs
    automaticSilentRenew: true,
  });

export const userManager = /* @__PURE__ */ createUserManager();

// Remove ?code=&state= from the URL after sign-in.
const onSigninCallback = () =>
  window.history.replaceState({}, document.title, window.location.pathname);

const SessionProvider = ({ children }: { children: ReactNode }) => (
  <AuthProvider userManager={userManager} onSigninCallback={onSigninCallback}>
    {children}
  </AuthProvider>
);

const useAuth = (): AuthState => {
  const { user: oidcUser, isLoading } = useOidc();
  const sub = oidcUser?.profile.sub;
  const user = useMemo<AuthUser | null>(
    () =>
      oidcUser
        ? {
          // Entra: object id (`oid`, same as MSAL's localAccountId); its `sub` is per app.
          // Other providers have no `oid` and use `sub`.
          id: (oidcUser.profile.oid as string | undefined) ?? oidcUser.profile.sub,
          email: oidcUser.profile.email ?? oidcUser.profile.preferred_username ?? null,
          name: oidcUser.profile.name ?? null,
        }
        : null,
    [sub],
  );

  // New function only when the signed-in user changes.
  const getAccessToken = useCallback(async () => {
    let current = await userManager.getUser();
    if (current?.expired) current = await userManager.signinSilent().catch(() => null);
    return current?.access_token ?? null;
  }, [sub]);

  return { user, isLoading, getAccessToken };
};

// Redirects to sign-in when signed out; an error returned by the provider is not retried.
const useAutoSignIn = (): AutoSignIn => {
  const { error } = useAutoSignin({ signinMethod: "signinRedirect" });
  return { error: error?.message ?? null, retry: () => void userManager.signinRedirect() };
};

export const oidcAuth: AuthService = {
  kind: "oidc",
  SessionProvider,
  useAuth,
  useAutoSignIn,
  signInWithRedirect: () => userManager.signinRedirect(),
  signOut: () => userManager.signoutRedirect(),
};
