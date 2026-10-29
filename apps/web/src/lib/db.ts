import "server-only";
import { createDb } from "@cs-vv-fantasy/db";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function getDb() {
  const { env } = await getCloudflareContext({ async: true });
  return createDb(env.DB);
}
