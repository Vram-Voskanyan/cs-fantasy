"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";
import { NAME_MAX, NAME_MIN, PASSWORD_MAX, PASSWORD_MIN } from "@/lib/auth-rules";
import { authErrorKey } from "./auth-errors";

type Errors = { name?: string; email?: string; password?: string; form?: string };

export function SignUpForm() {
  const t = useTranslations();
  const router = useRouter();
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");

    const next: Errors = {};
    if (name.length < NAME_MIN || name.length > NAME_MAX) next.name = t("errors.nameLength");
    if (!/^\S+@\S+\.\S+$/.test(email)) next.email = t("errors.emailInvalid");
    if (password.length < PASSWORD_MIN) next.password = t("errors.passwordTooShort", { min: PASSWORD_MIN });
    if (password.length > PASSWORD_MAX) next.password = t("errors.passwordTooLong", { max: PASSWORD_MAX });
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    const { error } = await authClient.signUp.email({ name, email, password });
    setLoading(false);
    if (error) {
      const key = authErrorKey(error);
      setErrors(key === "userExists" || key === "emailInvalid" ? { email: t(`errors.${key}`) } : { form: t(`errors.${key}`) });
      return;
    }
    router.push("/account");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      <Field id="name" name="name" label={t("auth.nameLabel")} hint={t("auth.nameHint")} error={errors.name} autoComplete="nickname" required />
      <Field id="email" name="email" type="email" label={t("auth.emailLabel")} error={errors.email} autoComplete="email" required />
      <Field
        id="password"
        name="password"
        type="password"
        label={t("auth.passwordLabel")}
        hint={t("auth.passwordHint", { min: PASSWORD_MIN })}
        error={errors.password}
        autoComplete="new-password"
        required
      />
      {errors.form ? (
        <p role="alert" className="text-sm text-negative">
          {errors.form}
        </p>
      ) : null}
      <Button type="submit" variant="primary" size="lg" loading={loading} disabled={loading}>
        {t("auth.submitSignUp")}
      </Button>
      <p className="text-sm text-fg-muted">
        {t("auth.haveAccount")}{" "}
        <Link href="/sign-in" className="text-primary underline-offset-4 hover:underline">
          {t("nav.signIn")}
        </Link>
      </p>
    </form>
  );
}
