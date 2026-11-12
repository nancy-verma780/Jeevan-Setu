import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { InlineError, useErrorMessage } from "@/components/ui/States";
import type { Column } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { admin, query as qs } from "@/lib/api/endpoints";
import type { StaffAccount } from "@/lib/api/types";
import { FILTER_CONTROL, FilterField, TableShell } from "./TableShell";

export function StaffTab() {
  const { t } = useTranslation();
  const client = useQueryClient();
  const toast = useToast();
  const [hospitalId, setHospitalId] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const hospitals = useQuery({ queryKey: ["admin-hospitals"], queryFn: admin.hospitals });
  const q = qs({ hospital_id: hospitalId });
  const query = useQuery({ queryKey: ["admin-staff", q], queryFn: () => admin.staff(q) });
  const toggle = useMutation({
    mutationFn: (s: StaffAccount) => admin.updateStaff(s.id, { is_active: !s.is_active }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["admin-staff"] }),
    onError: () => toast(t("errors.generic"), "error"),
  });

  const columns: Column<StaffAccount>[] = [
    { key: "name", header: t("admin.colName"), cell: (s) => <span className="font-semibold">{s.name}</span> },
    { key: "email", header: t("admin.colEmail"), cell: (s) => s.email },
    { key: "hospital", header: t("admin.colHospital"), cell: (s) => s.hospital_name ?? "—" },
    { key: "active", header: t("admin.colActive"), cell: (s) => <Badge tone={s.is_active ? "success" : "neutral"}>{s.is_active ? t("common.yes") : t("common.no")}</Badge> },
    {
      key: "action",
      header: <span className="sr-only">{t("admin.colActive")}</span>,
      align: "right",
      cell: (s) => (
        <Button variant="secondary" size="sm" onClick={() => toggle.mutate(s)}>
          {s.is_active ? t("admin.deactivate") : t("admin.activate")}
        </Button>
      ),
    },
  ];

  return (
    <>
      <TableShell
        caption={t("admin.tabStaff")}
        query={query}
        columns={columns}
        rowKey={(s) => s.id}
        csvHref={admin.csvUrl("staff", q)}
        actions={
          <Button size="sm" icon={UserPlus} onClick={() => setAddOpen(true)}>
            {t("admin.addStaff")}
          </Button>
        }
        filters={
          <FilterField label={t("admin.colHospital")}>
            {(id) => (
              <select id={id} className={FILTER_CONTROL} value={hospitalId} onChange={(e) => setHospitalId(e.target.value)}>
                <option value="">{t("admin.any")}</option>
                {(hospitals.data ?? []).map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            )}
          </FilterField>
        }
      />
      <AddStaffModal open={addOpen} onClose={() => setAddOpen(false)} hospitals={(hospitals.data ?? []).map((h) => ({ id: h.id, name: h.name }))} />
    </>
  );
}

function AddStaffModal({ open, onClose, hospitals }: { open: boolean; onClose: () => void; hospitals: Array<{ id: number; name: string }> }) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [form, setForm] = useState({ name: "", email: "", password: "", hospital_id: "" });
  const create = useMutation({
    mutationFn: () => admin.createStaff({ ...form, hospital_id: Number(form.hospital_id) }),
    onSuccess: (account) => {
      toast(t("admin.created", { name: account.name }));
      void client.invalidateQueries({ queryKey: ["admin-staff"] });
      setForm({ name: "", email: "", password: "", hospital_id: "" });
      onClose();
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    create.mutate();
  }

  return (
    <Modal open={open} title={t("admin.addStaff")} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Field label={t("admin.staffName")}>{({ id }) => <Input id={id} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required data-autofocus />}</Field>
        <Field label={t("admin.staffEmail")}>{({ id }) => <Input id={id} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />}</Field>
        <Field label={t("admin.staffPassword")} hint={t("admin.staffPasswordHint")}>
          {({ id, describedBy }) => (
            <Input id={id} type="password" autoComplete="new-password" minLength={10} aria-describedby={describedBy} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          )}
        </Field>
        <Field label={t("admin.staffHospital")}>
          {({ id }) => (
            <Select id={id} value={form.hospital_id} onChange={(e) => setForm({ ...form, hospital_id: e.target.value })} required>
              <option value="">—</option>
              {hospitals.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {create.error && <InlineError>{errorMessage(create.error)}</InlineError>}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" loading={create.isPending}>
            {t("admin.create")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
