import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { signInAs } from "./helpers";

/** Fails on serious/critical WCAG 2.1 A/AA violations. */
async function audit(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(800);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    // Third-party and dev-only overlays aren't ours to fix.
    .exclude("nextjs-portal")
    .exclude(".cl-rootBox")
    .analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  const summary = serious.map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
  expect(summary, `${path}\n${summary.join("\n")}`).toEqual([]);
}

test("public pages have no serious accessibility violations", async ({ page }) => {
  for (const path of ["/", "/demo", "/sign-in"]) await audit(page, path);
});

test("app pages have no serious accessibility violations", async ({ page }) => {
  await signInAs(page, "owner");
  for (const path of ["/dashboard", "/clients", "/projects", "/tasks", "/invoices", "/payments", "/files", "/messages", "/calendar", "/analytics", "/settings/team"]) {
    await audit(page, path);
  }
});

test("portal pages have no serious accessibility violations", async ({ page }) => {
  await signInAs(page, "client");
  for (const path of ["/portal", "/portal/invoices", "/portal/files"]) await audit(page, path);
});
