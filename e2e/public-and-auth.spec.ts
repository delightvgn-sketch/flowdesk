import { expect, test } from "@playwright/test";

import { signInAs } from "./helpers";

test.describe("public site & authentication", () => {
  test("landing page explains the product and links to demo and sign-up", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Run your client work");
    await expect(page.getByRole("link", { name: "View demo" }).first()).toHaveAttribute("href", "/demo");
    await expect(page.getByRole("link", { name: /Get started/ }).first()).toHaveAttribute("href", "/sign-up");
  });

  test("protected pages send signed-out visitors to sign in", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("health check reports the database", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.ok()).toBeTruthy();
    expect((await res.json()).database).toBe(true);
  });

  test("demo sign-in, then sign out", async ({ page }) => {
    await signInAs(page, "owner");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Victor");
    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("unknown routes show the 404 page", async ({ page }) => {
    await page.goto("/this-does-not-exist");
    await expect(page.getByText("This page has wandered off")).toBeVisible();
  });
});
