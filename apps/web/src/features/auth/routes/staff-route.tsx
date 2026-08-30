import { Navigate, Outlet, useLocation } from "react-router-dom";
import type { ReactNode } from "react";

import { useAuth } from "../context/auth-context";
import { hasStaffPermission, type Permission } from "../model/auth";
import {
  CUSTOMER_HOME_PATH,
  createLoginPath,
} from "../routing/auth-paths";
import { PermissionDenied, SessionLoading } from "./route-feedback";

export type StaffRouteProps = Readonly<{
  children?: ReactNode;
  permission?: Permission;
  loadingFallback?: ReactNode;
  permissionDeniedFallback?: ReactNode;
}>;

export function StaffRoute({
  children,
  permission,
  loadingFallback,
  permissionDeniedFallback,
}: StaffRouteProps) {
  const { session, status } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return loadingFallback ?? <SessionLoading />;
  }

  if (session.kind === "anonymous") {
    return <Navigate replace to={createLoginPath(location)} />;
  }

  if (session.kind === "customer") {
    return <Navigate replace to={CUSTOMER_HOME_PATH} />;
  }

  if (permission !== undefined && !hasStaffPermission(session, permission)) {
    return permissionDeniedFallback ?? <PermissionDenied permission={permission} />;
  }

  return children ?? <Outlet />;
}
