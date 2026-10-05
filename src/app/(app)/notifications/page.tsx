import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { NotificationList } from "@/features/notifications/notification-list";
import { listNotificationsFor } from "@/features/notifications/queries";
import { requireStaffContext } from "@/server/auth/session";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const ctx = await requireStaffContext();
  const items = await ctx.db((tx) => listNotificationsFor(tx, ctx.workspace.id, ctx.profile.id));
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Notifications"
        description="Updates about your work across this workspace."
        actions={
          <Button variant="ghost" size="sm" asChild>
            <Link href="/settings/preferences">Preferences</Link>
          </Button>
        }
      />
      <NotificationList items={items} unread={items.filter((i) => !i.readAt).length} />
    </div>
  );
}
