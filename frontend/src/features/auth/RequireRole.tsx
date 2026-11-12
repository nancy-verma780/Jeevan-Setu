import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import type { Role } from "@/lib/api/types";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";
import { useMe } from "./useMe";

const HOME: Record<Role, string> = { citizen: "/", staff: "/staff", admin: "/admin" };

export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const me = useMe();
  const location = useLocation();

  if (me.isPending) {
    return (
      <div role="status" aria-busy="true" className="mx-auto flex max-w-citizen flex-col gap-4 p-4">
        <Skeleton className="h-16" />
        <Skeleton className="h-32" />
        <Skeleton className="h-24" />
      </div>
    );
  }
  if (me.isError) return <ErrorState error={me.error} onRetry={() => void me.refetch()} className="m-4" />;
  if (!me.data) {
    return <Navigate to={role === "citizen" ? "/login" : "/staff/login"} replace state={{ from: location.pathname }} />;
  }
  if (me.data.role !== role) return <Navigate to={HOME[me.data.role]} replace />;
  return <>{children}</>;
}

export function homeFor(role: Role): string {
  return HOME[role];
}
