"use client";

import { Bell, CheckCheck, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { listNotifications, markAllNotificationsRead, markNotificationRead } from "@/features/workspace/actions";
import { timeAgo } from "@/lib/dates";
import { cn } from "@/lib/utils";

type Item = { id: string; title: string; body: string | null; href: string | null; readAt: Date | null; createdAt: Date };

export function NotificationBell({ initialUnread, allHref = "/notifications" }: { initialUnread: number; allHref?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[] | null>(null);
  const [unread, setUnread] = useState(initialUnread);
  const [loading, startLoading] = useTransition();

  useEffect(() => setUnread(initialUnread), [initialUnread]);

  useEffect(() => {
    if (!open) return;
    startLoading(async () => {
      const result = await listNotifications({});
      if (result.ok) setItems(result.data);
    });
  }, [open]);

  async function markAll() {
    setItems((current) => current?.map((n) => ({ ...n, readAt: n.readAt ?? new Date() })) ?? null);
    setUnread(0);
    await markAllNotificationsRead({});
    router.refresh();
  }

  async function openItem(item: Item) {
    setOpen(false);
    if (!item.readAt) {
      setUnread((u) => Math.max(0, u - 1));
      void markNotificationRead({ id: item.id });
    }
    if (item.href) router.push(item.href);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="relative" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}>
          <Bell />
          {unread > 0 && (
            <span className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-4 font-semibold text-primary-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,380px)] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          <Button variant="ghost" size="xs" onClick={markAll} disabled={unread === 0}>
            <CheckCheck /> Mark all read
          </Button>
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {items === null || (loading && items.length === 0) ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-label="Loading notifications" />
            </div>
          ) : items.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>
          ) : (
            <ul>
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => openItem(item)}
                    className="flex w-full gap-3 border-b px-4 py-3 text-left transition-colors last:border-0 hover:bg-muted/60"
                  >
                    <span
                      aria-hidden
                      className={cn("mt-1.5 size-2 shrink-0 rounded-full", item.readAt ? "bg-transparent" : "bg-primary")}
                    />
                    <span className="min-w-0 flex-1">
                      <span className={cn("block text-sm", !item.readAt && "font-medium")}>{item.title}</span>
                      {item.body && <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{item.body}</span>}
                      <span className="mt-1 block text-[11px] text-subtle-foreground">{timeAgo(item.createdAt)}</span>
                    </span>
                    {!item.readAt && <span className="sr-only">Unread</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="border-t p-2">
          <Button variant="ghost" size="sm" className="w-full" asChild>
            <Link href={allHref} onClick={() => setOpen(false)}>
              View all notifications
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
