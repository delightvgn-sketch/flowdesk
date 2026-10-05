"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, MoreHorizontal, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { WorkspaceRole } from "@/server/db/schema";

import { CommandPalette } from "./command-palette";
import { Logo } from "./logo";
import { NAV_GROUPS, SECONDARY_NAV, isActive, navForRole, type NavItem } from "./nav";
import { NotificationBell } from "./notification-bell";
import { UserMenu } from "./user-menu";
import { WorkspaceSwitcher } from "./workspace-switcher";

export type ShellUser = { name: string; email: string; avatarUrl: string | null };
export type ShellWorkspace = { id: string; name: string; role: WorkspaceRole; isDemo: boolean };

export function AppShell({
  user,
  workspace,
  workspaces,
  unreadCount,
  children,
}: {
  user: ShellUser;
  workspace: ShellWorkspace;
  workspaces: ShellWorkspace[];
  unreadCount: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const groups = navForRole(workspace.role);
  const primary = NAV_GROUPS.flatMap((g) => g.items).filter((i) => i.primary && groups.some((g) => g.items.includes(i)));

  // Close the mobile drawer after navigation (adjust-state-during-render pattern).
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setMobileOpen(false);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const sidebar = (
    <SidebarContent
      groups={groups}
      pathname={pathname}
      workspace={workspace}
      workspaces={workspaces}
      onSearch={() => setPaletteOpen(true)}
    />
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh border-r bg-sidebar lg:flex lg:flex-col" aria-label="Primary">
        {sidebar}
      </aside>

      {/* Mobile drawer with the full navigation */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[288px] bg-sidebar p-0 sm:max-w-[288px]">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
          <div className="flex h-full flex-col">{sidebar}</div>
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur-md sm:px-6">
          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            aria-label="Open navigation"
            onClick={() => setMobileOpen(true)}
          >
            <Menu />
          </Button>
          <Link href="/dashboard" className="lg:hidden" aria-label="FlowDesk home">
            <Logo compact />
          </Link>

          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="ml-auto flex h-9 items-center gap-2 rounded-md border bg-card px-3 text-sm text-muted-foreground shadow-xs transition-colors hover:border-border-strong hover:text-foreground sm:w-72 lg:ml-0"
            aria-label="Search FlowDesk"
            aria-keyshortcuts="Meta+K Control+K"
          >
            <Search className="size-4" aria-hidden />
            <span className="hidden sm:inline">Search FlowDesk…</span>
            <kbd className="ml-auto hidden rounded border bg-muted px-1.5 font-mono text-[10px] font-medium sm:inline">⌘K</kbd>
          </button>

          <div className="flex items-center gap-1 lg:ml-auto">
            <NotificationBell initialUnread={unreadCount} />
            <UserMenu user={user} />
          </div>
        </header>

        <main id="main" className="mx-auto w-full max-w-[1400px] flex-1 px-4 pt-6 pb-28 sm:px-6 sm:pt-8 lg:px-10 lg:pb-12">
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav
        aria-label="Quick navigation"
        className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur-md lg:hidden"
      >
        <ul className="mx-auto grid max-w-lg" style={{ gridTemplateColumns: `repeat(${primary.length + 1}, minmax(0, 1fr))` }}>
          {primary.map((item) => (
            <li key={item.href}>
              <BottomNavLink item={item} active={isActive(pathname, item.href)} />
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground"
            >
              <MoreHorizontal className="size-5" aria-hidden />
              More
            </button>
          </li>
        </ul>
      </nav>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} groups={groups} role={workspace.role} />
    </div>
  );
}

function BottomNavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
        active ? "text-primary" : "text-muted-foreground",
      )}
    >
      <Icon className="size-5" aria-hidden strokeWidth={active ? 2.25 : 1.75} />
      {item.label}
    </Link>
  );
}

function SidebarContent({
  groups,
  pathname,
  workspace,
  workspaces,
  onSearch,
}: {
  groups: ReturnType<typeof navForRole>;
  pathname: string;
  workspace: ShellWorkspace;
  workspaces: ShellWorkspace[];
  onSearch: () => void;
}) {
  return (
    <>
      <div className="flex h-14 items-center px-4">
        <Link href="/dashboard" aria-label="FlowDesk home" className="rounded-md">
          <Logo />
        </Link>
      </div>
      <div className="px-3 pb-2">
        <WorkspaceSwitcher current={workspace} workspaces={workspaces} />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-2" aria-label="Main">
        {groups.map((group, gi) => (
          <div key={gi} className="mb-4">
            {group.label && (
              <p className="mb-1 px-2 text-[11px] font-medium tracking-wide text-subtle-foreground uppercase">{group.label}</p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.href}>
                  <SidebarLink item={item} active={isActive(pathname, item.href)} />
                </li>
              ))}
            </ul>
          </div>
        ))}
        <button
          type="button"
          onClick={onSearch}
          className="sr-only focus:not-sr-only focus:block focus:w-full focus:rounded-md focus:px-2 focus:py-1.5 focus:text-left focus:text-sm"
        >
          Search
        </button>
      </nav>

      <div className="border-t px-3 py-3">
        <ul className="space-y-0.5">
          {SECONDARY_NAV.map((item) => (
            <li key={item.href}>
              <SidebarLink item={item} active={isActive(pathname, item.href)} />
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] font-medium transition-colors",
        active
          ? "bg-card text-foreground shadow-xs ring-1 ring-border"
          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
      )}
    >
      <Icon
        aria-hidden
        className={cn("size-4 shrink-0", active ? "text-primary" : "text-subtle-foreground group-hover:text-foreground")}
      />
      {item.label}
    </Link>
  );
}
