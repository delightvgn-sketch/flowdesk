import type { Metadata } from "next";

import { NotificationPrefsForm, Section, ThemePicker } from "@/features/settings/components/settings-forms";
import { requireStaffContext } from "@/server/auth/session";
import { DEFAULT_NOTIFICATION_PREFS } from "@/server/services/activity";

export const metadata: Metadata = { title: "Preferences" };

export default async function PreferencesPage() {
  const ctx = await requireStaffContext();
  return (
    <div className="space-y-6">
      <Section title="Appearance" description="Saved on this device.">
        <ThemePicker />
      </Section>
      <Section title="In-app notifications" description="Choose what shows up in your notifications.">
        <NotificationPrefsForm prefs={{ ...DEFAULT_NOTIFICATION_PREFS, ...ctx.profile.notificationPrefs }} />
      </Section>
    </div>
  );
}
