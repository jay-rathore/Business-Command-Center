"use client";

import { createContext, useContext } from "react";
import { AuthUser } from "./types";

const AuthUserContext = createContext<AuthUser | null>(null);

export function AuthUserProvider({ user, children }: { user: AuthUser; children: React.ReactNode }) {
  return <AuthUserContext.Provider value={user}>{children}</AuthUserContext.Provider>;
}

/** Only usable inside (app)/layout.tsx's subtree — that layout guarantees a non-null user
 * before rendering, so this throws loudly if used somewhere the guard doesn't cover. */
export function useAuthUser(): AuthUser {
  const user = useContext(AuthUserContext);
  if (!user) throw new Error("useAuthUser() called outside AuthUserProvider");
  return user;
}
