import { LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { LanguageToggle } from "@/components/LanguageToggle";
import { Logo } from "@/components/Logo";
import { OfflineBanner } from "@/components/ui/OfflineBanner";
import { useMe, useSignOut } from "@/features/auth/useMe";

export function AdminLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const me = useMe();
  const signOut = useSignOut("/staff/login");
  return (
    <div className="min-h-[100dvh] bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between gap-4 px-4 lg:px-8">
          <Logo subtitle={t("admin.portal")} />
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-slate-700 sm:inline">{me.data?.name}</span>
            <LanguageToggle />
            <button type="button" onClick={() => signOut.mutate()} className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 px-3 text-slate-700 hover:bg-slate-50">
              <LogOut className="h-4 w-4" aria-hidden />
              {t("common.signOut")}
            </button>
          </div>
        </div>
        <OfflineBanner />
      </header>
      <main className="mx-auto flex max-w-[1280px] flex-col gap-6 px-4 py-6 lg:px-8">{children}</main>
    </div>
  );
}
