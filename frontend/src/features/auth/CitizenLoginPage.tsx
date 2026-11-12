import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Call112Button } from "@/components/Call112Button";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { InlineError, useErrorMessage } from "@/components/ui/States";
import { auth } from "@/lib/api/endpoints";
import { CitizenLayout } from "@/features/citizen/CitizenLayout";
import { homeFor } from "./RequireRole";
import { ME_KEY, useMe } from "./useMe";

export function CitizenLoginPage() {
  const { t } = useTranslation();
  const me = useMe();
  const client = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const errorMessage = useErrorMessage();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [step, setStep] = useState<"phone" | "code">("phone");

  const send = useMutation({
    mutationFn: () => auth.requestOtp(phone),
    onSuccess: (data) => {
      setDevCode(data.dev_code);
      setStep("code");
    },
  });
  const verify = useMutation({
    mutationFn: () => auth.verifyOtp(phone, code),
    onSuccess: (user) => {
      client.setQueryData(ME_KEY, user);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from ?? "/", { replace: true });
    },
  });

  if (me.data) return <Navigate to={homeFor(me.data.role)} replace />;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (step === "phone") send.mutate();
    else verify.mutate();
  }

  const error = step === "phone" ? send.error : verify.error;
  return (
    <CitizenLayout>
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-bold">{t("login.title")}</h1>
        <p className="text-slate-700">{t("login.sub")}</p>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {step === "phone" ? (
          <Field label={t("login.phone")} hint={t("login.phoneHint")}>
            {({ id, describedBy }) => (
              <div className="flex">
                <span className="flex items-center rounded-l-md border border-r-0 border-slate-400 bg-slate-100 px-3 text-slate-700">+91</span>
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  inputMode="numeric"
                  autoComplete="tel-national"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="rounded-l-none"
                  required
                />
              </div>
            )}
          </Field>
        ) : (
          <>
            <p className="text-sm text-slate-700">{t("login.codeSent", { phone: `+91 ${phone}` })}</p>
            {devCode && <p className="rounded-md border border-info-200 bg-info-50 p-3 text-sm text-info-900">{t("login.devCode", { code: devCode })}</p>}
            <Field label={t("login.code")}>
              {({ id }) => (
                <Input
                  id={id}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  className="tabular tracking-[0.3em]"
                  data-autofocus
                  required
                />
              )}
            </Field>
          </>
        )}
        {error && <InlineError>{errorMessage(error)}</InlineError>}
        <Button type="submit" size="lg" loading={send.isPending || verify.isPending}>
          {step === "phone" ? t("login.sendCode") : t("login.verify")}
        </Button>
        {step === "code" && (
          <Button variant="ghost" onClick={() => setStep("phone")}>
            {t("login.changeNumber")}
          </Button>
        )}
      </form>
      <Link to="/demo" className="text-sm font-semibold text-primary-700">
        {t("demo.demoLink")}
      </Link>
      <div className="mt-auto flex flex-col gap-3 rounded-lg border border-danger-200 bg-danger-50 p-4">
        <p className="text-sm text-danger-900">{t("login.emergencyNote")}</p>
        <Call112Button variant="solid" />
      </div>
    </CitizenLayout>
  );
}
