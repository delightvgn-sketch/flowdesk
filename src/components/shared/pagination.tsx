import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

/** Server-rendered, URL-based pagination. Preserves all other query params. */
export function Pagination({
  page,
  pageSize,
  total,
  searchParams,
  basePath,
}: {
  page: number;
  pageSize: number;
  total: number;
  searchParams: Record<string, string | string[] | undefined>;
  basePath: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;

  const href = (p: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      if (typeof v === "string" && k !== "page") params.set(k, v);
    }
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-3 text-sm">
      <p className="text-muted-foreground tabular">
        {from}–{to} of {total.toLocaleString("en-KE")}
      </p>
      <div className="flex items-center gap-1">
        <PageLink href={href(page - 1)} disabled={page <= 1} label="Previous page">
          <ChevronLeft className="size-4" />
          <span className="hidden sm:inline">Previous</span>
        </PageLink>
        <span className="px-2 text-muted-foreground tabular">
          {page} / {pages}
        </span>
        <PageLink href={href(page + 1)} disabled={page >= pages} label="Next page">
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="size-4" />
        </PageLink>
      </div>
    </nav>
  );
}

function PageLink({ href, disabled, label, children }: { href: string; disabled: boolean; label: string; children: React.ReactNode }) {
  const classes = cn(
    "inline-flex h-8 items-center gap-1 rounded-md border bg-card px-2.5 text-[13px] font-medium shadow-xs",
    disabled ? "pointer-events-none opacity-40" : "hover:bg-muted",
  );
  if (disabled) {
    return (
      <span aria-disabled className={classes} aria-label={label}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className={classes} aria-label={label} scroll={false}>
      {children}
    </Link>
  );
}

/** Parse ?page= safely. */
export function parsePage(value: string | string[] | undefined): number {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

export function param(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return v && v.trim() ? v.trim() : undefined;
}
