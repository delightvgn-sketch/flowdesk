import { convertToModelMessages, createUIMessageStreamResponse, isStepCount, streamText, toUIMessageStream, type UIMessage } from "ai";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import { todayISO } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { aiModel, AI_NOT_CONFIGURED, friendlyAiError } from "@/server/ai/model";
import { workspaceTools } from "@/server/ai/tools";
import { getAppContext } from "@/server/auth/session";
import { aiConversations, aiMessages } from "@/server/db/schema";
import { features } from "@/server/env";

export const maxDuration = 60;

const bodySchema = z.object({
  conversationId: z.uuid(),
  message: z.object({ id: z.string(), role: z.literal("user"), parts: z.array(z.any()) }),
});

/**
 * FlowDesk AI chat. Only the newest user message is accepted from the browser;
 * history is loaded from the database (under RLS), so a client can't forge
 * earlier turns. Tools query workspace data as the signed-in user.
 */
export async function POST(request: Request) {
  if (!features.ai()) return Response.json({ error: AI_NOT_CONFIGURED }, { status: 503 });

  let ctx;
  try {
    ctx = await getAppContext();
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(ctx.role, "ai:use")) return Response.json({ error: "Forbidden" }, { status: 403 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const { conversationId, message } = parsed.data;
  const text = (message.parts as { type: string; text?: string }[])
    .filter((p) => p.type === "text")
    .map((p) => p.text ?? "")
    .join("\n")
    .trim()
    .slice(0, 8000);
  if (!text) return Response.json({ error: "Empty message" }, { status: 400 });

  const history = await ctx.db(async (tx) => {
    const conversation = await tx.query.aiConversations.findFirst({
      where: and(eq(aiConversations.id, conversationId), eq(aiConversations.profileId, ctx.profile.id)),
    });
    if (!conversation) return null;
    const rows = await tx.select().from(aiMessages).where(eq(aiMessages.conversationId, conversationId)).orderBy(asc(aiMessages.createdAt));
    await tx.insert(aiMessages).values({ workspaceId: ctx.workspace.id, conversationId, role: "user", content: text });
    if (rows.length === 0) {
      await tx.update(aiConversations).set({ title: text.slice(0, 80) }).where(eq(aiConversations.id, conversationId));
    } else {
      await tx.update(aiConversations).set({ updatedAt: new Date() }).where(eq(aiConversations.id, conversationId));
    }
    return rows;
  });
  if (!history) return Response.json({ error: "Conversation not found" }, { status: 404 });

  const messages: UIMessage[] = [
    ...history.slice(-20).map((m) => ({ id: m.id, role: m.role, parts: [{ type: "text" as const, text: m.content }] })),
    { id: message.id, role: "user", parts: [{ type: "text", text }] },
  ];
  const today = todayISO(ctx.workspace.timezone);

  try {
    const result = streamText({
      model: aiModel(),
      system: [
        `You are FlowDesk AI, the assistant inside FlowDesk for ${ctx.workspace.name}, a ${ctx.workspace.currency} business.`,
        `Today is ${today}. The user is ${ctx.profile.fullName} (role: ${ctx.role}).`,
        "Use the tools to look up real workspace data before answering questions about clients, projects, tasks or money. Resolve names with searchWorkspace first.",
        "Never invent data. If a tool returns nothing or an error, say so plainly. If financial tools aren't available, explain that the user's role doesn't include financial data.",
        "Answer concisely in Markdown: short paragraphs, bullet lists, bold key numbers. Format money like 'KSh 85,000'.",
      ].join("\n"),
      messages: await convertToModelMessages(messages),
      tools: workspaceTools(ctx, today),
      stopWhen: isStepCount(6),
    });

    return createUIMessageStreamResponse({
      stream: toUIMessageStream({
        stream: result.stream,
        onEnd: async ({ messages: finalMessages }) => {
          const last = finalMessages.at(-1);
          const reply = last?.role === "assistant" ? last.parts.filter((p) => p.type === "text").map((p) => (p as { text: string }).text).join("\n").trim() : "";
          if (reply) {
            await ctx.db((tx) => tx.insert(aiMessages).values({ workspaceId: ctx.workspace.id, conversationId, role: "assistant", content: reply }));
          }
        },
        onError: (error) => friendlyAiError(error),
      }),
    });
  } catch (error) {
    return Response.json({ error: friendlyAiError(error) }, { status: 500 });
  }
}
