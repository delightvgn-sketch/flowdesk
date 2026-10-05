import Link from "next/link";
import { CalendarCheck2, CalendarDays, CheckSquare, FileWarning, FolderKanban } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { daysUntil, formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

import type { UpcomingItem } from "./queries";

const ICONS = { meeting: CalendarDays, task: CheckSquare, project: FolderKanban, invoice: FileWarning };

function relativeDay(date: string, today: string) {
  const d = daysUntil(date, today);
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  if (d < 0) return `${Math.abs(d)}d ago`;
  if (d < 7) return formatDate(date, "EEEE");
  return formatDate(date, "d MMM");
}

export function UpcomingList({ items, today }: { items: UpcomingItem[]; today: string }) {
  if (items.length === 0) {
    return (
      <div className="p-5">
        <EmptyState
          icon={CalendarCheck2}
          title="Nothing coming up"
          description="No meetings, deadlines or overdue invoices in the next two weeks."
          compact
        />
      </div>
    );
  }

  const sorted = [...items].sort((a, b) => {
    if (!!a.overdue !== !!b.overdue) return a.overdue ? -1 : 1;
    return a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? "");
  });

  return (
    <ul className="divide-y">
      {sorted.slice(0, 9).map((item) => {
        const Icon = ICONS[item.kind];
        return (
          <li key={`${item.kind}-${item.id}`}>
            <Link href={item.href} className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/40 sm:px-5">
              <span
                className={cn(
                  "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border",
                  item.overdue ? "border-danger/30 bg-danger-soft text-danger" : "bg-muted text-muted-foreground",
                )}
              >
                <Icon className="size-3.5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{item.title}</span>
                {item.subtitle && <span className="block truncate text-xs text-muted-foreground">{item.subtitle}</span>}
              </span>
              <span
                className={cn("shrink-0 text-right text-xs", item.overdue ? "font-medium text-danger" : "text-muted-foreground")}
              >
                {item.overdue && item.kind !== "invoice" ? "Overdue" : relativeDay(item.date, today)}
                {item.time && <span className="block text-subtle-foreground">{item.time}</span>}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
