import { useQuery } from "@tanstack/react-query";
import { BookOpen, ChevronRight, IdCard, MapPin, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Call112Button } from "@/components/Call112Button";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { emergencies } from "@/lib/api/endpoints";
import { formatDateTime, maskPhone } from "@/lib/format";
import { useMe, useSignOut } from "@/features/auth/useMe";
import { useDrill } from "@/features/drill/DrillContext";
import { CitizenLayout } from "./CitizenLayout";
import { RequestStatusBadge } from "./RequestStatusBadge";

export function HomePage() {
  const { t, i18n } = useTranslation();
  const { drill } = useDrill();
  const me = useMe();
  const signOut = useSignOut("/login");
  const list = useQuery({ queryKey: ["emergencies"], queryFn: emergencies.list, refetchInterval: 15_000 });

  const footer = (
    <div className="flex flex-col gap-2">
      <Link
        to="/report"
        className="flex min-h-[96px] items-center gap-4 rounded-lg bg-primary-700 px-6 py-4 text-white no-underline hover:bg-primary-800"
      >
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-white text-base font-bold tracking-wide">SOS</span>
        <span className="flex flex-col gap-1">
          <span className="text-lg font-bold">{t("home.sosTitle")}</span>
          <span className="text-sm text-primary-100">{drill ? t("home.sosSubDrill") : t("home.sosSub")}</span>
        </span>
      </Link>
      <Call112Button variant="outline" />
    </div>
  );

  return (
    <CitizenLayout showDrillToggle footer={footer}>
      <section className="flex flex-col gap-2">
        <h1 className="text-xl font-bold">{t("home.greeting")}</h1>
        <p className="text-slate-700">{t("home.sub")}</p>
      </section>

      <section aria-labelledby="my-requests" className="flex flex-col gap-2">
        <h2 id="my-requests" className="text-sm font-semibold text-slate-700">
          {t("home.myRequests")}
        </h2>
        {list.isPending && <ListSkeleton rows={2} />}
        {list.isError && <ErrorState error={list.error} onRetry={() => void list.refetch()} />}
        {list.data && list.data.length === 0 && <EmptyState title={t("home.emptyTitle")} body={t("home.emptyBody")} />}
        {list.data && list.data.length > 0 && (
          <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
            {list.data.map((item) => (
              <li key={item.id}>
                <Link to={`/requests/${item.id}`} className="flex min-h-tap items-center gap-4 p-4 text-slate-900 no-underline hover:bg-slate-50">
                  <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
                    <span className="font-semibold">{t(`injury.${item.injury_type}`)}</span>
                    <span className="text-sm text-slate-600">
                      {formatDateTime(item.created_at, i18n.language, t("common.today"))}, {item.public_code}
                    </span>
                    <RequestStatusBadge status={item.status} hospital={item.status === "HOSPITAL_ACCEPTED" ? item.hospital_name : null} />
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-slate-500" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <nav aria-label={t("home.more")} className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <Link to="/hospitals" className="flex min-h-tap items-center gap-4 p-4 text-slate-900 no-underline hover:bg-slate-50">
          <MapPin className="h-5 w-5 text-primary-700" aria-hidden />
          <span className="flex-1 font-medium">{t("home.nearby")}</span>
          <ChevronRight className="h-5 w-5 text-slate-500" aria-hidden />
        </Link>
        <Link to="/first-aid" className="flex min-h-tap items-center gap-4 p-4 text-slate-900 no-underline hover:bg-slate-50">
          <BookOpen className="h-5 w-5 text-primary-700" aria-hidden />
          <span className="flex-1 font-medium">{t("home.firstAid")}</span>
          <ChevronRight className="h-5 w-5 text-slate-500" aria-hidden />
        </Link>
        <Link to="/passport" className="flex min-h-tap items-center gap-4 p-4 text-slate-900 no-underline hover:bg-slate-50">
          <IdCard className="h-5 w-5 text-primary-700" aria-hidden />
          <span className="flex-1 font-medium">{t("home.passport")}</span>
          <ChevronRight className="h-5 w-5 text-slate-500" aria-hidden />
        </Link>
        <Link to="/coming-soon" className="flex min-h-tap items-center gap-4 p-4 text-slate-900 no-underline hover:bg-slate-50">
          <Sparkles className="h-5 w-5 text-slate-500" aria-hidden />
          <span className="flex-1 font-medium text-slate-700">{t("home.comingSoon")}</span>
          <ChevronRight className="h-5 w-5 text-slate-500" aria-hidden />
        </Link>
      </nav>

      {me.data?.phone && (
        <p className="flex items-center justify-between gap-2 text-xs text-slate-600">
          {t("home.signedInAs", { phone: maskPhone(me.data.phone) })}
          <button type="button" onClick={() => signOut.mutate()} className="min-h-tap px-2 font-semibold text-primary-700">
            {t("common.signOut")}
          </button>
        </p>
      )}
    </CitizenLayout>
  );
}
