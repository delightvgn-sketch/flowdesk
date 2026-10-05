"use client";

import { Bell, CheckCheck } from "lucide-react";
import { useRouter } from "next/navigation";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { markAllNotificationsRead, markNotificationRead } from "@/features/workspace/actions";
import { useAction } from "@/hooks/use-action";
import { formatDateTime, timeAgo } from "@/lib/dates";
import { cn } from "@/lib/utils";

type Item = { id: string; title: string; body: string | null; href: string | null; readAt: Date | null; createdAt: Date };

export function NotificationList({ items, unread }: { items: Item[]; unread: number }) {
  const router = useRouter();
  const markAll = useAction(markAllNotificationsRead, { success: "All caught up.", onSuccess: () => router.refresh() });

  async function open(item: Item) {
    if (!item.readAt) await markNotificationRead({ id: item.id });
    if (item.href) router.push(item.href);
    else router.refresh();
  }

  if (items.length === 0)
    return (
      <EmptyState
        icon={Bell}
        title="No notifications yet"
        description="You'll hear about assignments, comments, approvals, files and invoices here."
      />
    );

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{unread ? `${unread} unread` : "Everything is read"}</p>
        <Button variant="outline" size="sm" onClick={() => markAll.execute({})} disabled={!unread || markAll.pending}>
          <CheckCheck /> Mark all as read
        </Button>
      </div>
      <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-xs">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => open(item)}
              className={cn(
                "flex w-full gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/40 sm:px-5",
                !item.readAt && "bg-brand-soft/30",
              )}
            >
              <span
                aria-hidden
                className={cn("mt-1.5 size-2 shrink-0 rounded-full", item.readAt ? "bg-transparent" : "bg-primary")}
              />
              <span className="min-w-0 flex-1">
                <span className={cn("block text-sm", !item.readAt && "font-medium")}>{item.title}</span>
                {item.body && <span className="mt-0.5 block text-sm text-muted-foreground">{item.body}</span>}
              </span>
              <time
                className="shrink-0 text-xs text-subtle-foreground"
                dateTime={item.createdAt.toISOString()}
                title={formatDateTime(item.createdAt)}
              >
                {timeAgo(item.createdAt)}
              </time>
              {!item.readAt && <span className="sr-only">Unread</span>}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
