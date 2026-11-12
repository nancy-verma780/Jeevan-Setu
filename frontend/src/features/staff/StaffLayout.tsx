import { BedDouble, Inbox, LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { LanguageToggle } from "@/components/LanguageToggle";
import { Logo } from "@/components/Logo";
import { OfflineBanner } from "@/components/ui/OfflineBanner";
import { useMe, useSignOut } from "@/features/auth/useMe";

/** Side menu plus content. On narrow screens the menu stacks above the content. */
export function StaffLayout({ children, pendingCount }: { children: ReactNode; pendingCount?: number }) {
  const { t } = useTranslation();
  const me = useMe();
  const signOut = useSignOut("/staff/login");
  return (
    <div className="flex min-h-[100dvh] flex-col bg-slate-50">
      <OfflineBanner />
      <div className="flex flex-1 flex-wrap">
        <nav aria-label={t("staff.portal")} className="flex flex-[1_1_216px] flex-col gap-6 border-b border-r border-slate-200 bg-white p-4 lg:max-w-[240px] lg:border-b-0">
          <Logo subtitle={t("staff.portal")} />
          <ul className="flex flex-col gap-1">
            <li>
              <a href="#queue" aria-current="page" className="flex min-h-[40px] items-center gap-3 rounded-md bg-primary-50 px-3 font-semibold text-primary-800 no-underline">
                <Inbox className="h-4 w-4" aria-hidden />
                <span className="flex-1">{t("staff.navIncoming")}</span>
                {pendingCount !== undefined && <span className="tabular">{pendingCount}</span>}
              </a>
            </li>
            <li>
              <a href="#resources" className="flex min-h-[40px] items-center gap-3 rounded-md px-3 text-slate-700 no-underline hover:bg-slate-50">
                <BedDouble className="h-4 w-4" aria-hidden />
                {t("staff.navResources")}
              </a>
            </li>
          </ul>
          <div className="mt-auto flex flex-col gap-1 border-t border-slate-200 pt-3 text-sm">
            <span className="font-semibold">{me.data?.name}</span>
            <span className="text-xs text-slate-600">{me.data?.hospital_name}</span>
            <div className="mt-2 flex items-center justify-between gap-2">
              <button type="button" onClick={() => signOut.mutate()} className="inline-flex min-h-[32px] items-center gap-2 text-slate-700 hover:text-slate-900">
                <LogOut className="h-4 w-4" aria-hidden />
                {t("common.signOut")}
              </button>
              <LanguageToggle />
            </div>
          </div>
        </nav>
        <main className="flex min-w-0 flex-[999_1_560px] flex-col gap-4 p-4 lg:px-8 lg:py-6">{children}</main>
      </div>
    </div>
  );
}
