import { useTranslation } from "react-i18next";
import { Switch } from "@/components/ui/Switch";
import { useDisplayPrefs } from "@/lib/hooks/useDisplayPrefs";
import { BackHeader } from "./BackHeader";
import { CitizenLayout } from "./CitizenLayout";

/** Accessibility modes: high contrast, larger text and Simple Mode (three big options). */
export function DisplayPage() {
  const { t } = useTranslation();
  const [prefs, set] = useDisplayPrefs();
  const rows: Array<[keyof typeof prefs, string, string]> = [
    ["simple", t("display.simple"), t("display.simpleHint")],
    ["largeText", t("display.large"), t("display.largeHint")],
    ["highContrast", t("display.contrast"), t("display.contrastHint")],
  ];
  return (
    <CitizenLayout header={<BackHeader to="/" title={t("display.title")} />}>
      <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
        {rows.map(([key, label, hint]) => (
          <li key={key} className="flex items-center justify-between gap-4 p-4">
            <span className="flex flex-col gap-1">
              <span id={`display-${key}`} className="font-semibold">
                {label}
              </span>
              <span className="text-sm text-slate-600">{hint}</span>
            </span>
            <Switch checked={prefs[key]} onChange={(v) => set({ [key]: v })} labelledBy={`display-${key}`} />
          </li>
        ))}
      </ul>
      <p className="text-xs text-slate-600">{t("display.note")}</p>
    </CitizenLayout>
  );
}
