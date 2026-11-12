import { CheckCircle2, Info } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Call112Button } from "@/components/Call112Button";
import { buttonClasses, Button } from "@/components/ui/Button";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import type { DrillPreview } from "@/lib/api/types";
import { formatCountdown, formatKm, formatScore } from "@/lib/format";
import { BackHeader } from "@/features/citizen/BackHeader";
import { CitizenLayout } from "@/features/citizen/CitizenLayout";
import { useDrill } from "./DrillContext";

const SIMULATED_REPLY_SECONDS = 15;

/** A drill result is simulated end to end. Nothing here touches a hospital. */
export function DrillResultPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setDrill } = useDrill();
  const state = useLocation().state as { preview?: DrillPreview } | null;
  const [left, setLeft] = useState(SIMULATED_REPLY_SECONDS);

  useEffect(() => {
    const timer = window.setInterval(() => setLeft((n) => Math.max(0, n - 1)), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (!state?.preview) return <Navigate to="/" replace />;
  const { preview } = state;
  const first = preview.candidates[0];

  return (
    <CitizenLayout header={<BackHeader to="/" title={t("drill.resultTitle")} />}>
      <p role="status" className="flex items-start gap-2 rounded-lg border border-info-200 bg-info-50 p-4 text-sm font-semibold text-info-900">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        {t("drill.nothingSent")}
      </p>

      <section className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-700">{t("drill.priority")}</h2>
        <PriorityBadge priority={preview.priority} />
        <ul className="list-disc pl-5 text-sm text-slate-800">
          {preview.priority_reasons.map((r) => (
            <li key={`${r.rule}-${r.text}`}>{r.text}</li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-slate-700">{t("drill.candidates")}</h2>
        {preview.candidates.length === 0 ? (
          <p className="rounded-lg border border-slate-200 bg-white p-4">{t("drill.noCandidates")}</p>
        ) : (
          <ol className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
            {preview.candidates.map((c, i) => (
              <li key={c.hospital_id} className="flex items-center justify-between gap-3 p-4">
                <span className="flex flex-col">
                  <span className="font-semibold">
                    {i + 1}. {c.name}
                  </span>
                  <span className="text-sm text-slate-600">{t("common.km", { value: formatKm(c.distance_km) })}</span>
                </span>
                <span className="tabular text-sm font-semibold">{formatScore(c.score)}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {first && (
        <p role="status" className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-4 font-semibold">
          {left > 0 ? (
            <span className="tabular">{t("drill.simulatedReply", { time: formatCountdown(left) })}</span>
          ) : (
            <>
              <CheckCircle2 className="h-5 w-5 text-success-700" aria-hidden />
              {t("drill.simulatedAccepted", { name: first.name })}
            </>
          )}
        </p>
      )}

      <div className="mt-auto flex flex-col gap-2">
        <Link to="/report" className={buttonClasses("primary", "lg")}>
          {t("drill.again")}
        </Link>
        <Button
          variant="secondary"
          onClick={() => {
            setDrill(false);
            navigate("/", { replace: true });
          }}
        >
          {t("drill.exit")}
        </Button>
        <Call112Button variant="outline" />
      </div>
    </CitizenLayout>
  );
}
