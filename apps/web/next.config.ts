import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // Off for now: OpenNext on Workers and simple request-time auth first.
  // See docs/decisions/0001-m1-foundation.md.
  cacheComponents: false,
  transpilePackages: ["@cs-vv-fantasy/db", "@cs-vv-fantasy/scoring"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withNextIntl(nextConfig);

// Gives `next dev` access to the Cloudflare bindings from wrangler.jsonc.
initOpenNextCloudflareForDev();
