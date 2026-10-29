import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// No incremental cache yet: pages are dynamic, leaderboards will be cached in KV.
export default defineCloudflareConfig({});
