import { expect, type Page } from "@playwright/test";

const PERSONAS = { owner: "Victor Otieno", member: "Brian Kiprop", client: "Grace Achieng" } as const;
export type Persona = keyof typeof PERSONAS;

/** Sign in through the public demo page, exactly as a visitor would. */
export async function signInAs(page: Page, persona: Persona) {
  await page.goto("/demo");
  await page.getByRole("button", { name: new RegExp(PERSONAS[persona]) }).click();
  await page.waitForURL(persona === "client" ? /\/portal/ : /\/dashboard/, { timeout: 45_000 });
}

export async function expectToast(page: Page, text: string | RegExp) {
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: text }).first()).toBeVisible();
}

export const unique = (prefix: string) => `${prefix} ${Date.now().toString(36).slice(-5)}`;
