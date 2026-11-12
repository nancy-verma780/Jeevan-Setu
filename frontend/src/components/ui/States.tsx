import { AlertCircle, Inbox, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/lib/api/client";
import { Button } from "./Button";
import { cx } from "./cx";

export function EmptyState({
  icon: Icon = Inbox,
  title,
  body,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  body?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-col items-center gap-2 rounded-lg border border-slate-200 bg-white px-6 py-12 text-center", className)}>
      <Icon className="h-8 w-8 text-slate-500" aria-hidden />
      <p className="text-base font-semibold text-slate-900">{title}</p>
      {body && <p className="max-w-sm text-sm text-slate-600">{body}</p>}
      {action}
    </div>
  );
}

export function useErrorMessage(): (error: unknown) => string {
  const { t } = useTranslation();
  return (error) => {
    if (error instanceof ApiError) {
      if (error.code === "offline") return t("errors.offline");
      if (error.code === "network") return t("errors.network");
      if (error.status === 401) return t("errors.session");
      if (error.message) return error.message;
    }
    return t("errors.generic");
  };
}

export function ErrorState({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  const { t } = useTranslation();
  const message = useErrorMessage();
  return (
    <div role="alert" className={cx("flex flex-col items-center gap-2 rounded-lg border border-slate-200 bg-white px-6 py-10 text-center", className)}>
      <AlertCircle className="h-8 w-8 text-danger-700" aria-hidden />
      <p className="text-base font-semibold text-slate-900">{t("errors.title")}</p>
      <p className="max-w-sm text-sm text-slate-700">{message(error)}</p>
      {onRetry && (
        <Button variant="secondary" size="md" onClick={onRetry} className="mt-2">
          {t("common.retry")}
        </Button>
      )}
    </div>
  );
}

export function InlineError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="flex items-start gap-2 rounded-md border border-danger-200 bg-danger-50 p-3 text-sm text-danger-900">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}
