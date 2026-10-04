import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * Tabs whose state lives in `?tab=` so each tab is linkable, server-rendered and
 * works without JavaScript. Rendered as navigation with aria-current.
 */
export function UrlTabs({
  tabs,
  active,
  basePath,
  className,
}: {
  tabs: { key: string; label: string; count?: number }[];
  active: string;
  basePath: string;
  className?: string;
}) {
  return (
    <nav aria-label="Sections" className={cn("scrollbar-none -mx-4 mb-6 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0", className)}>
      <ul className="flex min-w-max gap-1">
        {tabs.map((tab, i) => {
          const isActive = tab.key === active;
          return (
            <li key={tab.key}>
              <Link
                href={i === 0 ? basePath : `${basePath}?tab=${tab.key}`}
                scroll={false}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative inline-flex h-10 items-center gap-1.5 px-3 text-sm font-medium transition-colors",
                  isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                  "after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full",
                  isActive && "after:bg-primary",
                )}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span className="tabular rounded-full bg-muted px-1.5 text-[11px] text-muted-foreground">{tab.count}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
