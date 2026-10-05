import type { Metadata } from "next";

import { NotificationList } from "@/features/notifications/notification-list";
import { listNotificationsFor } from "@/features/notifications/queries";
import { requireClientContext } from "@/server/auth/session";

export const metadata: Metadata = { title: "Notifications" };

export default async function PortalNotificationsPage() {
  const ctx = await requireClientContext();
  const items = await ctx.db((tx) => listNotificationsFor(tx, ctx.workspace.id, ctx.profile.id));
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Notifications</h1>
      <NotificationList items={items} unread={items.filter((i) => !i.readAt).length} />
    </div>
  );
}
