import { expect, test } from "@playwright/test";

import { expectToast, signInAs, unique } from "./helpers";

test.describe("owner workflows", () => {
  test.beforeEach(async ({ page }) => signInAs(page, "owner"));

  test("create, search, edit and archive a client", async ({ page }) => {
    const company = unique("Kilele Coffee");
    await page.goto("/clients");
    await page.getByRole("button", { name: "New client" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Company").fill(company);
    await dialog.getByRole("button", { name: "Create client" }).click();
    // Validation: contact name is required.
    await expect(dialog.getByText("Contact name is required")).toBeVisible();
    await dialog.getByLabel("Contact name").fill("Wanjiku Njeri");
    await dialog.getByLabel("Email").fill("wanjiku@kilele.co.ke");
    await dialog.getByRole("button", { name: "Create client" }).click();
    await expectToast(page, "Client created successfully.");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(company);

    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await page.getByRole("dialog").getByLabel("Phone").fill("+254 711 000 111");
    await page.getByRole("dialog").getByRole("button", { name: "Save changes" }).click();
    await expectToast(page, "Client updated.");
    // Shown in Details and on the synced primary contact.
    await expect(page.getByText("+254 711 000 111").first()).toBeVisible();

    await page.goto("/clients");
    await page.getByRole("searchbox", { name: "Search clients…" }).fill(company.split(" ").pop()!);
    await expect(page.getByRole("link", { name: new RegExp(company) }).first()).toBeVisible();

    await page
      .getByRole("button", { name: `Actions for ${company}` })
      .first()
      .click();
    await page.getByRole("menuitem", { name: "Archive" }).click();
    await page.getByRole("button", { name: "Archive client" }).click();
    await expectToast(page, "Client archived.");
    await expect(page.getByText("No clients match your filters")).toBeVisible();
  });

  test("create a project, add a task, move it and comment", async ({ page }) => {
    const name = unique("Brand Refresh");
    await page.goto("/projects");
    await page.getByRole("button", { name: "New project" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Project name").fill(name);
    await dialog.getByRole("button", { name: "Create project" }).click();
    await expectToast(page, "Project created.");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(name);

    await page
      .getByRole("navigation", { name: "Sections" })
      .getByRole("link", { name: /^Tasks/ })
      .click();
    await page.getByRole("button", { name: "New task" }).click();
    const taskDialog = page.getByRole("dialog");
    const title = unique("Write homepage copy");
    await taskDialog.getByLabel("Title").fill(title);
    await taskDialog.getByRole("button", { name: "Create task" }).click();
    await expectToast(page, "Task created.");

    // Accessible alternative to drag and drop.
    const card = page.getByRole("article").filter({ hasText: title });
    await card.getByRole("button", { name: `Move “${title}”` }).click();
    await page.getByRole("menuitem", { name: "Done" }).click();
    await expectToast(page, "Task completed.");
    await expect(page.getByRole("region", { name: "Done" }).getByText(title)).toBeVisible();

    // Comment in the detail sheet.
    await page.getByRole("region", { name: "Done" }).getByText(title).click();
    const sheet = page.getByRole("dialog");
    await sheet.getByLabel("Write a comment").fill("Copy approved by the client.");
    await sheet.getByRole("button", { name: "Post comment" }).click();
    await expect(sheet.getByText("Copy approved by the client.")).toBeVisible();
  });

  test("global search finds clients and shows an empty state", async ({ page }) => {
    await page.keyboard.press("Control+k");
    const palette = page.getByRole("dialog");
    await palette.getByPlaceholder("Search FlowDesk…").fill("Northstar");
    await expect(palette.getByRole("option", { name: /Northstar Digital/ }).first()).toBeVisible();
    await palette.getByPlaceholder("Search FlowDesk…").fill("zzqx-nothing");
    await expect(palette.getByText(/No results for/)).toBeVisible();
  });
});
