import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, getAuthToken, setAuthToken } from "../api/client";
import { getMyProfile } from "../api/rctf";
import {
  isAdminPerms,
  canWriteChalls,
  canWriteUsers,
  challsSolveWrite,
} from "../utils";
import type { RctfProfile } from "../types";

interface AuthState {
  token: string | null;
  isAdmin: boolean;
  canWriteChalls: boolean;
  canWriteUsers: boolean;
  challsSolveWrite: boolean;
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
      challsSolveWrite: challsSolveWrite(profileQuery.data?.perms),
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
