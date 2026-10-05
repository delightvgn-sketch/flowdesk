"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Logo } from "@/components/layout/logo";
import { NotificationBell } from "@/components/layout/notification-bell";
import { UserMenu } from "@/components/layout/user-menu";
import type { ShellUser } from "@/components/layout/app-shell";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/portal", label: "Overview", exact: true },
  { href: "/portal/projects", label: "Projects" },
  { href: "/portal/invoices", label: "Invoices" },
  { href: "/portal/files", label: "Files" },
  { href: "/portal/messages", label: "Messages" },
];

/** Client-facing chrome: a calm top bar, no internal navigation. */
export function PortalShell({ user, workspaceName, clientName, unread, children }: { user: ShellUser; workspaceName: string; clientName: string; unread: number; children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Link href="/portal" className="flex items-center gap-2" aria-label="Portal home">
            <Logo compact />
          </Link>
          <span className="hidden h-5 w-px bg-border sm:block" />
          <p className="hidden truncate text-sm text-muted-foreground sm:block">
            <span className="font-medium text-foreground">{workspaceName}</span> client portal · {clientName}
          </p>
          <div className="ml-auto flex items-center gap-1">
            <NotificationBell initialUnread={unread} allHref="/portal/notifications" />
            <UserMenu user={user} settingsHref="/portal/account" />
          </div>
        </div>
        <nav aria-label="Portal" className="scrollbar-none mx-auto max-w-6xl overflow-x-auto px-4 sm:px-6">
          <ul className="flex min-w-max gap-1">
            {NAV.map((item) => {
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative inline-flex h-10 items-center px-3 text-sm font-medium transition-colors",
                      active ? "text-foreground after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-primary" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>
      <main id="main" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        {children}
      </main>
    </div>
  );
}
