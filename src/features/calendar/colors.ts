import type { CalendarItem } from "./queries";

/** Dot colour per calendar item type (plain module so Server Components can import it). */
export const TYPE_DOT: Record<CalendarItem["type"], string> = {
  MEETING: "bg-primary",
  DEADLINE: "bg-danger",
  MILESTONE: "bg-info",
  OTHER: "bg-subtle-foreground",
};
