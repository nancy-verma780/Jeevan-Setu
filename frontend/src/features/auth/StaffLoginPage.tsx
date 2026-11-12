import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { LanguageToggle } from "@/components/LanguageToggle";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Input";
import { InlineError, useErrorMessage } from "@/components/ui/States";
import { auth } from "@/lib/api/endpoints";
import { homeFor } from "./RequireRole";
import { ME_KEY, useMe } from "./useMe";

export function StaffLoginPage() {
  const { t } = useTranslation();
  const me = useMe();
  const client = useQueryClient();
  const navigate = useNavigate();
  const errorMessage = useErrorMessage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const login = useMutation({
    mutationFn: () => auth.login(email.trim(), password),
    onSuccess: (user) => {
      client.setQueryData(ME_KEY, user);
      navigate(homeFor(user.role), { replace: true });
    },
  });

  if (me.data) return <Navigate to={homeFor(me.data.role)} replace />;

  function submit(event: FormEvent) {
    event.preventDefault();
    login.mutate();
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 bg-slate-50 p-4">
      <div className="flex w-full max-w-sm items-center justify-between">
        <Logo />
        <LanguageToggle />
      </div>
      <Card className="w-full max-w-sm p-6">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-bold">{t("staffLogin.title")}</h1>
            <p className="text-sm text-slate-700">{t("staffLogin.sub")}</p>
          </div>
          <Field label={t("staffLogin.email")}>
            {({ id }) => <Input id={id} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />}
          </Field>
          <Field label={t("staffLogin.password")}>
            {({ id }) => (
              <Input id={id} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            )}
          </Field>
          {login.error && <InlineError>{errorMessage(login.error)}</InlineError>}
          <Button type="submit" loading={login.isPending}>
            {t("staffLogin.submit")}
          </Button>
        </form>
      </Card>
      <div className="flex flex-col items-center gap-2">
        <Link to="/demo" className="text-sm font-semibold text-primary-700">
          {t("demo.demoLink")}
        </Link>
        <Link to="/login" className="text-sm font-medium text-primary-700">
          {t("staffLogin.citizenLink")}
        </Link>
      </div>
    </div>
  );
}
