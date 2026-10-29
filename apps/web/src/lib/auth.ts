import "server-only";
import { createDb, schema } from "@cs-vv-fantasy/db";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { PASSWORD_MAX, PASSWORD_MIN } from "./auth-rules";
import { sendAuthEmail } from "./email";

function createAuth(env: CloudflareEnv) {
  return betterAuth({
    appName: "cs-vv-fantasy",
    // Local dev can run on any port (next dev, wrangler preview): infer the URL from the request there.
    baseURL: env.APP_ENV === "development" ? undefined : env.APP_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(createDb(env.DB), { provider: "sqlite", schema }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: PASSWORD_MIN,
      maxPasswordLength: PASSWORD_MAX,
      // Verification becomes required before the first team save (M3), not at sign-in.
      requireEmailVerification: false,
      resetPasswordTokenExpiresIn: 60 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => sendAuthEmail(env, user.email, "reset", url),
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => sendAuthEmail(env, user.email, "verify", url),
    },
    user: {
      additionalFields: {
        role: { type: "string", required: false, defaultValue: "user", input: false },
      },
    },
    plugins: [nextCookies()],
  });
}

export type Auth = ReturnType<typeof createAuth>;

// One instance per Worker isolate and environment.
const instances = new WeakMap<CloudflareEnv, Auth>();

export async function getAuth(): Promise<Auth> {
  const { env } = await getCloudflareContext({ async: true });
  let auth = instances.get(env);
  if (!auth) {
    auth = createAuth(env);
    instances.set(env, auth);
  }
  return auth;
}
