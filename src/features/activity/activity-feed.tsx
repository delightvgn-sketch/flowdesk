import Link from "next/link";
import { Activity } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { UserAvatar } from "@/components/shared/user-avatar";
import { formatDateTime, timeAgo } from "@/lib/dates";

import { activityHref, describeActivity, type ActivityItem } from "./describe";

/** Vertical activity timeline: actor · action · resource · time. */
export function ActivityFeed({ items, emptyLabel = "No activity yet." }: { items: ActivityItem[]; emptyLabel?: string }) {
  if (items.length === 0) return <EmptyState icon={Activity} title={emptyLabel} compact className="border-0" />;

  return (
    <ol className="relative space-y-4 before:absolute before:top-2 before:bottom-2 before:left-[11px] before:w-px before:bg-border">
      {items.map((item) => {
        const { verb, target } = describeActivity(item);
        const href = activityHref(item);
        return (
          <li key={item.id} className="relative flex gap-3">
            <UserAvatar name={item.actorName ?? "Someone"} src={item.actorAvatar} size="sm" className="ring-4 ring-card" />
            <div className="min-w-0 flex-1 text-sm leading-6">
              <span className="font-medium">{item.actorName ?? "Someone"}</span> <span className="text-muted-foreground">{verb}</span>{" "}
              {target &&
                (href ? (
                  <Link href={href} className="font-medium underline-offset-4 hover:underline">
                    {target}
                  </Link>
                ) : (
                  <span className="font-medium">{target}</span>
                ))}
              <time dateTime={item.createdAt.toISOString()} title={formatDateTime(item.createdAt)} className="block text-xs text-subtle-foreground">
                {timeAgo(item.createdAt)}
              </time>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
