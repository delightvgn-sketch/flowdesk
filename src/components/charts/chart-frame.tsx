"use client";

import { BarChart3, Table2 } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

export type ChartColumn<T> = { key: keyof T & string; label: string; format?: (value: T[keyof T]) => string; align?: "left" | "right" };

/**
 * Card chrome for a chart with a Chart/Table toggle, so every value is reachable
 * without hovering and screen-reader users get a real table.
 */
export function ChartFrame<T extends Record<string, unknown>>({
  title,
  description,
  legend,
  data,
  columns,
  children,
  className,
  action,
}: {
  title: string;
  description?: string;
  legend?: React.ReactNode;
  data: T[];
  columns: ChartColumn<T>[];
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");

  return (
    <section className={cn("flex min-w-0 flex-col rounded-xl border bg-card p-4 shadow-xs sm:p-5", className)} aria-label={title}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {action}
          <div className="flex rounded-md border p-0.5" role="group" aria-label="Display as">
            {(
              [
                ["chart", BarChart3, "Chart"],
                ["table", Table2, "Table"],
              ] as const
            ).map(([key, Icon, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={view === key}
                aria-label={`Show as ${label.toLowerCase()}`}
                onClick={() => setView(key)}
                className={cn(
                  "rounded-[5px] p-1 text-subtle-foreground transition-colors",
                  view === key ? "bg-muted text-foreground" : "hover:text-foreground",
                )}
              >
                <Icon className="size-3.5" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === "chart" ? (
        <>
          {legend && <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">{legend}</div>}
          <div className="min-h-0 flex-1">{children}</div>
        </>
      ) : (
        <div className="max-h-72 overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                {columns.map((c) => (
                  <th key={c.key} scope="col" className={cn("py-2 text-xs font-medium text-muted-foreground", c.align === "right" ? "text-right" : "text-left")}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i} className="border-b last:border-0">
                  {columns.map((c) => (
                    <td key={c.key} className={cn("tabular py-2", c.align === "right" && "text-right")}>
                      {c.format ? c.format(row[c.key]) : String(row[c.key] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function LegendKey({ color, label, shape = "rect" }: { color: string; label: string; shape?: "rect" | "line" }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className={shape === "rect" ? "size-2.5 rounded-[3px]" : "h-0.5 w-3 rounded-full"} style={{ background: color }} />
      {label}
    </span>
  );
}

/** Shared tooltip body: value first (strong), label second, line keys. */
export function TooltipCard({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: string; color?: string }[];
}) {
  return (
    <div className="min-w-36 rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1.5 text-muted-foreground">{title}</p>
      <ul className="space-y-1">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center gap-2">
            {r.color && <span aria-hidden className="h-0.5 w-3 rounded-full" style={{ background: r.color }} />}
            <span className="tabular font-semibold text-foreground">{r.value}</span>
            <span className="text-muted-foreground">{r.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export const AXIS_TICK = { fill: "var(--muted-foreground)", fontSize: 11 };
