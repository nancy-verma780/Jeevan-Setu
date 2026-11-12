import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Field, Select } from "@/components/ui/Input";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/lib/api/client";
import { staff } from "@/lib/api/endpoints";
import type { DeclineReason, ImageInfo, StaffCaseDetail } from "@/lib/api/types";
import { formatKm, formatTime } from "@/lib/format";
import { PRIORITY_META } from "@/lib/priority";
import { CaseComments } from "./Notes";
import { PatientMap } from "./PatientMap";
import { patientLabel } from "./patientLabel";

const REASONS: DeclineReason[] = ["no_bed", "specialist_unavailable", "equipment_unavailable", "other"];

export function CaseDrawer({ assignmentId, onClose }: { assignmentId: number | null; onClose: () => void }) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const toast = useToast();
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState<DeclineReason | "">("");
  const open = assignmentId !== null;

  useEffect(() => {
    setDeclining(false);
    setReason("");
  }, [assignmentId]);

  const detail = useQuery({ queryKey: ["staff-case", assignmentId], queryFn: () => staff.detail(assignmentId!), enabled: open });
  const images = useQuery({ queryKey: ["staff-case-images", assignmentId], queryFn: () => staff.images(assignmentId!), enabled: open });

  const decide = useMutation({
    mutationFn: (action: "accept" | "decline") => staff.decide(assignmentId!, action, action === "decline" ? (reason as DeclineReason) : undefined),
    onSuccess: (result, action) => {
      toast(t(action === "accept" ? "staff.acceptedToast" : "staff.declinedToast", { code: result.request_code }));
      void client.invalidateQueries({ queryKey: ["staff-queue"] });
      void client.invalidateQueries({ queryKey: ["staff-hospital"] });
      onClose();
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        toast(t("staff.conflict"), "error");
        void client.invalidateQueries({ queryKey: ["staff-queue"] });
        onClose();
      } else {
        toast(t("errors.generic"), "error");
      }
    },
  });

  const pending = detail.data?.status === "PENDING";
  const canMarkArrived = detail.data?.status === "ACCEPTED" && !detail.data.arrived_at;
  const arrive = useMutation({
    mutationFn: () => staff.arrived(assignmentId!),
    onSuccess: (result) => {
      toast(t("staff.arrivedToast", { code: result.request_code }));
      void client.invalidateQueries({ queryKey: ["staff-queue"] });
      void client.invalidateQueries({ queryKey: ["staff-case", assignmentId] });
    },
    onError: () => toast(t("errors.generic"), "error"),
  });

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    const tag = (event.target as HTMLElement).tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || !pending || decide.isPending) return;
    const key = event.key.toLowerCase();
    if (key === "a" && !declining) {
      event.preventDefault();
      decide.mutate("accept");
    } else if (key === "d" && !declining) {
      event.preventDefault();
      setDeclining(true);
    }
  }

  const data = detail.data;
  const footer = pending ? (
    <div className="flex flex-col gap-3">
      {declining && (
        <Field label={t("staff.declineReason")} hint={t("staff.declineNote")}>
          {({ id, describedBy }) => (
            <Select id={id} aria-describedby={describedBy} value={reason} onChange={(e) => setReason(e.target.value as DeclineReason)} data-autofocus>
              <option value="">{t("staff.chooseReason")}</option>
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  {t(`declineReason.${r}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
      )}
      <div className="flex gap-2">
        {declining ? (
          <>
            <Button variant="secondary" className="flex-1" onClick={() => setDeclining(false)}>
              {t("common.back")}
            </Button>
            <Button variant="dark" className="flex-1" disabled={!reason} loading={decide.isPending} onClick={() => decide.mutate("decline")}>
              {t("staff.declineConfirm")}
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" className="flex-1" onClick={() => setDeclining(true)} aria-keyshortcuts="D">
              {t("staff.decline")} <kbd className="rounded border border-slate-300 px-1 text-xs font-normal text-slate-600">D</kbd>
            </Button>
            <Button className="flex-1" loading={decide.isPending} onClick={() => decide.mutate("accept")} aria-keyshortcuts="A">
              {t("staff.accept")} <kbd className="rounded border border-primary-300 px-1 text-xs font-normal text-primary-100">A</kbd>
            </Button>
          </>
        )}
      </div>
      <p className="text-xs text-slate-600">{t("staff.shortcutHint")}</p>
    </div>
  ) : canMarkArrived ? (
    <Button className="w-full" loading={arrive.isPending} onClick={() => arrive.mutate()}>
      {t("staff.markArrived")}
    </Button>
  ) : data ? (
    <Badge>{data.arrived_at ? t("staff.arrivedAt", { time: formatTime(data.arrived_at) }) : t("staff.decided", { status: t(`staff.assignmentStatus.${data.status}`) })}</Badge>
  ) : undefined;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      onKeyDown={onKeyDown}
      title={data?.request_code ?? "…"}
      subtitle={
        data && (
          <span className="flex flex-wrap items-center gap-2">
            {t("staff.received", { time: formatTime(data.received_at), km: formatKm(data.distance_km) })}
            {data.sensitive && <Badge tone="info">{t("staff.sensitive")}</Badge>}
          </span>
        )
      }
      footer={footer}
    >
      {detail.isPending && (
        <div role="status" aria-busy="true" className="flex flex-col gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-40" />
          <Skeleton className="h-48" />
        </div>
      )}
      {detail.isError && <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />}
      {data && <CaseBody data={data} images={images.data ?? []} imagesLoading={images.isPending} />}
    </Drawer>
  );
}

function CaseBody({ data, images, imagesLoading }: { data: StaffCaseDetail; images: ImageInfo[]; imagesLoading: boolean }) {
  const { t } = useTranslation();
  const p = data.packet;
  const notGiven = t("common.notGiven");
  // Scanning at the gate opens this case for staff of this hospital; anyone else gets "not found".
  const qrValue = `${window.location.origin}/staff/cases/${data.assignment_id}`;

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="case-priority" className="flex flex-col gap-2">
        <h3 id="case-priority" className="text-sm font-semibold text-slate-700">
          {t("staff.priorityTitle", { version: data.rule_set_version })}
        </h3>
        <div className={`flex flex-col items-start gap-2 rounded-md border p-3 ${PRIORITY_META[data.priority].panel}`}>
          <PriorityBadge priority={data.priority} />
          <ul className="list-disc pl-5 text-sm">
            {data.priority_reasons.map((r) => (
              <li key={`${r.rule}-${r.text}`}>{r.text}</li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="case-packet" className="flex flex-col gap-3">
        <h3 id="case-packet" className="text-sm font-semibold text-slate-700">
          {t("staff.packet")}
        </h3>
        <div className="flex flex-wrap items-start gap-4">
          <dl className="grid min-w-[240px] flex-1 grid-cols-[120px_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-slate-600">{t("staff.patient")}</dt>
            <dd className="m-0">{patientLabel(t, p.patient_sex, p.patient_age)}</dd>
            <dt className="text-slate-600">{t("staff.injury")}</dt>
            <dd className="m-0">{t(`injury.${p.injury_type}`)}</dd>
            <dt className="text-slate-600">{t("staff.bloodGroup")}</dt>
            <dd className="m-0">{p.blood_group ?? notGiven}</dd>
            <dt className="text-slate-600">{t("staff.allergies")}</dt>
            <dd className="m-0">{p.allergies ?? notGiven}</dd>
            {p.conditions && (
              <>
                <dt className="text-slate-600">{t("staff.conditions")}</dt>
                <dd className="m-0">{p.conditions}</dd>
              </>
            )}
            {p.emergency_contacts && p.emergency_contacts.length > 0 && (
              <>
                <dt className="text-slate-600">{t("staff.contacts")}</dt>
                <dd className="m-0 flex flex-col">
                  {p.emergency_contacts.map((c) => (
                    <a key={c.phone} href={`tel:${c.phone}`}>
                      {c.name}
                      {c.relation ? ` (${c.relation})` : ""}, {c.phone}
                    </a>
                  ))}
                </dd>
              </>
            )}
            <dt className="text-slate-600">{t("staff.reportedBy")}</dt>
            <dd className="m-0">{p.contact_phone ? <a href={`tel:${p.contact_phone}`}>{p.contact_phone}</a> : notGiven}</dd>
            <dt className="text-slate-600">{t("staff.location")}</dt>
            <dd className="m-0">{t("staff.locationSource", { km: formatKm(data.distance_km), source: t(`staff.source_${p.location_source}`) })}</dd>
          </dl>
          <figure className="m-0 flex flex-col items-center gap-1">
            <QRCodeSVG value={qrValue} size={112} level="M" title={t("staff.qrTitle")} />
            <figcaption className="max-w-[140px] text-center text-xs text-slate-600">{t("staff.qrHint")}</figcaption>
          </figure>
        </div>
        {p.passport_shared && <p className="text-xs text-slate-600">{t("staff.passportShared")}</p>}
        {p.description && (
          <blockquote className="m-0 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
            <span className="sr-only">{t("staff.description")}: </span>“{p.description}”
          </blockquote>
        )}
      </section>

      <PatientMap lat={p.lat} lng={p.lng} code={p.request_code} />

      <CaseComments assignmentId={data.assignment_id} />

      <section aria-labelledby="case-photos" className="flex flex-col gap-3">
        <h3 id="case-photos" className="text-sm font-semibold text-slate-700">
          {t("staff.photos")}
        </h3>
        {imagesLoading && <Skeleton className="h-48" />}
        {!imagesLoading && images.length === 0 && <p className="text-sm text-slate-600">{t("staff.noPhoto")}</p>}
        {images.map((image) => (
          <PhotoWithAnalysis key={image.id} image={image} />
        ))}
      </section>
    </div>
  );
}

function PhotoWithAnalysis({ image }: { image: ImageInfo }) {
  const { t } = useTranslation();
  const [showFocus, setShowFocus] = useState(false);
  const a = image.analysis;
  const confidence = a.confidence !== null ? a.confidence.toFixed(2) : "";
  const result =
    a.prediction === null
      ? t("staff.notAnalysed")
      : a.abstained
        ? t("staff.uncertain", { conf: confidence })
        : t("staff.predicted", { label: t(`wound.${a.prediction}`, { defaultValue: a.prediction }), conf: confidence });

  return (
    <div className="flex flex-col gap-2">
      {a.has_heatmap && (
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={showFocus} onChange={(e) => setShowFocus(e.target.checked)} className="h-4 w-4 accent-primary-700" />
          {t("staff.showFocus")}
        </label>
      )}
      <img
        src={staff.imageUrl(image.id, showFocus ? "heatmap" : "photo")}
        alt={showFocus ? t("staff.heatmapAlt") : t("staff.photoAlt")}
        className="max-h-[320px] w-full rounded-md border border-slate-200 bg-slate-100 object-contain"
        loading="lazy"
      />
      <div className="flex flex-col gap-1 rounded-md border border-slate-300 p-3 text-sm">
        <span className="self-start rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">{t("common.preliminary")}</span>
        <span className="font-semibold">{result}</span>
        {a.prediction !== null && <span className="text-slate-600">{t("staff.mlCaveat")}</span>}
      </div>
    </div>
  );
}
