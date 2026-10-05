"use client";

import { Bell, Building2, User, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import type { WorkspaceRole } from "@/server/db/schema";

export function SettingsNav({ role: _role }: { role: WorkspaceRole }) {
  const pathname = usePathname();
  const items = [
    { href: "/settings/profile", label: "Profile", icon: User },
    { href: "/settings/preferences", label: "Preferences", icon: Bell },
    { href: "/settings/workspace", label: "Workspace", icon: Building2 },
    { href: "/settings/team", label: "Team", icon: Users },
  ];
  return (
    <nav aria-label="Settings" className="scrollbar-none -mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
      <ul className="flex gap-1 lg:flex-col">
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors",
                  active ? "bg-card text-foreground shadow-xs ring-1 ring-border" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <item.icon className="size-4" aria-hidden /> {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
