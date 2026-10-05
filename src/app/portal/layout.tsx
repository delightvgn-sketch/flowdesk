import { and, count, eq, isNull } from "drizzle-orm";

import { PortalShell } from "@/features/portal/portal-shell";
import { requireClientContext } from "@/server/auth/session";
import { clients, notifications } from "@/server/db/schema";

export default async function PortalLayout({ children }: LayoutProps<"/portal">) {
  const ctx = await requireClientContext();
  const [client, [{ unread }]] = await ctx.db((tx) =>
    Promise.all([
      tx.query.clients.findFirst({ where: eq(clients.id, ctx.clientId) }),
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
    ]),
  );
  return (
    <PortalShell
      user={{ name: ctx.profile.fullName, email: ctx.profile.email, avatarUrl: ctx.profile.avatarUrl }}
      workspaceName={ctx.workspace.name}
      clientName={client?.company ?? client?.name ?? ""}
      unread={unread}
    >
      {children}
    </PortalShell>
  );
}
