import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, ChevronRight, ShieldCheck, Smartphone, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Call112Button } from "@/components/Call112Button";
import { LanguageToggle } from "@/components/LanguageToggle";
import { LogoMark } from "@/components/Logo";
import { cx } from "@/components/ui/cx";
import { InlineError, useErrorMessage } from "@/components/ui/States";
import { auth } from "@/lib/api/endpoints";
import type { Me } from "@/lib/api/types";
import { ME_KEY } from "@/features/auth/useMe";

const DEMO = {
  citizenPhone: "9811024521",
  staffEmail: "staff.h3@jeevansetu.demo",
  staffPassword: "Demo@2026!",
  adminEmail: "admin@jeevansetu.demo",
  adminPassword: "Admin@2026!",
};

type Role = "citizen" | "staff" | "admin";

async function signIn(role: Role): Promise<Me> {
  if (role === "staff") return auth.login(DEMO.staffEmail, DEMO.staffPassword);
  if (role === "admin") return auth.login(DEMO.adminEmail, DEMO.adminPassword);
  const { dev_code } = await auth.requestOtp(DEMO.citizenPhone);
  if (!dev_code) throw new Error("otp-off");
  return auth.verifyOtp(DEMO.citizenPhone, dev_code);
}

/** One-click demo sign-in for presentations. It uses the same API as the real sign-in screens. */
export function DemoPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const client = useQueryClient();
  const errorMessage = useErrorMessage();
  const login = useMutation({
    mutationFn: signIn,
    onSuccess: (me, role) => {
      client.clear();
      client.setQueryData(ME_KEY, me);
      navigate(role === "citizen" ? "/" : role === "staff" ? "/staff" : "/admin");
    },
  });

  const roles: Array<{ role: Role; icon: LucideIcon; title: string; desc: string; action: string; account: string }> = [
    { role: "citizen", icon: Smartphone, title: t("demo.citizenRole"), desc: t("demo.citizenDesc"), action: t("demo.citizenAction"), account: "+91 98110 24521" },
    { role: "staff", icon: Building2, title: t("demo.staffRole"), desc: t("demo.staffDesc"), action: t("demo.staffAction"), account: DEMO.staffEmail },
    { role: "admin", icon: ShieldCheck, title: t("demo.adminRole"), desc: t("demo.adminDesc"), action: t("demo.adminAction"), account: DEMO.adminEmail },
  ];

  return (
    <div className="min-h-[100dvh] bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <span className="flex items-center gap-2 font-bold">
            <LogoMark size={32} />
            {t("common.appName")}
          </span>
          <LanguageToggle />
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-10 px-4 py-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="flex flex-col gap-6">
          <div className="flex items-start gap-4">
            <LogoMark size={64} className="shrink-0" />
            <div className="flex flex-col gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{t("demo.title")}</h1>
              <p className="max-w-xl text-slate-700">{t("demo.sub")}</p>
            </div>
          </div>

          <ul className="flex flex-col divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
            {roles.map(({ role, icon: Icon, title, desc, action, account }) => {
              const busy = login.isPending && login.variables === role;
              return (
                <li key={role}>
                  <button
                    type="button"
                    disabled={login.isPending}
                    onClick={() => login.mutate(role)}
                    className={cx(
                      "group flex w-full items-start gap-4 p-5 text-left transition-colors hover:bg-primary-50 disabled:cursor-wait",
                      busy && "bg-primary-50",
                    )}
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-primary-200 bg-primary-50 text-primary-800">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="text-lg font-bold text-slate-900">{title}</span>
                      <span className="text-sm text-slate-700">{desc}</span>
                      <span className="tabular text-xs text-slate-600">{account}</span>
                      <span className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-primary-700">
                        {busy ? t("demo.signingIn") : action}
                        <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {login.isError && <InlineError>{login.error instanceof Error && login.error.message === "otp-off" ? t("demo.otpOff") : errorMessage(login.error)}</InlineError>}
        </section>

        <aside className="flex flex-col gap-4">
          <section aria-labelledby="flow-title" className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 id="flow-title" className="mb-3 font-bold">
              {t("demo.flowTitle")}
            </h2>
            <ol className="flex flex-col gap-3">
              {[t("demo.flow1"), t("demo.flow2"), t("demo.flow3"), t("demo.flow4")].map((step, i) => (
                <li key={step} className="grid grid-cols-[24px_minmax(0,1fr)] gap-3 text-sm text-slate-800">
                  <span className="tabular flex h-6 w-6 items-center justify-center rounded-full bg-primary-700 text-xs font-bold text-white">{i + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
          </section>
          <nav className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-5 text-sm font-semibold">
            <a href="/scorecard" className="text-primary-700">
              {t("demo.scorecardLink")}
            </a>
            <a href="/coming-soon" className="text-primary-700">
              {t("demo.futureLink")}
            </a>
          </nav>
          <section className="flex flex-col gap-3 rounded-lg border border-danger-200 bg-danger-50 p-5">
            <p className="text-sm text-danger-900">{t("demo.simulated")}</p>
            <Call112Button variant="solid" />
          </section>
        </aside>
      </main>
    </div>
  );
}
