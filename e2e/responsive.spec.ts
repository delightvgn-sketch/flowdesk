import { expect, test } from "@playwright/test";

import { signInAs } from "./helpers";

test("mobile layout uses bottom navigation and never scrolls horizontally", async ({ page }) => {
  await signInAs(page, "owner");
  await expect(page.getByRole("navigation", { name: "Quick navigation" })).toBeVisible();
  for (const path of ["/dashboard", "/clients", "/projects", "/tasks", "/invoices", "/calendar", "/analytics"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${path} overflows horizontally`).toBeLessThanOrEqual(1);
  }
  await page.getByRole("button", { name: "More" }).click();
  await expect(page.getByRole("dialog").getByRole("link", { name: "Payments" })).toBeVisible();
});
