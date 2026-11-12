import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ChevronRight, Clock, Volume2, VolumeX } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { Badge } from "@/components/ui/Badge";
import { useLive } from "@/lib/hooks/useLiveUpdates";
import { Button } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { Table, type Column } from "@/components/ui/Table";
import { staff, type QueueTab } from "@/lib/api/endpoints";
import type { StaffQueueRow } from "@/lib/api/types";
import { ACTIVE_POLL_MS } from "@/lib/config";
import { formatCountdown, formatKm, formatTime } from "@/lib/format";
import { useNow } from "@/lib/hooks/useCountdown";
import { PRIORITY_META } from "@/lib/priority";
import { playAlert } from "./alertSound";
import { CaseDrawer } from "./CaseDrawer";
import { patientLabel } from "./patientLabel";
import { HandoverNotes } from "./Notes";
import { ResourcePanel, useDiversion } from "./ResourcePanel";
import { StaffLayout } from "./StaffLayout";

const TABS: QueueTab[] = ["pending", "accepted", "declined"];
const SOUND_KEY = "js_alert_sound";

export function IncomingPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<QueueTab>("pending");
  const params = useParams();
  const navigate = useNavigate();
  const live = useLive();
  // Opening /staff/cases/:id (for example by scanning the pre-arrival QR code) opens that case.
  const [selected, setSelected] = useState<number | null>(params.assignmentId ? Number(params.assignmentId) : null);
  const [soundOn, setSoundOn] = useState(() => window.localStorage.getItem(SOUND_KEY) !== "off");
  const [acknowledged, setAcknowledged] = useState<Set<number>>(() => new Set());
  const seenRed = useRef<Set<number> | null>(null);
  const diversion = useDiversion();
  const now = useNow();

  const pending = useQuery({ queryKey: ["staff-queue", "pending"], queryFn: () => staff.queue("pending"), refetchInterval: ACTIVE_POLL_MS });
  const other = useQuery({ queryKey: ["staff-queue", tab], queryFn: () => staff.queue(tab), enabled: tab !== "pending", refetchInterval: 15_000 });
  const query = tab === "pending" ? pending : other;

  const redRows = useMemo(() => (pending.data ?? []).filter((r) => r.priority === "RED_FLAG"), [pending.data]);
  useEffect(() => {
    const ids = new Set(redRows.map((r) => r.assignment_id));
    const previous = seenRed.current;
    if (previous && soundOn && [...ids].some((id) => !previous.has(id))) playAlert();
    seenRed.current = ids;
  }, [redRows, soundOn]);
  const alertRow = redRows.find((r) => !acknowledged.has(r.assignment_id));

  function open(row: StaffQueueRow) {
    setAcknowledged((current) => new Set(current).add(row.assignment_id));
    setSelected(row.assignment_id);
  }

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    window.localStorage.setItem(SOUND_KEY, next ? "on" : "off");
  }

  const elapsed = (now - query.dataUpdatedAt) / 1000;
  const columns: Column<StaffQueueRow>[] = [
    {
      key: "priority",
      header: t("staff.colPriority"),
      cell: (r) => (
        <span className="flex flex-wrap items-center gap-1">
          <PriorityBadge priority={r.priority} />
          {r.sensitive && <Badge tone="info">{t("staff.sensitive")}</Badge>}
        </span>
      ),
    },
    {
      key: "request",
      header: t("staff.colRequest"),
      cell: (r) => (
        <button type="button" onClick={() => open(r)} className="tabular font-semibold text-primary-700 underline underline-offset-2">
          {r.request_code}
        </button>
      ),
    },
    { key: "injury", header: t("staff.colInjury"), cell: (r) => t(`injury.${r.injury_type}`) },
    { key: "patient", header: t("staff.colPatient"), cell: (r) => patientLabel(t, r.patient_sex, r.patient_age) },
    { key: "distance", header: t("staff.colDistance"), align: "right", cell: (r) => t("common.km", { value: formatKm(r.distance_km) }) },
    {
      key: "waiting",
      header: t("staff.colWaiting"),
      align: "right",
      cell: (r) => (r.status === "PENDING" ? formatCountdown((now - new Date(r.received_at).getTime()) / 1000) : formatTime(r.received_at)),
    },
    {
      key: "due",
      header: t("staff.colReplyDue"),
      cell: (r) => {
        if (r.arrived_at) return t("staff.arrivedAt", { time: formatTime(r.arrived_at) });
        if (r.status !== "PENDING") return t(`staff.assignmentStatus.${r.status}`);
        const left = Math.max(0, Math.round(r.seconds_left - elapsed));
        if (left === 0) return <span className="text-slate-600">{t("staff.movedOn")}</span>;
        return (
          <span className={cx("tabular inline-flex items-center gap-1", left <= 30 ? "font-bold text-warning-800" : "text-slate-900")}>
            <Clock className="h-3.5 w-3.5" aria-hidden />
            {formatCountdown(left)}
          </span>
        );
      },
    },
    {
      key: "open",
      header: <span className="sr-only">{t("staff.openRequest")}</span>,
      align: "right",
      cell: (r) => (
        <button
          type="button"
          onClick={() => open(r)}
          aria-label={t("staff.openRow", { code: r.request_code })}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      ),
    },
  ];

  const empty = {
    pending: [t("staff.emptyPending"), t("staff.emptyPendingBody")],
    accepted: [t("staff.emptyAccepted"), t("staff.emptyAcceptedBody")],
    declined: [t("staff.emptyDeclined"), t("staff.emptyDeclinedBody")],
  }[tab];

  return (
    <StaffLayout pendingCount={pending.data?.length}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-xl font-bold">{t("staff.title")}</h1>
        <div className="flex items-center gap-3 text-sm text-slate-600">
          {live && (
            <span className="inline-flex items-center gap-1.5 font-semibold text-success-800">
              <span aria-hidden className="h-2 w-2 rounded-full bg-success-700" />
              {t("staff.live")}
            </span>
          )}
          {pending.dataUpdatedAt > 0 && <span className="tabular">{t("staff.updated", { time: formatTime(new Date(pending.dataUpdatedAt).toISOString(), true) })}</span>}
          <Button variant="secondary" size="sm" icon={soundOn ? Volume2 : VolumeX} aria-pressed={soundOn} onClick={toggleSound}>
            {soundOn ? t("staff.soundOn") : t("staff.soundOff")}
          </Button>
        </div>
      </div>

      {alertRow && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-danger-300 bg-danger-50 px-4 py-3 text-danger-900">
          <AlertTriangle className="h-5 w-5 text-danger-700" aria-hidden />
          <span className="min-w-[280px] flex-1 text-sm font-medium">
            {t("staff.newRedFlag", { code: alertRow.request_code, injury: t(`injury.${alertRow.injury_type}`), km: formatKm(alertRow.distance_km) })}
          </span>
          <Button variant="danger" size="sm" onClick={() => open(alertRow)}>
            {t("staff.openRequest")}
          </Button>
        </div>
      )}

      {diversion && (
        <p role="status" className="rounded-lg border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-900">
          {t("staff.diversionBanner")}
        </p>
      )}

      <ResourcePanel />

      <div id="queue" role="tablist" aria-label={t("staff.title")} className="flex gap-1 border-b border-slate-200">
        {TABS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cx(
              "-mb-px h-10 border-b-2 px-4 text-sm font-semibold",
              tab === key ? "border-primary-700 text-primary-700" : "border-transparent text-slate-600 hover:text-slate-900",
            )}
          >
            {t(`staff.tab${key[0]!.toUpperCase()}${key.slice(1)}`)}
            {key === "pending" && pending.data ? ` (${pending.data.length})` : ""}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {query.isPending && <TableSkeleton rows={4} columns={7} />}
        {query.isError && <ErrorState error={query.error} onRetry={() => void query.refetch()} />}
        {query.data && query.data.length === 0 && <EmptyState title={empty[0]!} body={empty[1]} />}
        {query.data && query.data.length > 0 && (
          <Table
            caption={t("staff.title")}
            columns={columns}
            rows={[...query.data].sort((a, b) => PRIORITY_META[a.priority].order - PRIORITY_META[b.priority].order)}
            rowKey={(r) => r.assignment_id}
            rowClassName={(r) => (r.priority === "RED_FLAG" && r.status === "PENDING" ? "bg-danger-50/40" : undefined)}
          />
        )}
      </div>

      <HandoverNotes />

      <CaseDrawer
        assignmentId={selected}
        onClose={() => {
          setSelected(null);
          if (params.assignmentId) navigate("/staff", { replace: true });
        }}
      />
    </StaffLayout>
  );
}
