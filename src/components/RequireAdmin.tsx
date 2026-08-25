import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isLoggedIn, isLoading, isAdmin } = useAuth();

  if (!isLoggedIn) return <Navigate to="/login" replace />;
  if (isLoading) return <div className="loading">Loading...</div>;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}
