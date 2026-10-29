import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";

export async function GET() {
  const { env } = await getCloudflareContext({ async: true });
  let db: "ok" | "error" = "ok";
  try {
    await env.DB.prepare("select 1").first();
  } catch {
    db = "error";
  }
  return Response.json(
    { ok: db === "ok", env: env.APP_ENV, db },
    { status: db === "ok" ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
