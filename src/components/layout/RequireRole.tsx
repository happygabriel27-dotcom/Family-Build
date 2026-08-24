import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { isRouteAllowed } from "../../data/permissions";
import { useApp } from "../../store/AppContext";
import { AccessDeniedPage } from "../../pages/AccessDeniedPage";

interface RequireRoleProps {
  children: ReactNode;
}

/**
 * Mock authorization gate. Navigation already filters by role,
 * but this also blocks direct URL access to role-inappropriate
 * routes — mirroring what a real backend would enforce.
 */
export function RequireRole({ children }: RequireRoleProps) {
  const { user } = useApp();
  const location = useLocation();

  if (!user) return null; // handled by auth redirect in App

  if (!isRouteAllowed(location.pathname, user.role)) {
    return <AccessDeniedPage />;
  }
  return <>{children}</>;
}