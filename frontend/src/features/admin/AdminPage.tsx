import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cx } from "@/components/ui/cx";
import { AdminLayout } from "./AdminLayout";
import { AuditTab } from "./AuditTab";
import { HospitalPerformance } from "./HospitalPerformance";
import { HospitalsTab } from "./HospitalsTab";
import { InsightsTab } from "./InsightsTab";
import { OutboxTab } from "./OutboxTab";
import { MapTab } from "./MapTab";
import { Metrics } from "./Metrics";
import { ModelCard } from "./ModelCard";
import { SurgeCard } from "./SurgeCard";
import { RequestsTab } from "./RequestsTab";
import { StaffTab } from "./StaffTab";

const TABS = ["requests", "insights", "map", "hospitals", "staff", "outbox", "audit"] as const;
type Tab = (typeof TABS)[number];
const LABEL: Record<Tab, string> = { requests: "admin.tabRequests", insights: "admin.tabInsights", outbox: "admin.tabOutbox", map: "admin.tabMap", hospitals: "admin.tabHospitals", staff: "admin.tabStaff", audit: "admin.tabAudit" };

export function AdminPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("requests");
  return (
    <AdminLayout>
      <h1 className="text-xl font-bold">{t("admin.title")}</h1>
      <Metrics />
      <SurgeCard />
      <ModelCard />
      <HospitalPerformance />
      <div role="tablist" aria-label={t("admin.title")} className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`tab-${key}`}
            aria-selected={tab === key}
            aria-controls={`panel-${key}`}
            onClick={() => setTab(key)}
            className={cx(
              "-mb-px h-10 shrink-0 border-b-2 px-4 text-sm font-semibold",
              tab === key ? "border-primary-700 text-primary-700" : "border-transparent text-slate-600 hover:text-slate-900",
            )}
          >
            {t(LABEL[key])}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "requests" && <RequestsTab />}
        {tab === "insights" && <InsightsTab />}
        {tab === "outbox" && <OutboxTab />}
        {tab === "map" && <MapTab />}
        {tab === "hospitals" && <HospitalsTab />}
        {tab === "staff" && <StaffTab />}
        {tab === "audit" && <AuditTab />}
      </div>
    </AdminLayout>
  );
}
