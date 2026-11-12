import { useTranslation } from "react-i18next";

export function SimulatedTag() {
  const { t } = useTranslation();
  return <span className="whitespace-nowrap rounded border border-slate-300 px-1.5 text-xs font-semibold text-slate-700">{t("common.simulated")}</span>;
}
