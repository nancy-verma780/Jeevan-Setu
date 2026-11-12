import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Eye } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { emergencies } from "@/lib/api/endpoints";
import { formatTime } from "@/lib/format";

/** Patient-side access log: exactly which hospital staff opened this request, and when. */
export function AccessLog({ requestId }: { requestId: number }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const log = useQuery({ queryKey: ["access-log", requestId], queryFn: () => emergencies.accessLog(requestId), enabled: open });
  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex min-h-tap w-full items-center gap-3 px-4 text-left font-semibold">
        <Eye className="h-4 w-4 text-primary-700" aria-hidden />
        <span className="flex-1">{t("access.title")}</span>
        {open ? <ChevronUp className="h-4 w-4" aria-hidden /> : <ChevronDown className="h-4 w-4" aria-hidden />}
      </button>
      {open && (
        <div className="border-t border-slate-200 p-4 text-sm">
          {log.isPending && <p className="text-slate-600">{t("common.loading")}</p>}
          {log.data && log.data.length === 0 && <p className="text-slate-600">{t("access.empty")}</p>}
          {log.data && log.data.length > 0 && (
            <ol className="flex flex-col gap-2">
              {log.data.map((row) => (
                <li key={row.id} className="grid grid-cols-[64px_minmax(0,1fr)] gap-2">
                  <time className="tabular text-slate-600">{formatTime(row.created_at, true)}</time>
                  <span>{t(`access.${row.action}`, { staff: row.staff_name, hospital: row.hospital_name, defaultValue: row.action })}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  );
}
