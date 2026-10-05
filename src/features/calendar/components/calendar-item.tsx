"use client";

import { MapPin, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { deleteEvent } from "@/features/calendar/actions";
import { useAction } from "@/hooks/use-action";
import { EVENT_TYPE_META } from "@/lib/constants";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

import { TYPE_DOT } from "../colors";
import type { CalendarItem } from "../queries";

/** Compact chip in the month/week grid; opens details in a popover. */
export function CalendarChip({ item, compact = true }: { item: CalendarItem; compact?: boolean }) {
  const router = useRouter();
  const remove = useAction(deleteEvent, { success: "Event deleted.", onSuccess: () => router.refresh() });
  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "flex w-full items-center gap-1.5 rounded px-1.5 py-0.5 text-left text-[11px] leading-4 transition-colors hover:bg-muted",
          !compact && "py-1.5 text-xs",
        )}
      >
        <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", TYPE_DOT[item.type])} />
        {item.time && <span className="tabular shrink-0 text-muted-foreground">{item.time}</span>}
        <span className="truncate">{item.title}</span>
        <span className="sr-only">— {EVENT_TYPE_META[item.type].label}</span>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="start">
        <p className="text-xs font-medium text-muted-foreground">{EVENT_TYPE_META[item.type].label}</p>
        <p className="mt-1 font-medium">{item.title}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatDate(item.date, "EEEE d MMMM")}
          {item.time && ` · ${item.time}${item.endTime ? `–${item.endTime}` : ""}`}
        </p>
        {item.location && (
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="size-3.5" /> {item.location}
          </p>
        )}
        {item.subtitle && <p className="mt-2 text-sm">{item.subtitle}</p>}
        <div className="mt-3 flex gap-2">
          {item.href && (
            <Button size="sm" variant="outline" asChild>
              <Link href={item.href}>Open</Link>
            </Button>
          )}
          {item.kind === "event" && item.editable && (
            <Button
              size="sm"
              variant="ghost"
              className="text-danger hover:text-danger"
              onClick={() => remove.execute({ id: item.id })}
              disabled={remove.pending}
            >
              <Trash2 /> Delete
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
