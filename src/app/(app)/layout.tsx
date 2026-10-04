import { and, count, eq, isNull } from "drizzle-orm";

import { AppShell } from "@/components/layout/app-shell";
import { requireStaffContext } from "@/server/auth/session";
import { notifications } from "@/server/db/schema";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const ctx = await requireStaffContext();
  const [{ unread }] = await ctx.db((tx) =>
    tx
      .select({ unread: count() })
      .from(notifications)
      .where(
        and(
          eq(notifications.workspaceId, ctx.workspace.id),
          eq(notifications.recipientId, ctx.profile.id),
          isNull(notifications.readAt),
        ),
      ),
  );

  return (
    <AppShell
      user={{ name: ctx.profile.fullName, email: ctx.profile.email, avatarUrl: ctx.profile.avatarUrl }}
      workspace={{ id: ctx.workspace.id, name: ctx.workspace.name, role: ctx.role, isDemo: ctx.workspace.isDemo }}
      workspaces={ctx.memberships.map((m) => ({ id: m.workspace.id, name: m.workspace.name, role: m.role, isDemo: m.workspace.isDemo }))}
      unreadCount={unread}
    >
      {children}
    </AppShell>
  );
}
