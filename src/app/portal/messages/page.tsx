import type { Metadata } from "next";
import Link from "next/link";

import { Panel } from "@/components/shared/misc";
import { MessageThread } from "@/features/messages/components/message-thread";
import { listMessages } from "@/features/messages/queries";
import { portalProjects } from "@/features/portal/queries";
import { requireClientContext } from "@/server/auth/session";

export const metadata: Metadata = { title: "Messages" };

export default async function PortalMessagesPage() {
  const ctx = await requireClientContext();
  const [msgs, projects] = await ctx.db((tx) =>
    Promise.all([listMessages(tx, ctx.workspace.id, { clientId: ctx.clientId }), portalProjects(tx, ctx.workspace.id)]),
  );
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
      <div>
        <h1 className="mb-1 text-2xl font-semibold tracking-tight">Messages</h1>
        <p className="mb-4 text-sm text-muted-foreground">General conversation with {ctx.workspace.name}.</p>
        <Panel className="flex h-[min(70dvh,620px)] flex-col overflow-hidden">
          <MessageThread
            className="flex-1"
            messages={msgs}
            currentProfileId={ctx.profile.id}
            clientId={ctx.clientId}
            canPostInternal={false}
            canModerate={false}
            showInternalBadge={false}
          />
        </Panel>
      </div>
      <aside>
        <h2 className="mb-2 text-sm font-semibold lg:mt-16">Project conversations</h2>
        <ul className="space-y-1">
          {projects.map((p) => (
            <li key={p.id}>
              <Link href={`/portal/projects/${p.id}`} className="block rounded-md px-3 py-2 text-sm hover:bg-muted">
                {p.name}
              </Link>
            </li>
          ))}
          {projects.length === 0 && <li className="text-sm text-muted-foreground">No projects yet.</li>}
        </ul>
      </aside>
    </div>
  );
}
