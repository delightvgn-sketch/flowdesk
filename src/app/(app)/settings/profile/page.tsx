import type { Metadata } from "next";
import { currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";

import { AccountManager, ProfileForm, Section } from "@/features/settings/components/settings-forms";
import { requireStaffContext } from "@/server/auth/session";
import { profiles } from "@/server/db/schema";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfileSettingsPage() {
  const ctx = await requireStaffContext();
  // Keep the avatar in step with the Clerk account.
  const user = await currentUser();
  const avatar = user?.hasImage ? user.imageUrl : null;
  if (avatar !== ctx.profile.avatarUrl) {
    await ctx.db((tx) => tx.update(profiles).set({ avatarUrl: avatar }).where(eq(profiles.id, ctx.profile.id)));
  }
  return (
    <div className="space-y-6">
      <Section title="Profile" description="Your name across FlowDesk.">
        <ProfileForm fullName={ctx.profile.fullName} email={ctx.profile.email} />
      </Section>
      <Section
        title="Account"
        description="Email addresses, password, profile photo and active sessions — managed securely by Clerk."
      >
        <AccountManager />
      </Section>
    </div>
  );
}
