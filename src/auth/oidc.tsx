import { useCallback, useMemo } from "react";
import type { ReactNode } from "react";
import { UserManager, WebStorageStateStore } from "oidc-client-ts";
import { AuthProvider, useAuth as useOidc, useAutoSignin } from "react-oidc-context";
import type { AuthService, AuthState, AuthUser, AutoSignIn } from "./types";

export const OIDC_AUTHORITY = import.meta.env.VITE_OIDC_AUTHORITY;
export const OIDC_CLIENT_ID = import.meta.env.VITE_OIDC_CLIENT_ID;
export const OIDC_SCOPE =  import.meta.env.VITE_OIDC_SCOPE;

// Own instance (like msalInstance), so tokens and redirects work outside the provider too.
// Pure annotation: lets the bundler drop this module from builds that don't use it.
export const userManager = /* @__PURE__ */ new UserManager({
  authority: OIDC_AUTHORITY, // Entra: https://login.microsoftonline.com/<tenant-id>/v2.0
  client_id: OIDC_CLIENT_ID,
  redirect_uri: window.location.origin, // the provider handles the callback; no extra page
  post_logout_redirect_uri: window.location.origin,
  scope: OIDC_SCOPE, // e.g. "openid profile email offline_access api://<api-app-id>/access_as_user"
  userStore: new WebStorageStateStore({ store: window.localStorage }), // survive new tabs
  automaticSilentRenew: true,
});

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
          id: oidcUser.profile.sub, // Entra: use profile.oid if you need the object id
          email: oidcUser.profile.email ?? null,
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
