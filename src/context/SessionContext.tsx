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
import { createContext, useContext, useEffect, useState } from "react";
import {
  AuthTokenResponsePassword,
  createClient,
  Session,
} from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../config.ts";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const SessionContext = createContext<{
  session: Session | null;
}>({
  session: null,
});

export const useSession = () => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
};

type Props = { children: React.ReactNode };
export const SessionProvider = ({ children }: Props) => {
  const [session, setSession] = useState<Session | null>(null);
  // const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const authStateListener = supabase.auth.onAuthStateChange(
      async (_: any, session: Session | null) => {
        setSession(session);
        // setIsLoading(false);
      },
    );

    return () => {
      authStateListener.data.subscription.unsubscribe();
    };
  }, [supabase]);

  return (
    <SessionContext.Provider value={{ session }}>
      {/*{isLoading ? <LoadingPage /> : children}*/}
      {children}
    </SessionContext.Provider>
  );
};

export const signOut = () => supabase.auth.signOut();

export const signIn = async (
  userName: string,
  password: string,
): Promise<AuthTokenResponsePassword> => {
  return supabase.auth.signInWithPassword({
    email: userName,
    password: password,
  });
};

export const getAccessToken = (session: Session | null) =>
  session !== null ? session.access_token : null;
