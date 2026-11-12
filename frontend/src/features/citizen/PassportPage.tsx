import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { InlineError, useErrorMessage } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { passport as passportApi } from "@/lib/api/endpoints";
import type { Passport } from "@/lib/api/types";
import { BackHeader } from "./BackHeader";
import { CitizenLayout } from "./CitizenLayout";

const BLOOD = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const empty: Passport = { blood_group: null, allergies: null, conditions: null, contacts: [] };

/** Emergency Passport: kept on the account, shared only with consent at report time. */
export function PassportPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const client = useQueryClient();
  const errorMessage = useErrorMessage();
  const query = useQuery({ queryKey: ["passport"], queryFn: passportApi.get });
  const [form, setForm] = useState<Passport>(empty);
  useEffect(() => {
    if (query.data) setForm({ ...empty, ...query.data, contacts: query.data.contacts.map((c) => ({ ...c, phone: c.phone.replace(/^\+91/, "") })) });
  }, [query.data]);
  const save = useMutation({
    mutationFn: () => passportApi.save(form),
    onSuccess: (data) => {
      client.setQueryData(["passport"], data);
      toast(t("passport.saved"));
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    save.mutate();
  }
  const setContact = (i: number, patch: Partial<Passport["contacts"][number]>) =>
    setForm({ ...form, contacts: form.contacts.map((c, j) => (j === i ? { ...c, ...patch } : c)) });

  return (
    <CitizenLayout header={<BackHeader to="/" title={t("passport.title")} />}>
      <p className="text-sm text-slate-700">{t("passport.sub")}</p>
      {query.isPending ? (
        <Skeleton className="h-80" />
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label={t("report.bloodGroup")}>
            {({ id }) => (
              <Select id={id} value={form.blood_group ?? ""} onChange={(e) => setForm({ ...form, blood_group: e.target.value || null })}>
                <option value="">{t("common.notGiven")}</option>
                {BLOOD.map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t("report.allergies")} hint={t("report.allergiesHint")}>
            {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} maxLength={200} value={form.allergies ?? ""} onChange={(e) => setForm({ ...form, allergies: e.target.value })} />}
          </Field>
          <Field label={t("passport.conditions")} hint={t("passport.conditionsHint")}>
            {({ id, describedBy }) => <Textarea id={id} aria-describedby={describedBy} maxLength={300} value={form.conditions ?? ""} onChange={(e) => setForm({ ...form, conditions: e.target.value })} />}
          </Field>
          <fieldset className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4">
            <legend className="px-1 text-sm font-semibold">{t("passport.contacts")}</legend>
            <p className="text-xs text-slate-600">{t("passport.contactsHint")}</p>
            {form.contacts.map((c, i) => (
              <div key={i} className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
                <Field label={t("passport.contactName")}>{({ id }) => <Input id={id} maxLength={60} value={c.name} onChange={(e) => setContact(i, { name: e.target.value })} />}</Field>
                <Field label={t("passport.relation")}>{({ id }) => <Input id={id} maxLength={30} value={c.relation} onChange={(e) => setContact(i, { relation: e.target.value })} />}</Field>
                <div className="col-span-2 flex items-end gap-2">
                  <div className="flex-1">
                    <Field label={t("passport.phone")}>{({ id }) => <Input id={id} inputMode="numeric" value={c.phone} onChange={(e) => setContact(i, { phone: e.target.value })} />}</Field>
                  </div>
                  <Button variant="secondary" icon={Trash2} aria-label={t("passport.remove")} onClick={() => setForm({ ...form, contacts: form.contacts.filter((_, j) => j !== i) })} />
                </div>
              </div>
            ))}
            {form.contacts.length < 3 && (
              <Button variant="ghost" icon={Plus} onClick={() => setForm({ ...form, contacts: [...form.contacts, { name: "", relation: "", phone: "" }] })}>
                {t("passport.addContact")}
              </Button>
            )}
          </fieldset>
          {save.isError && <InlineError>{errorMessage(save.error)}</InlineError>}
          <Button type="submit" size="lg" loading={save.isPending}>
            {t("passport.save")}
          </Button>
        </form>
      )}
    </CitizenLayout>
  );
}
