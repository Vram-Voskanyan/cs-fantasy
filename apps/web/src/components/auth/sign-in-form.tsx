"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";
import { authErrorKey } from "./auth-errors";

export function SignInForm() {
  const t = useTranslations();
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    if (!email || !password) {
      setError(t("errors.invalidCredentials"));
      return;
    }

    setLoading(true);
    const result = await authClient.signIn.email({ email, password });
    setLoading(false);
    if (result.error) {
      setError(t(`errors.${authErrorKey(result.error)}`));
      return;
    }
    router.push("/account");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      <Field id="email" name="email" type="email" label={t("auth.emailLabel")} autoComplete="email" required />
      <Field id="password" name="password" type="password" label={t("auth.passwordLabel")} autoComplete="current-password" required />
      {error ? (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      ) : null}
      <Button type="submit" variant="primary" size="lg" loading={loading} disabled={loading}>
        {t("auth.submitSignIn")}
      </Button>
      <p className="text-sm text-fg-muted">
        {t("auth.noAccount")}{" "}
        <Link href="/sign-up" className="text-primary underline-offset-4 hover:underline">
          {t("nav.signUp")}
        </Link>
      </p>
    </form>
  );
}
