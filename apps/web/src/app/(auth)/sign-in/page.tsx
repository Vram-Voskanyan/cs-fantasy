import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { SignInForm } from "@/components/auth/sign-in-form";
import { PageShell } from "@/components/page-shell";
import { getSession } from "@/lib/session";

export default async function SignInPage() {
  if (await getSession()) redirect("/account");
  const t = await getTranslations("auth");
  return (
    <PageShell>
      <div className="mx-auto max-w-md">
        <h1 className="mb-6 font-display text-3xl font-bold">{t("signInTitle")}</h1>
        <div className="card">
          <SignInForm />
        </div>
      </div>
    </PageShell>
  );
}
