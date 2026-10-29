import { redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { PageShell } from "@/components/page-shell";
import { getSession } from "@/lib/session";

export default async function AccountPage() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  const [t, format] = await Promise.all([getTranslations("account"), getFormatter()]);
  const { user } = session;

  return (
    <PageShell>
      <div className="mx-auto max-w-md">
        <h1 className="mb-6 font-display text-3xl font-bold">{t("title")}</h1>
        <div className="card grid gap-4">
          <div>
            <p className="label">{t("name")}</p>
            <p className="font-display text-xl font-semibold">{user.name}</p>
          </div>
          <div>
            <p className="label">{t("email")}</p>
            <p>{user.email}</p>
            <p className={user.emailVerified ? "text-sm text-positive" : "text-sm text-warning"}>
              {user.emailVerified ? t("emailVerified") : t("emailNotVerified")}
            </p>
          </div>
          <div>
            <p className="label">{t("memberSince")}</p>
            <p>{format.dateTime(new Date(user.createdAt), { dateStyle: "medium" })}</p>
          </div>
          <div className="pt-2">
            <SignOutButton />
          </div>
        </div>
      </div>
    </PageShell>
  );
}
