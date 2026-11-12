import { useQuery } from "@tanstack/react-query";
import { Brain } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { model } from "@/lib/api/endpoints";

const pct = (v?: number) => (v === undefined ? "—" : `${(v * 100).toFixed(1)}%`);

/** Status and test results of the wound-photo model, read from the trained model's metadata. */
export function ModelCard() {
  const { t } = useTranslation();
  const info = useQuery({ queryKey: ["model-info"], queryFn: model.info, staleTime: 60_000, retry: false });
  if (info.isPending) return <Skeleton className="h-24" />;
  const m = info.data?.metrics;
  return (
    <section aria-labelledby="model-title" className="flex flex-wrap items-start gap-6 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex min-w-[240px] flex-1 items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary-200 bg-primary-50 text-primary-800">
          <Brain className="h-5 w-5" aria-hidden />
        </span>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h2 id="model-title" className="font-bold">
              {t("admin.modelTitle")}
            </h2>
            <Badge tone={info.data?.loaded ? "success" : "neutral"}>{info.data?.loaded ? t("admin.modelLoaded") : t("admin.modelNotLoaded")}</Badge>
          </div>
          <p className="text-sm text-slate-700">{info.data?.loaded ? t("admin.modelNote") : t("admin.modelMissing")}</p>
          {info.data?.trained_at && <p className="text-xs text-slate-600">{t("admin.modelTrained", { date: info.data.trained_at })}</p>}
        </div>
      </div>
      {info.data?.loaded && m?.test_accuracy !== undefined && (
        <dl className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-slate-600">{t("admin.modelAccuracy")}</dt>
            <dd className="tabular m-0 text-lg font-bold">{pct(m.test_accuracy)}</dd>
          </div>
          <div>
            <dt className="text-slate-600">{t("admin.modelF1")}</dt>
            <dd className="tabular m-0 text-lg font-bold">{m.test_macro_f1?.toFixed(3) ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-600">{t("admin.modelCoverage")}</dt>
            <dd className="tabular m-0 text-lg font-bold">{pct(m.coverage)}</dd>
          </div>
          <div>
            <dt className="text-slate-600">{t("admin.modelSelective")}</dt>
            <dd className="tabular m-0 text-lg font-bold">{pct(m.selective_accuracy)}</dd>
          </div>
        </dl>
      )}
    </section>
  );
}
