import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** KPI tile: label, a big tabular number and optional context line. */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  href,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  tone?: "default" | "success" | "warning" | "danger";
  href?: string;
  className?: string;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {Icon && (
          <Icon
            aria-hidden
            className={cn(
              "size-4",
              tone === "success" && "text-success",
              tone === "warning" && "text-warning",
              tone === "danger" && "text-danger",
              tone === "default" && "text-subtle-foreground",
            )}
          />
        )}
      </div>
      <p className="tabular mt-2 text-lg leading-tight font-semibold tracking-tight break-words sm:text-2xl">{value}</p>
      {hint && <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>}
    </>
  );

  const classes = cn(
    "block rounded-xl border bg-card p-4 shadow-xs transition-colors",
    href && "hover:border-border-strong hover:bg-accent/40",
    className,
  );

  return href ? (
    <Link href={href} className={classes}>
      {body}
    </Link>
  ) : (
    <div className={classes}>{body}</div>
  );
}
