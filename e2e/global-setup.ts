import { execSync } from "node:child_process";

/** Start every run from a freshly seeded demo workspace. */
export default function globalSetup() {
  if (process.env.E2E_SKIP_SEED) return;
  execSync("npm run db:seed", { stdio: "inherit" });
}
