"use client";

import { MessageSquarePlus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { deleteConversation } from "@/features/ai/actions";
import { useAction } from "@/hooks/use-action";
import { timeAgo } from "@/lib/dates";
import { cn } from "@/lib/utils";

export function ConversationList({ conversations, activeId }: { conversations: { id: string; title: string; updatedAt: Date }[]; activeId: string | null }) {
  const router = useRouter();
  const remove = useAction(deleteConversation, { success: "Conversation deleted.", onSuccess: () => router.push("/ai") });
  return (
    <div className="flex h-full flex-col">
      <div className="p-3">
        <Button variant="outline" className="w-full" asChild>
          <Link href="/ai?new=1">
            <MessageSquarePlus /> New chat
          </Link>
        </Button>
      </div>
      <ul className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
        {conversations.length === 0 && <li className="px-2 py-4 text-center text-xs text-muted-foreground">No conversations yet.</li>}
        {conversations.map((c) => (
          <li key={c.id} className="group relative">
            <Link
              href={`/ai?c=${c.id}`}
              aria-current={c.id === activeId ? "page" : undefined}
              className={cn("block rounded-md px-2.5 py-2 pr-8 text-sm hover:bg-muted", c.id === activeId && "bg-muted font-medium")}
            >
              <span className="block truncate">{c.title}</span>
              <span className="block text-[11px] font-normal text-subtle-foreground">{timeAgo(c.updatedAt)}</span>
            </Link>
            <button
              type="button"
              aria-label={`Delete conversation ${c.title}`}
              onClick={() => remove.execute({ id: c.id })}
              className="absolute top-2 right-1.5 rounded p-1 text-subtle-foreground opacity-0 group-hover:opacity-100 hover:text-danger focus-visible:opacity-100"
            >
              <Trash2 className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
