"use client";

import { Loader2, Lock, MessagesSquare, Send, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { deleteMessage, sendMessage } from "@/features/messages/actions";
import { useAction } from "@/hooks/use-action";
import { formatDate, formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";

import type { MessageItem } from "../queries";

/**
 * A conversation with a composer. New messages from others appear via a
 * periodic refresh while the tab is visible — simple and good enough here.
 */
export function MessageThread({
  messages,
  currentProfileId,
  projectId,
  clientId,
  canPostInternal,
  canModerate,
  showInternalBadge = true,
  className,
  emptyText = "No messages yet. Start the conversation.",
}: {
  messages: MessageItem[];
  currentProfileId: string;
  projectId?: string | null;
  clientId?: string | null;
  canPostInternal: boolean;
  canModerate: boolean;
  showInternalBadge?: boolean;
  className?: string;
  emptyText?: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const send = useAction(sendMessage, {
    onSuccess: () => {
      setBody("");
      router.refresh();
    },
  });
  const remove = useAction(deleteMessage, { success: "Message deleted.", onSuccess: () => router.refresh() });
  const hasClientAudience = !!(projectId || clientId);

  useEffect(() => {
    // Scroll only the thread itself, never the page.
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 20_000);
    return () => clearInterval(timer);
  }, [router]);

  function submit() {
    if (!body.trim() || send.pending) return;
    send.execute({
      body,
      projectId: projectId ?? null,
      clientId: projectId ? null : (clientId ?? null),
      internal: canPostInternal && hasClientAudience && internal,
    });
  }

  const dayOf = (iso: string) => formatDate(iso, "EEEE d MMMM");
  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div ref={scroller} className="flex-1 overflow-y-auto px-4 py-4 sm:px-5" aria-live="polite">
        {messages.length === 0 ? (
          <EmptyState icon={MessagesSquare} title={emptyText} compact className="border-0" />
        ) : (
          <ol className="space-y-4">
            {messages.map((m, i) => {
              const day = dayOf(m.createdAt);
              const showDay = i === 0 || day !== dayOf(messages[i - 1].createdAt);
              const mine = m.authorId === currentProfileId;
              return (
                <li key={m.id}>
                  {showDay && (
                    <p className="my-3 text-center text-[11px] font-medium text-subtle-foreground">
                      <span className="rounded-full bg-muted px-2 py-0.5">{day}</span>
                    </p>
                  )}
                  <div className="group flex gap-3">
                    <UserAvatar name={m.authorName ?? "Someone"} src={m.authorAvatar} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-x-2 text-xs">
                        <span className="font-medium">{m.authorName ?? "Someone"}</span>
                        {m.authorIsClient && <Badge tone="warning">Client</Badge>}
                        {m.internal && showInternalBadge && (
                          <Badge tone="muted">
                            <Lock /> Internal
                          </Badge>
                        )}
                        <time className="text-subtle-foreground" dateTime={m.createdAt} title={formatDateTime(m.createdAt)}>
                          {formatDate(m.createdAt, "HH:mm")}
                        </time>
                      </p>
                      <p
                        className={cn(
                          "mt-1 rounded-lg text-sm whitespace-pre-wrap",
                          m.internal && "border-l-2 border-warning/50 bg-warning-soft/40 py-1.5 pr-2 pl-3",
                        )}
                      >
                        {m.body}
                      </p>
                    </div>
                    {(mine || canModerate) && (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                        aria-label="Delete message"
                        onClick={() => remove.execute({ id: m.id })}
                      >
                        <Trash2 />
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <form
        className="border-t bg-card p-3 sm:p-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="flex items-end gap-2">
          <Textarea
            aria-label="Message"
            rows={2}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={
              internal
                ? "Internal note — only your team will see this"
                : "Write a message… (Enter to send, Shift+Enter for a new line)"
            }
            className={cn("min-h-14 resize-none", internal && "border-warning/50 bg-warning-soft/30")}
            maxLength={5000}
          />
          <Button type="submit" size="icon" disabled={send.pending || !body.trim()} aria-label="Send message">
            {send.pending ? <Loader2 className="animate-spin" /> : <Send />}
          </Button>
        </div>
        {canPostInternal && hasClientAudience && (
          <label className="mt-2 inline-flex items-center gap-2 text-xs text-muted-foreground">
            <Switch checked={internal} onCheckedChange={setInternal} aria-label="Internal note" />
            Internal note (hidden from the client)
          </label>
        )}
      </form>
    </div>
  );
}
