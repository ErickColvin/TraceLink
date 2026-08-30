import { Navigate, Outlet, useLocation } from "react-router-dom";
import type { ReactNode } from "react";

import { useAuth } from "../context/auth-context";
import {
  STAFF_HOME_PATH,
  createLoginPath,
} from "../routing/auth-paths";
import { SessionLoading } from "./route-feedback";

export type CustomerRouteProps = Readonly<{
  children?: ReactNode;
  loadingFallback?: ReactNode;
}>;

export function CustomerRoute({
  children,
  loadingFallback,
}: CustomerRouteProps) {
  const { session, status } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return loadingFallback ?? <SessionLoading />;
  }

  if (session.kind === "anonymous") {
    return <Navigate replace to={createLoginPath(location)} />;
  }

  if (session.kind === "staff") {
    return <Navigate replace to={STAFF_HOME_PATH} />;
  }

  return children ?? <Outlet />;
}
