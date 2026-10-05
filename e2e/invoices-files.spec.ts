import path from "node:path";
import fs from "node:fs";
import os from "node:os";

import { expect, test } from "@playwright/test";

import { expectToast, signInAs } from "./helpers";

test.describe("invoicing & files", () => {
  test.beforeEach(async ({ page }) => signInAs(page, "owner"));

  test("create an invoice with server-calculated totals, send it, mark it paid and download the PDF", async ({ page }) => {
    await page.goto("/invoices/new");
    await page.getByRole("combobox", { name: /Bill to/ }).click();
    await page.getByRole("option", { name: "Greenline Café" }).click();

    await page.getByLabel("Description for line 1").fill("Menu photography");
    await page.locator("#item-0-qty").fill("2");
    await page.locator("#item-0-price").fill("12500");
    await page.getByRole("button", { name: "Add line" }).click();
    await page.getByLabel("Description for line 2").fill("Menu design");
    await page.locator("#item-1-price").fill("30000");

    // 2 × 12,500 + 30,000 = 55,000; 16% VAT = 8,800; total 63,800
    await expect(page.getByText("KSh 63,800.00").first()).toBeVisible();
    await page.getByRole("button", { name: "Save & send" }).click();
    await expectToast(page, /Invoice INV-\d+ created/);
    await expect(page.getByText("Balance due")).toBeVisible();
    await expect(page.getByText("KSh 63,800").first()).toBeVisible();

    const pdf = await page.request.get(page.url().replace(/\/invoices\//, "/api/invoices/") + "/pdf");
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toBe("application/pdf");

    await page.getByRole("button", { name: "Mark as paid" }).click();
    await page.getByRole("dialog").getByLabel("Reference").fill("QJK7H2M9XP");
    await page.getByRole("dialog").getByRole("button", { name: "Mark as paid" }).click();
    await expectToast(page, "Invoice marked as paid.");
    await expect(page.getByText("Paid in full")).toBeVisible();
  });

  test("upload, download and delete a file", async ({ page }) => {
    const file = path.join(os.tmpdir(), `flowdesk-e2e-${Date.now()}.txt`);
    fs.writeFileSync(file, "Hello from the FlowDesk E2E suite.");
    await page.goto("/files");
    await page.locator('input[type="file"]').setInputFiles(file);
    await expectToast(page, "File uploaded.");
    const name = path.basename(file);
    await expect(page.getByRole("link", { name })).toBeVisible();

    const download = await page.request.get((await page.getByRole("link", { name }).getAttribute("href"))!);
    expect(download.status()).toBe(200);
    expect(await download.text()).toContain("Hello from the FlowDesk E2E suite.");

    await page.getByRole("button", { name: `Actions for ${name}` }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("button", { name: "Delete file" }).click();
    await expectToast(page, "File deleted.");
    await expect(page.getByRole("link", { name })).toHaveCount(0);
  });
});
