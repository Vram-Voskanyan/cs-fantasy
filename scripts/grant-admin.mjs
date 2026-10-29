// Gives a user the admin role. Usage:
//   node scripts/grant-admin.mjs <email> [--local | --staging | --production]
import { execFileSync } from "node:child_process";

const [email, target = "--local"] = process.argv.slice(2);
if (!email || !/^[^\s@'"]+@[^\s@'"]+\.[^\s@'"]+$/.test(email)) {
  console.error("Usage: node scripts/grant-admin.mjs <email> [--local | --staging | --production]");
  process.exit(1);
}
const flags = { "--local": ["--local"], "--staging": ["--remote", "--env", "staging"], "--production": ["--remote"] }[target];
if (!flags) {
  console.error(`Unknown target ${target}`);
  process.exit(1);
}
execFileSync(
  "npx",
  ["wrangler", "d1", "execute", "DB", ...flags, "--command", `UPDATE user SET role = 'admin' WHERE email = '${email.toLowerCase()}'; SELECT email, role FROM user WHERE email = '${email.toLowerCase()}';`],
  { cwd: new URL("../apps/web", import.meta.url), stdio: "inherit" },
);
