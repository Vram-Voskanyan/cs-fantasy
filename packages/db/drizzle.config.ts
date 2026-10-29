import { defineConfig } from "drizzle-kit";

// Generates SQL migrations only. They are applied with
// `wrangler d1 migrations apply` from apps/web (see wrangler.jsonc).
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/schema.ts",
  out: "./migrations",
});
