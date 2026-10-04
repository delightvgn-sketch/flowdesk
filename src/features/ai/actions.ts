"use server";

import { generateText, Output } from "ai";
import { and, eq, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { PRIORITIES } from "@/lib/constants";
import { idSchema } from "@/lib/validation";
import { createAction } from "@/server/actions/safe-action";
import { aiModel, friendlyAiError } from "@/server/ai/model";
import { aiConversations, projects, tasks } from "@/server/db/schema";
import { NotFoundError, UserFacingError } from "@/server/errors";
import { logActivity } from "@/server/services/activity";
import { recomputeProjectProgress } from "@/server/services/projects";

async function guarded<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    throw new UserFacingError(friendlyAiError(error));
  }
}

/* --------------------------- Invoice line drafting -------------------------- */

export const draftInvoiceDescription = createAction(
  {
    schema: z.object({ draft: z.string().max(500).optional(), client: z.string().max(120).optional(), project: z.string().max(120).optional() }),
    permission: "invoice:manage",
  },
  async ({ draft, client, project }) =>
    guarded(async () => {
      const { text } = await generateText({
        model: aiModel(),
        system:
          "You write invoice line-item descriptions for a professional services agency. Reply with ONE description only: specific, professional, under 18 words, no price, no quotes, no trailing period.",
        prompt: [
          client && `Client: ${client}`,
          project && `Project: ${project}`,
          draft ? `Rewrite and improve this rough description: ${draft}` : "Suggest a typical line item for this project.",
        ]
          .filter(Boolean)
          .join("\n"),
      });
      return { text: text.trim().replace(/^["']|["']$/g, "") };
    }),
);

/* ----------------------------- Meeting summaries ---------------------------- */

const meetingSchema = z.object({
  summary: z.string().describe("3-5 sentence plain-English summary of the meeting"),
  decisions: z.array(z.string()).describe("Decisions that were made"),
  actionItems: z
    .array(
      z.object({
        task: z.string().describe("Concrete action, starting with a verb"),
        owner: z.string().nullable().describe("Person responsible, if mentioned"),
        due: z.string().nullable().describe("Due date or timeframe, if mentioned"),
      }),
    )
    .describe("Follow-up actions"),
});
export type MeetingSummary = z.infer<typeof meetingSchema>;

export const summarizeMeeting = createAction(
  { schema: z.object({ notes: z.string().trim().min(20, "Paste at least a few lines of notes").max(20000) }), permission: "ai:use" },
  async ({ notes }) =>
    guarded(async () => {
      const { output } = await generateText({
        model: aiModel(),
        output: Output.object({ schema: meetingSchema }),
        system: "You turn messy meeting notes into a crisp summary for a small agency. Never invent facts that aren't in the notes.",
        prompt: notes,
      });
      return output;
    }),
);

/* ------------------------------ Task generation ----------------------------- */

const generatedTaskSchema = z.object({
  title: z.string().describe("Short, actionable task title"),
  description: z.string().describe("One or two sentences of detail or acceptance criteria"),
  priority: z.enum(PRIORITIES),
  estimateDays: z.number().describe("Rough effort in working days"),
});
export type GeneratedTask = z.infer<typeof generatedTaskSchema>;

export const generateProjectTasks = createAction(
  { schema: z.object({ projectId: z.uuid(), brief: z.string().trim().max(4000).optional() }), permission: "task:create" },
  async ({ projectId, brief }, ctx) => {
    const project = await ctx.db((tx) => tx.query.projects.findFirst({ where: and(eq(projects.id, projectId), eq(projects.workspaceId, ctx.workspace.id)) }));
    if (!project) throw new NotFoundError("Project");
    const existing = await ctx.db((tx) => tx.select({ title: tasks.title }).from(tasks).where(eq(tasks.projectId, projectId)));

    return guarded(async () => {
      const { output } = await generateText({
        model: aiModel(),
        output: Output.array({ element: generatedTaskSchema, minItems: 3, maxItems: 12 }),
        system:
          "You are a senior delivery lead at a web & product agency. Break projects into clear, independent development tasks in a sensible order. Avoid duplicating existing tasks.",
        prompt: [
          `Project: ${project.name}`,
          project.description && `Description: ${project.description}`,
          brief && `Extra brief from the user: ${brief}`,
          existing.length ? `Existing tasks (don't repeat): ${existing.map((t) => t.title).join("; ")}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
      });
      return output;
    });
  },
);

export const addGeneratedTasks = createAction(
  {
    schema: z.object({
      projectId: z.uuid(),
      tasks: z.array(z.object({ title: z.string().trim().min(1).max(200), description: z.string().max(2000).optional(), priority: z.enum(PRIORITIES) })).min(1).max(20),
    }),
    permission: "task:create",
  },
  async ({ projectId, tasks: items }, ctx) => {
    await ctx.db(async (tx) => {
      const project = await tx.query.projects.findFirst({ where: and(eq(projects.id, projectId), eq(projects.workspaceId, ctx.workspace.id)) });
      if (!project) throw new NotFoundError("Project");
      const [{ top }] = await tx.select({ top: max(tasks.position) }).from(tasks).where(and(eq(tasks.workspaceId, ctx.workspace.id), eq(tasks.status, "TODO")));
      const rows = await tx
        .insert(tasks)
        .values(
          items.map((t, i) => ({
            workspaceId: ctx.workspace.id,
            projectId,
            title: t.title,
            description: t.description ?? null,
            priority: t.priority,
            status: "TODO" as const,
            position: (top ?? 0) + (i + 1) * 1000,
            createdById: ctx.profile.id,
          })),
        )
        .returning({ id: tasks.id, title: tasks.title });
      for (const r of rows) {
        await logActivity(tx, ctx, { action: "task.created", entityType: "task", entityId: r.id, entityLabel: r.title, projectId, clientId: project.clientId });
      }
      await recomputeProjectProgress(tx, projectId);
    });
    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/tasks");
    return { count: items.length };
  },
);

/* ------------------------------- Conversations ------------------------------ */

export const startConversation = createAction({ schema: z.object({ title: z.string().trim().max(120).optional() }), permission: "ai:use" }, async ({ title }, ctx) => {
  const [row] = await ctx.db((tx) =>
    tx
      .insert(aiConversations)
      .values({ workspaceId: ctx.workspace.id, profileId: ctx.profile.id, title: title?.slice(0, 80) || "New conversation" })
      .returning({ id: aiConversations.id }),
  );
  return { id: row.id };
});

export const deleteConversation = createAction({ schema: idSchema, permission: "ai:use" }, async ({ id }, ctx) => {
  await ctx.db((tx) => tx.delete(aiConversations).where(and(eq(aiConversations.id, id), eq(aiConversations.profileId, ctx.profile.id))));
  revalidatePath("/ai");
});

