import { expect, type Page } from "@playwright/test";

const PERSONAS = { owner: "Victor Otieno", member: "Brian Kiprop", client: "Grace Achieng" } as const;
export type Persona = keyof typeof PERSONAS;

/**
 * Sign in through the public demo page, exactly as a visitor would. Clerk's
 * scripts load from its CDN, so network spikes can delay sign-in; the helper
 * waits for the button to become enabled and retries once from a fresh load.
 */
export async function signInAs(page: Page, persona: Persona) {
  const target = persona === "client" ? /\/portal/ : /\/dashboard/;
  for (let attempt = 1; attempt <= 2; attempt++) {
    await page.goto("/demo", { waitUntil: "domcontentloaded" });
    const button = page.getByRole("button", { name: new RegExp(PERSONAS[persona]) });
    await expect(button).toBeEnabled({ timeout: 45_000 });
    await button.click();
    const ok = await page
      .waitForURL(target, { timeout: 45_000 })
      .then(() => true)
      .catch(() => false);
    if (ok) return;
  }
  throw new Error(`Demo sign-in as ${persona} did not complete`);
}

export async function expectToast(page: Page, text: string | RegExp) {
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: text }).first()).toBeVisible();
}

export const unique = (prefix: string) => `${prefix} ${Date.now().toString(36).slice(-5)}`;
