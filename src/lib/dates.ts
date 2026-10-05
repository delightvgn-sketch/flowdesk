import { differenceInCalendarDays, format, formatDistanceToNowStrict, isValid, parseISO } from "date-fns";

/**
 * Date-only values (due dates, issue dates) are stored as Postgres `date` and
 * travel as `YYYY-MM-DD` strings so they never shift across timezones.
 */
export type DateString = string;

function toDate(value: Date | string): Date {
  return typeof value === "string" ? parseISO(value) : value;
}

/** Today in the given IANA timezone, as YYYY-MM-DD. */
export function todayISO(timeZone = "Africa/Nairobi"): DateString {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function addDaysISO(date: DateString, days: number): DateString {
  const d = parseISO(date);
  d.setDate(d.getDate() + days);
  return format(d, "yyyy-MM-dd");
}

export function formatDate(value: Date | string | null | undefined, pattern = "d MMM yyyy"): string {
  if (!value) return "—";
  const d = toDate(value);
  return isValid(d) ? format(d, pattern) : "—";
}

export function formatShortDate(value: Date | string | null | undefined): string {
  return formatDate(value, "d MMM");
}

export function formatDateTime(value: Date | string | null | undefined): string {
  return formatDate(value, "d MMM yyyy, HH:mm");
}

export function timeAgo(value: Date | string): string {
  const d = toDate(value);
  const seconds = (Date.now() - d.getTime()) / 1000;
  if (seconds < 45) return "just now";
  return `${formatDistanceToNowStrict(d)} ago`;
}

/** Positive = days remaining, negative = days overdue. */
export function daysUntil(date: DateString, today: DateString = todayISO()): number {
  return differenceInCalendarDays(parseISO(date), parseISO(today));
}

export function dueLabel(date: DateString | null, today: DateString = todayISO()): { text: string; overdue: boolean } {
  if (!date) return { text: "No due date", overdue: false };
  const days = daysUntil(date, today);
  if (days < 0) return { text: `${Math.abs(days)}d overdue`, overdue: true };
  if (days === 0) return { text: "Due today", overdue: false };
  if (days === 1) return { text: "Due tomorrow", overdue: false };
  if (days <= 14) return { text: `Due in ${days}d`, overdue: false };
  return { text: `Due ${formatShortDate(date)}`, overdue: false };
}

/** Convert a wall-clock date + time in an IANA timezone to the matching UTC instant. */
export function zonedTimeToUtc(date: DateString, time: string, timeZone: string): Date {
  const guess = new Date(`${date}T${time}:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(guess);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asIfUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"));
  return new Date(guess.getTime() - (asIfUtc - guess.getTime()));
}
