import { expect, test } from "@playwright/test";

import { expectToast, signInAs } from "./helpers";

test.describe("authorization", () => {
  test("members only see their projects and no finances", async ({ page }) => {
    await signInAs(page, "member");
    await expect(page.getByRole("link", { name: "Invoices" })).toHaveCount(0);
    await page.goto("/invoices");
    await expect(page.getByText("Not found")).toBeVisible();
    await page.goto("/analytics");
    await expect(page.getByText("Not found")).toBeVisible();

    await page.goto("/projects");
    await expect(page.getByRole("link", { name: /E-commerce Redesign/ }).first()).toBeVisible();
    // Brian isn't staffed on the Tujenge audit or the Q4 microsite.
    await expect(page.getByText("Loan Portal UX Audit")).toHaveCount(0);
    await expect(page.getByText("Q4 Campaign Microsite")).toHaveCount(0);
  });

  test("clients are kept in the portal and only see their own data", async ({ page }) => {
    await signInAs(page, "client");
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/portal$/);
    await page.goto("/clients");
    await expect(page).toHaveURL(/\/portal$/);

    await page.goto("/portal/projects");
    await expect(page.getByText("E-commerce Redesign")).toBeVisible();
    await expect(page.getByText("Booking Platform")).toHaveCount(0);

    await page.goto("/portal/invoices");
    await expect(page.getByText("INV-0020")).toBeVisible();
    // Drafts and other clients' invoices never appear.
    await expect(page.getByText("Draft")).toHaveCount(0);
  });

  test("a client approves a deliverable", async ({ page }) => {
    await signInAs(page, "client");
    await page.getByRole("link", { name: /Testing/ }).first().click();
    await page.getByRole("button", { name: "Approve" }).click();
    await expectToast(page, /approved/);
    await expect(page.getByText("Approved").first()).toBeVisible();
  });
});
