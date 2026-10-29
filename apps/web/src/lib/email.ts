import "server-only";
import { createTranslator } from "next-intl";
import messages from "../../i18n/strings_en.json";

type EmailEnv = CloudflareEnv & { RESEND_API_KEY?: string; EMAIL_FROM?: string };

export async function sendPasswordResetEmail(env: EmailEnv, to: string, url: string) {
  const t = createTranslator({ locale: "en", messages, namespace: "email" });
  const subject = t("resetSubject");
  const text = t("resetBody", { url });

  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    // No email provider yet. Never log links in production: they contain tokens.
    if (env.APP_ENV === "production") {
      console.warn(`[email] not configured, password reset email to ${to} was not sent`);
    } else {
      console.log(`[email] password reset for ${to}: ${url}`);
    }
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.EMAIL_FROM, to, subject, text }),
  });
  if (!res.ok) {
    console.error(`[email] Resend error ${res.status} for password reset email`);
  }
}
