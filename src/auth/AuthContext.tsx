import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, getAuthToken, setAuthToken } from "../api/client";
import { getMyProfile } from "../api/rctf";
import { isAdminPerms, canWriteChalls, canWriteUsers } from "../utils";
import type { RctfProfile } from "../types";

interface AuthState {
  token: string | null;
  /** From rCTF's own `perms` bitmask on the profile below. polygl0ts-extras
   *  used to answer this on `/api/me`, which was a second identity round trip
   *  for a bit the profile already carries; it still enforces it server-side. */
  isAdmin: boolean;
  /** rCTF's `challsWrite` bit - a *different* permission from the `challsRead`
   *  behind `isAdmin`. It gates writing challenges (`PUT /v2/admin/challs/:id`),
   *  so an admin can be able to open the challenge panel and not to change
   *  anything in it. The server enforces this regardless; this only decides
   *  whether the control is offered. */
  canWriteChalls: boolean;
  /** rCTF's `usersWrite` bit, the team panel's counterpart to `challsWrite`:
   *  it gates banning and editing teams (`PUT /v2/admin/users/:id`). Held
   *  independently of `challsWrite`, so neither implies the other. */
  canWriteUsers: boolean;
  profile: RctfProfile | null;
  isLoading: boolean;
  isLoggedIn: boolean;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(getAuthToken());
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ["myProfile", token],
    queryFn: getMyProfile,
    enabled: !!token,
    retry: false,
  });

  const login = useCallback((newToken: string) => {
    setAuthToken(newToken);
    setToken(newToken);
  }, []);

  const logout = useCallback(() => {
    setAuthToken(null);
    setToken(null);
    queryClient.clear();
  }, [queryClient]);

  // A stored token rCTF no longer recognizes (it expired, or the in-memory
  // dev mock restarted and dropped its sessions) otherwise leaves the app
  // half-logged-in.
  const identityError = profileQuery.error;
  useEffect(() => {
    if (identityError instanceof ApiError && identityError.status === 401) {
      logout();
    }
  }, [identityError, logout]);

  const value = useMemo<AuthState>(
    () => ({
      token,
      isAdmin: isAdminPerms(profileQuery.data?.perms),
      canWriteChalls: canWriteChalls(profileQuery.data?.perms),
      canWriteUsers: canWriteUsers(profileQuery.data?.perms),
      profile: profileQuery.data ?? null,
      isLoading: !!token && profileQuery.isLoading,
      isLoggedIn: !!token,
      login,
      logout,
    }),
    [token, profileQuery.data, profileQuery.isLoading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
