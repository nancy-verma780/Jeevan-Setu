import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

export function BackHeader({ to, onBack, title, subtitle }: { to?: string; onBack?: () => void; title: string; subtitle?: string }) {
  const { t } = useTranslation();
  const icon = <ArrowLeft className="h-6 w-6" aria-hidden />;
  const cls = "-ml-2 flex h-12 w-12 shrink-0 items-center justify-center rounded-md text-slate-900 hover:bg-slate-100";
  return (
    <div className="flex min-w-0 items-center gap-1">
      {onBack ? (
        <button type="button" onClick={onBack} aria-label={t("common.back")} className={cls}>
          {icon}
        </button>
      ) : (
        <Link to={to ?? "/"} aria-label={t("common.back")} className={cls}>
          {icon}
        </Link>
      )}
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-semibold">{title}</span>
        {subtitle && <span className="tabular truncate text-xs text-slate-600">{subtitle}</span>}
      </span>
    </div>
  );
}
