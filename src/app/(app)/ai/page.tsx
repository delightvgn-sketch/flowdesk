import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, desc, eq } from "drizzle-orm";
import { KeyRound, ListChecks, MessagesSquare, NotebookPen, Sparkles } from "lucide-react";

import { Panel } from "@/components/shared/misc";
import { PageHeader } from "@/components/shared/page-header";
import { param } from "@/components/shared/pagination";
import { AiChat } from "@/features/ai/components/ai-chat";
import { ConversationList } from "@/features/ai/components/conversation-list";
import { MeetingSummarizer } from "@/features/ai/components/meeting-summarizer";
import { AiTaskGenerator } from "@/features/ai/components/task-generator";
import { projectOptions } from "@/features/projects/queries";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { requirePagePermission, requireStaffContext } from "@/server/auth/session";
import { aiConversations, aiMessages } from "@/server/db/schema";
import { features } from "@/server/env";

export const metadata: Metadata = { title: "FlowDesk AI" };

const TABS = [
  { key: "chat", label: "Assistant", icon: MessagesSquare },
  { key: "meeting", label: "Meeting notes", icon: NotebookPen },
  { key: "tasks", label: "Task generator", icon: ListChecks },
] as const;

export default async function AiPage({ searchParams }: PageProps<"/ai">) {
  const ctx = await requireStaffContext();
  requirePagePermission(ctx, "ai:use");
  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === param(sp.tab))?.key ?? "chat";
  const enabled = features.ai();

  const data = await ctx.db(async (tx) => {
    const conversations = await tx
      .select({ id: aiConversations.id, title: aiConversations.title, updatedAt: aiConversations.updatedAt })
      .from(aiConversations)
      .where(and(eq(aiConversations.workspaceId, ctx.workspace.id), eq(aiConversations.profileId, ctx.profile.id)))
      .orderBy(desc(aiConversations.updatedAt))
      .limit(30);
    const requested = param(sp.c);
    const activeId = param(sp.new) ? null : (conversations.find((c) => c.id === requested)?.id ?? null);
    const messages = activeId
      ? await tx.select({ id: aiMessages.id, role: aiMessages.role, text: aiMessages.content }).from(aiMessages).where(eq(aiMessages.conversationId, activeId)).orderBy(asc(aiMessages.createdAt))
      : [];
    const projects = tab === "tasks" ? await projectOptions(tx, ctx.workspace.id) : [];
    return { conversations, activeId, messages, projects };
  });

  const finance = can(ctx.role, "invoice:view");
  const suggestions = finance
    ? ["Summarize everything related to Northstar Digital", "Which projects appear to be delayed?", "What's the status of the E-commerce Redesign?", "Which invoices are overdue and by how much?"]
    : ["What's on my plate this week?", "Which of my projects look delayed?", "What's the status of the E-commerce Redesign?", "Summarize the Booking Platform project"];

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" aria-hidden /> FlowDesk AI
          </span>
        }
        description="An assistant that knows your workspace — and only what you're allowed to see."
      />

      <nav aria-label="AI tools" className="mb-4 flex gap-1 overflow-x-auto">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "chat" ? "/ai" : `/ai?tab=${t.key}`}
            aria-current={t.key === tab ? "page" : undefined}
            className={cn("inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium whitespace-nowrap", t.key === tab ? "bg-card text-foreground shadow-xs ring-1 ring-border" : "text-muted-foreground hover:text-foreground")}
          >
            <t.icon className="size-4" aria-hidden /> {t.label}
          </Link>
        ))}
      </nav>

      {!enabled ? (
        <Panel className="mx-auto max-w-2xl p-6 text-center sm:p-10">
          <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <KeyRound className="size-5" aria-hidden />
          </span>
          <h2 className="mt-4 text-lg font-semibold">FlowDesk AI isn&apos;t configured yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Everything else in FlowDesk works without it. To turn on the assistant, meeting summaries, task generation and invoice drafting, add an{" "}
            <code className="rounded bg-muted px-1 font-mono text-xs">AI_GATEWAY_API_KEY</code> to your environment (or deploy on Vercel with AI Gateway enabled) and restart.
          </p>
          <p className="mt-4 text-xs text-muted-foreground">Keys stay on the server — the browser never sees them.</p>
        </Panel>
      ) : tab === "chat" ? (
        <div className="grid h-[calc(100dvh-15rem)] min-h-[520px] overflow-hidden rounded-xl border bg-card shadow-xs md:grid-cols-[240px_1fr]">
          <aside className="hidden border-r md:block" aria-label="Conversations">
            <ConversationList conversations={data.conversations} activeId={data.activeId} />
          </aside>
          <AiChat
            key={data.activeId ?? "new"}
            conversationId={data.activeId}
            initialMessages={data.messages}
            suggestions={suggestions}
            userName={ctx.profile.fullName}
          />
        </div>
      ) : tab === "meeting" ? (
        <Panel>
          <MeetingSummarizer />
        </Panel>
      ) : (
        <Panel className="p-6 sm:p-10">
          <div className="mx-auto max-w-xl text-center">
            <ListChecks className="mx-auto size-6 text-primary" aria-hidden />
            <h2 className="mt-3 text-lg font-semibold">Break a project into tasks</h2>
            <p className="mt-1 text-sm text-muted-foreground">Pick a project, add any context, review the suggestions and add the ones you like straight to its board.</p>
            <div className="mt-6 flex justify-center">
              {data.projects.length ? <AiTaskGenerator projects={data.projects} /> : <p className="text-sm text-muted-foreground">You don&apos;t have any active projects yet.</p>}
            </div>
          </div>
        </Panel>
      )}
    </>
  );
}
