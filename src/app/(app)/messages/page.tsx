import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Building2, FolderKanban, Hash } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { param } from "@/components/shared/pagination";
import { MessageThread } from "@/features/messages/components/message-thread";
import { listMessages, listThreads, type Thread } from "@/features/messages/queries";
import { timeAgo } from "@/lib/dates";
import { can, isManagerRole } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { requireStaffContext } from "@/server/auth/session";

export const metadata: Metadata = { title: "Messages" };

const ICON = { general: Hash, project: FolderKanban, client: Building2 };

export default async function MessagesPage({ searchParams }: PageProps<"/messages">) {
  const ctx = await requireStaffContext();
  const sp = await searchParams;
  const projectId = param(sp.project);
  const clientId = projectId ? undefined : param(sp.client);
  const selected = projectId
    ? `project:${projectId}`
    : clientId
      ? `client:${clientId}`
      : param(sp.thread) === "general"
        ? "general"
        : null;

  const [threads, messages] = await ctx.db(async (tx) => {
    const all = await listThreads(tx, ctx.workspace.id, true);
    const key = selected ?? all.find((t) => t.count > 0)?.key ?? "general";
    const [kind, id] = key.split(":");
    const msgs = await listMessages(
      tx,
      ctx.workspace.id,
      kind === "project" ? { projectId: id } : kind === "client" ? { clientId: id } : {},
    );
    return [all, { key, msgs }] as const;
  });

  const active = threads.find((t) => t.key === messages.key) ?? threads[0];
  const sorted = [...threads].sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? "") || a.title.localeCompare(b.title));
  const withMessages = sorted.filter((t) => t.count > 0 || t.kind === "general");
  const quiet = sorted.filter((t) => t.count === 0 && t.kind !== "general");

  return (
    <>
      <PageHeader
        title="Messages"
        description="Conversations with your team and clients, organised by project."
        className="hidden sm:flex"
      />
      <div className="grid h-[calc(100dvh-11rem)] min-h-[480px] overflow-hidden rounded-xl border bg-card shadow-xs sm:h-[calc(100dvh-14rem)] md:grid-cols-[300px_1fr]">
        <nav aria-label="Conversations" className={cn("min-h-0 overflow-y-auto border-r", selected && "hidden md:block")}>
          <ThreadGroup title="Recent" threads={withMessages} active={active?.key} />
          {quiet.length > 0 && <ThreadGroup title="No messages yet" threads={quiet} active={active?.key} />}
        </nav>
        <section className={cn("flex min-h-0 flex-col", !selected && "hidden md:flex")} aria-label={active?.title}>
          {active && (
            <header className="flex items-center gap-3 border-b px-4 py-3 sm:px-5">
              <Link
                href="/messages"
                className="rounded-md p-1 text-muted-foreground hover:bg-muted md:hidden"
                aria-label="Back to conversations"
              >
                <ArrowLeft className="size-4" />
              </Link>
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold">{active.title}</h2>
                <p className="truncate text-xs text-muted-foreground">
                  {active.kind === "general"
                    ? "Team only — clients can't see this channel"
                    : active.kind === "project"
                      ? `Project · ${active.subtitle ?? "Internal"}`
                      : "Client conversation — visible to the client's portal users"}
                </p>
              </div>
              {active.kind === "project" && (
                <Link href={`/projects/${active.id}`} className="ml-auto text-xs font-medium text-primary hover:underline">
                  Open project
                </Link>
              )}
            </header>
          )}
          <MessageThread
            className="flex-1"
            messages={messages.msgs}
            currentProfileId={ctx.profile.id}
            projectId={active?.kind === "project" ? active.id : null}
            clientId={active?.kind === "client" ? active.id : null}
            canPostInternal={can(ctx.role, "message:internal")}
            canModerate={isManagerRole(ctx.role)}
          />
        </section>
      </div>
    </>
  );
}

function ThreadGroup({ title, threads, active }: { title: string; threads: Thread[]; active?: string }) {
  return (
    <div className="py-2">
      <p className="px-4 py-1.5 text-[11px] font-medium tracking-wide text-subtle-foreground uppercase">{title}</p>
      <ul>
        {threads.map((t) => {
          const Icon = ICON[t.kind];
          const href =
            t.kind === "general"
              ? "/messages?thread=general"
              : t.kind === "project"
                ? `/messages?project=${t.id}`
                : `/messages?client=${t.id}`;
          return (
            <li key={t.key}>
              <Link
                href={href}
                aria-current={t.key === active ? "page" : undefined}
                className={cn(
                  "flex gap-3 px-4 py-2.5 transition-colors hover:bg-muted/50",
                  t.key === active && "bg-brand-soft/60 hover:bg-brand-soft/60",
                )}
              >
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <Icon className="size-3.5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium">{t.title}</span>
                    {t.lastAt && (
                      <span className="shrink-0 text-[11px] text-subtle-foreground">{timeAgo(t.lastAt).replace(" ago", "")}</span>
                    )}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {t.lastBody ?? t.subtitle ?? "No messages yet"}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
