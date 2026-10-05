"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { ArrowUp, Loader2, Search, Sparkles, Square } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Markdown } from "@/components/shared/markdown";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { startConversation } from "@/features/ai/actions";
import { cn } from "@/lib/utils";

const TOOL_LABEL: Record<string, string> = {
  searchWorkspace: "Searching your workspace",
  getProjectStatus: "Reading project status",
  listProjects: "Listing projects",
  findDelayedProjects: "Checking for delayed projects",
  listMyTasks: "Looking at your tasks",
  getClientSummary: "Reviewing the client",
  getFinancialOverview: "Checking finances",
};

export function AiChat({
  conversationId,
  initialMessages,
  suggestions,
  userName,
}: {
  conversationId: string | null;
  initialMessages: { id: string; role: "user" | "assistant"; text: string }[];
  suggestions: string[];
  userName: string;
}) {
  const router = useRouter();
  const idRef = useRef(conversationId);
  const [input, setInput] = useState("");
  const scroller = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, stop, error } = useChat({
    id: conversationId ?? "new",
    messages: initialMessages.map<UIMessage>((m) => ({ id: m.id, role: m.role, parts: [{ type: "text", text: m.text }] })),
    transport: new DefaultChatTransport({
      api: "/api/ai/chat",
      prepareSendMessagesRequest: ({ messages: all }) => ({ body: { conversationId: idRef.current, message: all[all.length - 1] } }),
    }),
    onFinish: () => router.refresh(),
  });
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (error) toast.error("FlowDesk AI couldn't answer that. Please try again.");
  }, [error]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    if (!idRef.current) {
      const created = await startConversation({ title: trimmed.slice(0, 80) });
      if (!created.ok) return toast.error(created.error);
      idRef.current = created.data.id;
      window.history.replaceState(null, "", `/ai?c=${created.data.id}`);
    }
    setInput("");
    await sendMessage({ text: trimmed });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scroller} className="flex-1 overflow-y-auto px-4 py-6 sm:px-8" aria-live="polite">
        {messages.length === 0 ? (
          <div className="mx-auto flex max-w-xl flex-col items-center pt-6 text-center">
            <span className="flex size-11 items-center justify-center rounded-xl bg-brand-soft text-primary">
              <Sparkles className="size-5" aria-hidden />
            </span>
            <h2 className="mt-4 text-lg font-semibold">How can I help, {userName.split(" ")[0]}?</h2>
            <p className="mt-1 text-sm text-muted-foreground">I can look up clients, projects, tasks and invoices you have access to, and help you reason about them.</p>
            <div className="mt-6 grid w-full gap-2 sm:grid-cols-2">
              {suggestions.map((s) => (
                <button key={s} type="button" onClick={() => send(s)} className="rounded-lg border bg-card px-3 py-2.5 text-left text-sm shadow-xs transition-colors hover:border-primary/40 hover:bg-brand-soft/30">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ol className="mx-auto max-w-3xl space-y-6">
            {messages.map((m) => (
              <li key={m.id} className="flex gap-3">
                {m.role === "user" ? (
                  <UserAvatar name={userName} size="sm" />
                ) : (
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Sparkles className="size-3.5" aria-hidden />
                  </span>
                )}
                <div className="min-w-0 flex-1 space-y-2 pt-0.5">
                  <p className="text-xs font-medium text-muted-foreground">{m.role === "user" ? "You" : "FlowDesk AI"}</p>
                  {m.parts.map((part, i) => {
                    if (part.type === "text") return m.role === "user" ? <p key={i} className="text-sm whitespace-pre-wrap">{part.text}</p> : <Markdown key={i}>{part.text}</Markdown>;
                    if (part.type.startsWith("tool-")) {
                      const name = part.type.slice(5);
                      const done = "state" in part && part.state === "output-available";
                      return (
                        <p key={i} className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                          {done ? <Search className="size-3" /> : <Loader2 className="size-3 animate-spin" />}
                          {TOOL_LABEL[name] ?? "Looking things up"}
                          {done ? "" : "…"}
                        </p>
                      );
                    }
                    return null;
                  })}
                </div>
              </li>
            ))}
            {status === "submitted" && (
              <li className="flex items-center gap-2 pl-9 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Thinking…
              </li>
            )}
          </ol>
        )}
      </div>

      <form
        className="border-t bg-card p-3 sm:p-4"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <Textarea
            aria-label="Ask FlowDesk AI"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={2}
            maxLength={8000}
            placeholder="Ask about a client, a project, overdue invoices…"
            className="min-h-14 resize-none"
          />
          {busy ? (
            <Button type="button" size="icon" variant="outline" onClick={() => stop()} aria-label="Stop generating">
              <Square />
            </Button>
          ) : (
            <Button type="submit" size="icon" disabled={!input.trim()} aria-label="Send">
              <ArrowUp />
            </Button>
          )}
        </div>
        <p className={cn("mx-auto mt-2 max-w-3xl text-[11px] text-muted-foreground")}>AI can make mistakes. Answers are based only on data you can access.</p>
      </form>
    </div>
  );
}
