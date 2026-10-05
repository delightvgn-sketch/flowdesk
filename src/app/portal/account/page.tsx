import type { Metadata } from "next";

import {
  AccountManager,
  NotificationPrefsForm,
  ProfileForm,
  Section,
  ThemePicker,
} from "@/features/settings/components/settings-forms";
import { requireClientContext } from "@/server/auth/session";
import { DEFAULT_NOTIFICATION_PREFS } from "@/server/services/activity";

export const metadata: Metadata = { title: "Account" };

export default async function PortalAccountPage() {
  const ctx = await requireClientContext();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
      <Section title="Profile">
        <ProfileForm fullName={ctx.profile.fullName} email={ctx.profile.email} />
      </Section>
      <Section title="Notifications">
        <NotificationPrefsForm prefs={{ ...DEFAULT_NOTIFICATION_PREFS, ...ctx.profile.notificationPrefs }} />
      </Section>
      <Section title="Appearance">
        <ThemePicker />
      </Section>
      <Section title="Sign-in & security">
        <AccountManager />
      </Section>
    </div>
  );
}
