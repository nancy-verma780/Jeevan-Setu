import { Ambulance, Brain, Droplet, HeartHandshake, Map, Microscope, Smartphone, BedDouble, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/Badge";
import { PublicLayout } from "./PublicLayout";

const ITEMS: Array<[string, LucideIcon]> = [
  ["crash", Smartphone],
  ["cpr", HeartHandshake],
  ["blood", Droplet],
  ["corridor", Ambulance],
  ["beds", BedDouble],
  ["blackspots", Map],
  ["ood", Brain],
  ["acute", Microscope],
];

/** [FUTURE] features: clearly labelled placeholders. Nothing here is functional. */
export function ComingSoonPage() {
  const { t } = useTranslation();
  return (
    <PublicLayout wide>
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">{t("future.title")}</h1>
        <p className="text-sm text-slate-700">{t("future.sub")}</p>
      </div>
      <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
        {ITEMS.map(([key, Icon]) => (
          <li key={key} className="flex items-start gap-4 p-4">
            <Icon className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" aria-hidden />
            <span className="flex-1 text-slate-800">{t(`future.${key}`)}</span>
            <Badge>{t("future.badge")}</Badge>
          </li>
        ))}
      </ul>
    </PublicLayout>
  );
}
