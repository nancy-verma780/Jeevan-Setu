import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, RotateCw } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { Call112Button } from "@/components/Call112Button";
import { MapView, type MapPoint } from "@/components/MapView";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState, InlineError, useErrorMessage } from "@/components/ui/States";
import { Timeline } from "@/components/ui/Timeline";
import { ApiError } from "@/lib/api/client";
import { emergencies, hospitals } from "@/lib/api/endpoints";
import type { EmergencyDetail } from "@/lib/api/types";
import { ACTIVE_POLL_MS } from "@/lib/config";
import { BackHeader } from "../BackHeader";
import { CitizenLayout } from "../CitizenLayout";
import { AccessLog } from "./AccessLog";
import { FeedbackForm } from "./FeedbackForm";
import { AcceptedCard, WaitingCard } from "./HospitalCard";
import { ShareButton } from "./ShareDialog";
import { PhotoUpload } from "./PhotoUpload";
import { reassignment, timelineItems } from "./events";

const ACTIVE = new Set(["SUBMITTED", "FINDING_HOSPITAL", "AWAITING_HOSPITAL_RESPONSE"]);

export function StatusPage() {
  const { t } = useTranslation();
  const id = Number(useParams().id);
  const client = useQueryClient();
  const errorMessage = useErrorMessage();
  const [mapOpen, setMapOpen] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const query = useQuery({
    queryKey: ["emergency", id],
    queryFn: () => emergencies.get(id),
    refetchInterval: (q) => (q.state.data && ACTIVE.has(q.state.data.status) ? ACTIVE_POLL_MS : false),
    enabled: Number.isFinite(id),
  });
  const pins = useQuery({ queryKey: ["hospital-pins"], queryFn: hospitals.pins, staleTime: 300_000 });
  const cancel = useMutation({
    mutationFn: () => emergencies.cancel(id),
    onSuccess: (detail) => {
      client.setQueryData(["emergency", id], detail);
      void client.invalidateQueries({ queryKey: ["emergencies"] });
      setConfirmOpen(false);
    },
  });

  const header = <BackHeader to="/" title={t("status.title")} subtitle={query.data?.public_code} />;

  if (query.isPending) {
    return (
      <CitizenLayout header={header}>
        <div role="status" aria-busy="true" className="flex flex-col gap-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-48" />
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      </CitizenLayout>
    );
  }
  if (query.isError) {
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    return (
      <CitizenLayout header={header}>
        {notFound ? <InlineError>{t("status.notFound")}</InlineError> : <ErrorState error={query.error} onRetry={() => void query.refetch()} />}
        <Call112Button variant="solid" />
      </CitizenLayout>
    );
  }

  const detail: EmergencyDetail = query.data;
  const current = detail.current_hospital;
  const active = ACTIVE.has(detail.status);
  const moved = reassignment(detail);
  const currentPin = current ? pins.data?.find((p) => p.id === current.hospital_id) : undefined;
  const points: MapPoint[] = [
    { id: "patient", lat: detail.lat, lng: detail.lng, label: t("status.you"), kind: "patient" },
    ...(pins.data ?? []).map((p) => ({
      id: p.id,
      lat: p.lat,
      lng: p.lng,
      label: p.name,
      kind: p.id === current?.hospital_id ? ("hospital-active" as const) : ("hospital-muted" as const),
    })),
  ];

  const footer = active ? (
    <div className="grid grid-cols-2 gap-2">
      <Button variant="secondary" onClick={() => setConfirmOpen(true)}>
        {t("status.cancel")}
      </Button>
      <Call112Button variant="solid" />
    </div>
  ) : undefined;

  return (
    <CitizenLayout header={header} footer={footer}>
      <section className="-mx-4 -mt-6 border-b border-slate-200 bg-white">
        {mapOpen && (
          <div id="status-map" className="relative z-0">
            <MapView
              points={points}
              route={currentPin ? [[detail.lat, detail.lng], [currentPin.lat, currentPin.lng]] : undefined}
              center={[detail.lat, detail.lng]}
              height={184}
              label={t("status.mapSimulated")}
            />
            <span className="absolute bottom-2 left-2 z-[400] rounded border border-slate-200 bg-white px-1.5 text-xs text-slate-700">{t("status.mapSimulated")}</span>
          </div>
        )}
        <button
          type="button"
          aria-expanded={mapOpen}
          aria-controls="status-map"
          onClick={() => setMapOpen(!mapOpen)}
          className="flex min-h-[40px] w-full items-center justify-center gap-1 text-sm font-medium text-slate-700"
        >
          {mapOpen ? t("status.hideMap") : t("status.showMap")}
          {mapOpen ? <ChevronUp className="h-4 w-4" aria-hidden /> : <ChevronDown className="h-4 w-4" aria-hidden />}
        </button>
      </section>

      {detail.priority === "RED_FLAG" && active && (
        <div role="alert" className="flex flex-col gap-3 rounded-lg border border-danger-200 bg-danger-50 p-4">
          <p className="flex items-start gap-2 text-sm font-semibold text-danger-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {t("status.redBanner")}
          </p>
        </div>
      )}

      <div className="sticky top-16 z-10 -mx-4 flex flex-col gap-2 bg-slate-50 px-4 py-2">
        {moved && (
          <p role="status" className="flex items-start gap-2 rounded-lg border border-warning-200 bg-warning-50 p-3 text-sm text-warning-900">
            <RotateCw className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {t("status.reassigned", moved)}
          </p>
        )}
        {current && current.status === "PENDING" && <WaitingCard hospital={current} injuryType={detail.injury_type} />}
        {detail.status === "PATIENT_ARRIVED" && current && (
          <section role="status" className="flex flex-col gap-1 rounded-lg border border-success-300 bg-white p-4">
            <p className="flex items-center gap-2 font-bold text-success-800">
              <CheckCircle2 className="h-5 w-5" aria-hidden />
              {t("status.arrivedTitle")}
            </p>
            <p className="text-sm text-slate-700">{t("status.arrivedBody", { name: current.name })}</p>
          </section>
        )}
        {current && current.status === "ACCEPTED" && detail.status === "HOSPITAL_ACCEPTED" && (
          <AcceptedCard hospital={current} code={detail.public_code} from={[detail.lat, detail.lng]} to={currentPin ? [currentPin.lat, currentPin.lng] : null} />
        )}
        {!current && detail.status === "FINDING_HOSPITAL" && (
          <p role="status" className="rounded-lg border border-slate-200 bg-white p-4 font-semibold">
            {t("status.finding")}
          </p>
        )}
        {detail.status === "NO_SUITABLE_HOSPITAL" && (
          <section role="alert" className="flex flex-col gap-3 rounded-lg border border-danger-200 bg-white p-4">
            <p className="flex items-center gap-2 font-bold text-danger-800">
              <AlertTriangle className="h-5 w-5" aria-hidden />
              {t("status.noneTitle")}
            </p>
            <p>{t("status.noneBody")}</p>
            <Call112Button variant="solid" className="min-h-[56px] text-lg" />
          </section>
        )}
        {detail.status === "CANCELLED" && (
          <section role="status" className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-white p-4">
            <p className="font-bold">{t("status.cancelledTitle")}</p>
            <p className="text-sm text-slate-700">{t("status.cancelledBody")}</p>
          </section>
        )}
      </div>

      <section aria-labelledby="timeline-h" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 id="timeline-h" className="text-sm font-semibold text-slate-700">
            {t("status.timeline")}
          </h2>
          <PriorityBadge priority={detail.priority} preliminary />
        </div>
        <Timeline items={timelineItems(detail.events, t)} />
      </section>

      {(active || detail.status === "HOSPITAL_ACCEPTED") && <ShareButton requestId={detail.id} code={detail.public_code} />}
      {(detail.status === "HOSPITAL_ACCEPTED" || detail.status === "PATIENT_ARRIVED") && <FeedbackForm requestId={detail.id} existing={detail.feedback} />}
      {(active || detail.status === "HOSPITAL_ACCEPTED") && <PhotoUpload requestId={detail.id} />}
      <AccessLog requestId={detail.id} />

      <Modal
        open={confirmOpen}
        title={t("status.cxTitle")}
        onClose={() => setConfirmOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)} data-autofocus>
              {t("status.cxKeep")}
            </Button>
            <Button variant="dark" loading={cancel.isPending} onClick={() => cancel.mutate()}>
              {t("status.cxConfirm")}
            </Button>
          </>
        }
      >
        <p>{t("status.cxBody")}</p>
        {cancel.isError && (
          <div className="mt-3">
            <InlineError>{cancel.error instanceof ApiError && cancel.error.status === 409 ? t("status.cancelFailed") : errorMessage(cancel.error)}</InlineError>
          </div>
        )}
      </Modal>
    </CitizenLayout>
  );
}
