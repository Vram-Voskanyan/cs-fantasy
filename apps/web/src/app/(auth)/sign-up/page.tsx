import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { PageShell } from "@/components/page-shell";
import { getSession } from "@/lib/session";

export default async function SignUpPage() {
  if (await getSession()) redirect("/account");
  const t = await getTranslations("auth");
  return (
    <PageShell>
      <div className="mx-auto max-w-md">
        <h1 className="mb-6 font-display text-3xl font-bold">{t("signUpTitle")}</h1>
        <div className="card">
          <SignUpForm />
        </div>
      </div>
    </PageShell>
  );
}
