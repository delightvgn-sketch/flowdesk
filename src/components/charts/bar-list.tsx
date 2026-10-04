import Link from "next/link";

import { cn } from "@/lib/utils";

export type BarListItem = {
  label: string;
  value: number;
  display: string;
  href?: string;
  /** Tailwind background class for the bar — status tones or the brand colour. */
  barClass?: string;
  hint?: string;
};

/**
 * Ranked horizontal bars rendered as plain HTML. Labels and values are always
 * visible text, so the list doubles as its own table view.
 */
export function BarList({ items, className, emptyLabel = "Nothing to show yet." }: { items: BarListItem[]; className?: string; emptyLabel?: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (items.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  return (
    <ul className={cn("space-y-2.5", className)}>
      {items.map((item) => {
        const content = (
          <>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate">{item.label}</span>
              <span className="tabular shrink-0 font-medium">
                {item.display}
                {item.hint && <span className="ml-1.5 text-xs font-normal text-muted-foreground">{item.hint}</span>}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className={cn("h-full rounded-full", item.barClass ?? "bg-chart-1")} style={{ width: `${Math.max(2, (item.value / max) * 100)}%` }} />
            </div>
          </>
        );
        return (
          <li key={item.label}>
            {item.href ? (
              <Link href={item.href} className="block rounded-md transition-opacity hover:opacity-80">
                {content}
              </Link>
            ) : (
              content
            )}
          </li>
        );
      })}
    </ul>
  );
}
