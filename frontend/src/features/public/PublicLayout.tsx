import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Call112Button } from "@/components/Call112Button";
import { LanguageToggle } from "@/components/LanguageToggle";
import { Logo } from "@/components/Logo";

export function PublicLayout({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-[100dvh] bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className={`mx-auto flex h-16 items-center justify-between gap-2 px-4 ${wide ? "max-w-5xl" : "max-w-citizen"}`}>
          <Link to="/demo" className="no-underline">
            <Logo />
          </Link>
          <div className="flex items-center gap-2">
            <LanguageToggle compact />
            <Call112Button variant="compact" />
          </div>
        </div>
      </header>
      <main className={`mx-auto flex flex-col gap-5 px-4 py-6 ${wide ? "max-w-5xl" : "max-w-citizen"}`}>{children}</main>
    </div>
  );
}
