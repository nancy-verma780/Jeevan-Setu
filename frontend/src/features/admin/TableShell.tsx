import type { UseQueryResult } from "@tanstack/react-query";
import { Download } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { buttonClasses } from "@/components/ui/Button";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { Table, type Column } from "@/components/ui/Table";

/** Filters on the left, CSV export on the right, then the table with its loading, error and empty states. */
export function TableShell<T>({
  filters,
  csvHref,
  query,
  columns,
  rowKey,
  caption,
  actions,
}: {
  filters?: ReactNode;
  csvHref: string;
  query: UseQueryResult<T[]>;
  columns: Column<T>[];
  rowKey: (row: T) => number | string;
  caption: string;
  actions?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">{filters}</div>
        <div className="flex gap-2">
          {actions}
          <a href={csvHref} className={buttonClasses("secondary", "sm")} download>
            <Download className="h-4 w-4" aria-hidden />
            {t("admin.exportCsv")}
          </a>
        </div>
      </div>
      {query.isPending && <TableSkeleton rows={5} columns={Math.min(columns.length, 7)} />}
      {query.isError && <ErrorState error={query.error} onRetry={() => void query.refetch()} />}
      {query.data && query.data.length === 0 && <EmptyState title={t("admin.emptyRows")} body={t("admin.emptyRowsBody")} />}
      {query.data && query.data.length > 0 && <Table caption={caption} columns={columns} rows={query.data} rowKey={rowKey} minWidth={880} />}
    </div>
  );
}

export function FilterField({ label, children }: { label: string; children: (id: string) => ReactNode }) {
  const id = `f-${label.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-semibold text-slate-700">
        {label}
      </label>
      {children(id)}
    </div>
  );
}

export const FILTER_CONTROL = "h-9 rounded-md border border-slate-400 bg-white px-2 text-sm";
