import { useTranslation } from "react-i18next";
import { setLanguage, type Language } from "@/lib/i18n";
import { cx } from "./ui/cx";

const OPTIONS: Array<{ value: Language; label: string; lang: string }> = [
  { value: "en", label: "EN", lang: "en" },
  { value: "hi", label: "हिं", lang: "hi" },
];

/** compact: one button that switches to the other language, for crowded headers. */
export function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const { t, i18n } = useTranslation();
  if (compact) {
    const other = OPTIONS.find((o) => o.value !== i18n.language) ?? OPTIONS[0]!;
    return (
      <button
        type="button"
        lang={other.lang}
        aria-label={`${t("common.language")}: ${other.value === "hi" ? "हिन्दी" : "English"}`}
        onClick={() => setLanguage(other.value)}
        className="h-9 min-w-[44px] rounded-md border border-slate-300 bg-white px-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
      >
        {other.label}
      </button>
    );
  }
  return (
    <div role="group" aria-label={t("common.language")} className="flex overflow-hidden rounded-md border border-slate-300">
      {OPTIONS.map((option) => {
        const active = i18n.language === option.value;
        return (
          <button
            key={option.value}
            type="button"
            lang={option.lang}
            aria-pressed={active}
            onClick={() => setLanguage(option.value)}
            className={cx(
              "h-9 min-w-[44px] px-2 text-sm font-semibold transition-colors",
              active ? "bg-primary-700 text-white" : "bg-white text-slate-700 hover:bg-slate-50",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
