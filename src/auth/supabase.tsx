/**
 * MIT License
 *
 * Copyright (c) 2024 MARK MATTHEW VERGARA
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AuthChangeEvent, createClient, Session } from "@supabase/supabase-js";
import { useLocation } from "wouter";
import type { AuthService, AuthState, AuthUser } from "./types";

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Pure annotation: lets the bundler drop this module from other builds.
export const supabase = /* @__PURE__ */ createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const toUser = (session: Session | null): AuthUser | null =>
  session
    ? {
      id: session.user.id,
      email: session.user.email ?? null,
      name: (session.user.user_metadata?.full_name as string | undefined) ?? null,
    }
    : null;

// getSession() refreshes an expired access token automatically.
const fetchAccessToken = async () => {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
};

const AuthContext = createContext<AuthState | null>(null);

const SessionProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Pick<AuthState, "user" | "isLoading">>({
    user: null,
    isLoading: true,
  });
  const [_location, navigate] = useLocation();

  useEffect(() => {
    // INITIAL_SESSION fires right after subscribing, which ends the loading state.
    const { data } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        setSession({ user: toUser(session), isLoading: false });

        // if password recovery event, emit redirect to reset page
        if (event === "PASSWORD_RECOVERY") {
          navigate("/auth/change-password");
        }
      },
    );
    return () => data.subscription.unsubscribe();
  }, []);

  // New function only when the signed-in user changes
  const getAccessToken = useCallback(fetchAccessToken, [session.user?.id]);
  const value = useMemo(() => ({ ...session, getAccessToken }), [session, getAccessToken]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

const useAuth = (): AuthState => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within SessionProvider");
  return context;
};

export const supabaseAuth: AuthService = {
  kind: "supabase",
  SessionProvider,
  useAuth,

  password: {
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signUp: (email, password) => supabase.auth.signUp({ email, password }),
    resetPassword: (email) =>
      supabase.auth.resetPasswordForEmail(email, {
        // redirectTo: 'https://designserver.netlify.app',
      }),
    updatePassword: (newPassword) => supabase.auth.updateUser({ password: newPassword }),
  },

  signOut: async () => {
    await supabase.auth.signOut({ scope: "local" });
  },
};
