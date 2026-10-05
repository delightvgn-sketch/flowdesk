import type { Metadata } from "next";
import Link from "next/link";
import { addDays, addMonths, endOfMonth, endOfWeek, format, isSameMonth, parseISO, startOfMonth, startOfWeek } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { param } from "@/components/shared/pagination";
import { Button } from "@/components/ui/button";
import { TYPE_DOT } from "@/features/calendar/colors";
import { CalendarChip } from "@/features/calendar/components/calendar-item";
import { NewEventButton } from "@/features/calendar/components/event-dialog";
import { calendarItems, type CalendarItem } from "@/features/calendar/queries";
import { projectOptions } from "@/features/projects/queries";
import { EVENT_TYPE_META } from "@/lib/constants";
import { addDaysISO, formatDate, todayISO } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { requireStaffContext } from "@/server/auth/session";

export const metadata: Metadata = { title: "Calendar" };

type View = "month" | "week" | "upcoming";
const iso = (d: Date) => format(d, "yyyy-MM-dd");

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const ctx = await requireStaffContext();
  const sp = await searchParams;
  const today = todayISO(ctx.workspace.timezone);
  const view: View = (["month", "week", "upcoming"] as const).find((v) => v === param(sp.view)) ?? "month";
  const anchorRaw = param(sp.date);
  const anchor = parseISO(anchorRaw && /^\d{4}-\d{2}-\d{2}$/.test(anchorRaw) ? anchorRaw : today);

  let from: string, to: string, prev: string, next: string, label: string;
  if (view === "month") {
    from = iso(startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 }));
    to = iso(endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 }));
    prev = iso(addMonths(anchor, -1));
    next = iso(addMonths(anchor, 1));
    label = format(anchor, "MMMM yyyy");
  } else if (view === "week") {
    const start = startOfWeek(anchor, { weekStartsOn: 1 });
    from = iso(start);
    to = iso(addDays(start, 6));
    prev = iso(addDays(start, -7));
    next = iso(addDays(start, 7));
    label = `${format(start, "d MMM")} – ${format(addDays(start, 6), "d MMM yyyy")}`;
  } else {
    from = today;
    to = addDaysISO(today, 30);
    prev = next = today;
    label = "Next 30 days";
  }

  const [items, projects] = await ctx.db((tx) =>
    Promise.all([calendarItems(tx, ctx, from, to), projectOptions(tx, ctx.workspace.id)]),
  );
  const byDay = new Map<string, CalendarItem[]>();
  for (const item of items) byDay.set(item.date, [...(byDay.get(item.date) ?? []), item]);
  const href = (v: View, d?: string) => `/calendar?view=${v}${d ? `&date=${d}` : ""}`;

  return (
    <>
      <PageHeader
        title="Calendar"
        description="Meetings, deadlines, milestones and due dates in one place."
        actions={<NewEventButton defaultDate={view === "upcoming" ? today : iso(anchor)} projects={projects} />}
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          {view !== "upcoming" && (
            <>
              <Button variant="outline" size="icon-sm" asChild>
                <Link href={href(view, prev)} aria-label="Previous">
                  <ChevronLeft />
                </Link>
              </Button>
              <Button variant="outline" size="icon-sm" asChild>
                <Link href={href(view, next)} aria-label="Next">
                  <ChevronRight />
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href={href(view)}>Today</Link>
              </Button>
            </>
          )}
          <h2 className="ml-1 text-base font-semibold" aria-live="polite">
            {label}
          </h2>
        </div>
        <div className="flex rounded-md border bg-card p-0.5 shadow-xs" role="group" aria-label="Calendar view">
          {(["month", "week", "upcoming"] as const).map((v) => (
            <Link
              key={v}
              href={href(v, view === "upcoming" ? undefined : iso(anchor))}
              aria-current={v === view ? "page" : undefined}
              className={cn(
                "rounded-[5px] px-3 py-1 text-[13px] font-medium capitalize",
                v === view ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {v}
            </Link>
          ))}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {(Object.keys(EVENT_TYPE_META) as CalendarItem["type"][]).map((t) => (
          <span key={t} className="inline-flex items-center gap-1.5">
            <span aria-hidden className={cn("size-2 rounded-full", TYPE_DOT[t])} /> {EVENT_TYPE_META[t].label}
          </span>
        ))}
      </div>

      {view === "month" && (
        <>
          <div className="hidden overflow-hidden rounded-xl border bg-card shadow-xs md:block">
            <div className="grid grid-cols-7 border-b bg-muted/40 text-xs font-medium text-muted-foreground">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <div key={d} className="px-2 py-2">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {Array.from({ length: Math.round((parseISO(to).getTime() - parseISO(from).getTime()) / 86_400_000) + 1 }).map(
                (_, i) => {
                  const day = addDays(parseISO(from), i);
                  const key = iso(day);
                  const dayItems = byDay.get(key) ?? [];
                  return (
                    <div
                      key={key}
                      className={cn(
                        "min-h-28 border-r border-b p-1.5 [&:nth-child(7n)]:border-r-0",
                        !isSameMonth(day, anchor) && "bg-muted/30",
                      )}
                    >
                      <p
                        className={cn(
                          "mb-1 flex size-6 items-center justify-center rounded-full text-xs",
                          key === today
                            ? "bg-primary font-semibold text-primary-foreground"
                            : isSameMonth(day, anchor)
                              ? ""
                              : "text-subtle-foreground",
                        )}
                      >
                        {format(day, "d")}
                      </p>
                      <div className="space-y-0.5">
                        {dayItems.slice(0, 3).map((item) => (
                          <CalendarChip key={`${item.kind}-${item.id}`} item={item} />
                        ))}
                        {dayItems.length > 3 && (
                          <Link
                            href={href("week", key)}
                            className="block px-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                          >
                            +{dayItems.length - 3} more
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                },
              )}
            </div>
          </div>
          <div className="md:hidden">
            <AgendaList byDay={byDay} today={today} emptyText="Nothing scheduled this month." />
          </div>
        </>
      )}

      {view === "week" && (
        <div className="grid gap-2 md:grid-cols-7">
          {Array.from({ length: 7 }).map((_, i) => {
            const key = addDaysISO(from, i);
            const dayItems = byDay.get(key) ?? [];
            return (
              <section
                key={key}
                className={cn(
                  "rounded-xl border bg-card p-2 shadow-xs md:min-h-80",
                  key === today && "border-primary/40 ring-1 ring-primary/20",
                )}
                aria-label={formatDate(key, "EEEE d MMMM")}
              >
                <p className="mb-2 px-1 text-xs font-medium">
                  <span className="text-muted-foreground">{formatDate(key, "EEE")}</span> {formatDate(key, "d")}
                </p>
                <div className="space-y-1">
                  {dayItems.length === 0 ? (
                    <p className="px-1 text-xs text-subtle-foreground">—</p>
                  ) : (
                    dayItems.map((item) => <CalendarChip key={`${item.kind}-${item.id}`} item={item} compact={false} />)
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {view === "upcoming" && <AgendaList byDay={byDay} today={today} emptyText="Nothing in the next 30 days." />}
    </>
  );
}

function AgendaList({ byDay, today, emptyText }: { byDay: Map<string, CalendarItem[]>; today: string; emptyText: string }) {
  const days = [...byDay.keys()].sort();
  if (days.length === 0)
    return (
      <EmptyState
        icon={CalendarDays}
        title={emptyText}
        description="Add meetings with “New event”. Task, project, milestone and invoice due dates appear automatically."
      />
    );
  return (
    <div className="space-y-4">
      {days.map((day) => (
        <section key={day} aria-label={formatDate(day, "EEEE d MMMM")}>
          <h3 className={cn("mb-1.5 text-xs font-semibold", day === today ? "text-primary" : "text-muted-foreground")}>
            {day === today ? "Today · " : ""}
            {formatDate(day, "EEEE d MMMM")}
          </h3>
          <div className="divide-y rounded-xl border bg-card shadow-xs">
            {byDay.get(day)!.map((item) => (
              <div key={`${item.kind}-${item.id}`} className="px-1 py-0.5">
                <CalendarChip item={item} compact={false} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
