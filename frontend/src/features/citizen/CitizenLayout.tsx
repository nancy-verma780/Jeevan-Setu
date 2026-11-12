import { Info } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Call112Button } from "@/components/Call112Button";
import { LanguageToggle } from "@/components/LanguageToggle";
import { Logo } from "@/components/Logo";
import { cx } from "@/components/ui/cx";
import { OfflineBanner } from "@/components/ui/OfflineBanner";
import { SurgeBanner } from "@/components/SurgeBanner";
import { useDrill } from "@/features/drill/DrillContext";

interface Props {
  children: ReactNode;
  /** Replaces the logo with a back link and a title. */
  header?: ReactNode;
  footer?: ReactNode;
  showDrillToggle?: boolean;
}

/** Mobile-first column, centred at 480px on larger screens. */
export function CitizenLayout({ children, header, footer, showDrillToggle = false }: Props) {
  const { t } = useTranslation();
  const { drill, setDrill } = useDrill();
  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-citizen flex-col border-x border-slate-200 bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="flex h-16 items-center justify-between gap-2 px-4">
          {header ?? (
            <Link to="/" className="no-underline">
              <Logo />
            </Link>
          )}
          <div className="flex shrink-0 items-center gap-2">
            <LanguageToggle compact={Boolean(header)} />
            {showDrillToggle ? (
              <button
                type="button"
                aria-pressed={drill}
                onClick={() => setDrill(!drill)}
                className={cx(
                  "h-9 rounded-md border px-3 text-sm font-semibold transition-colors",
                  drill ? "border-info-700 bg-info-50 text-info-800" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
                )}
              >
                {t("home.practice")}
              </button>
            ) : (
              <Call112Button variant="compact" />
            )}
          </div>
        </div>
        <OfflineBanner />
        <SurgeBanner />
        {drill && (
          <div role="status" className="flex items-start gap-2 border-t border-info-200 bg-info-50 px-4 py-2 text-sm text-info-900">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {t("home.drillBanner")}
          </div>
        )}
      </header>
      <main className="flex flex-1 flex-col gap-6 px-4 py-6">{children}</main>
      {footer && <div className="sticky bottom-0 z-20 border-t border-slate-200 bg-white px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">{footer}</div>}
    </div>
  );
}
