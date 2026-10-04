import {
  BarChart3,
  Bell,
  CalendarDays,
  CheckSquare,
  CreditCard,
  FileText,
  FolderKanban,
  FolderOpen,
  LayoutDashboard,
  MessagesSquare,
  Settings,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";

import { can, type Permission } from "@/lib/permissions";
import type { WorkspaceRole } from "@/server/db/schema";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  permission?: Permission;
  /** Shown in the mobile bottom bar. */
  primary?: boolean;
};

export type NavGroup = { label?: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, primary: true },
      { label: "Clients", href: "/clients", icon: Users, permission: "client:view" },
      { label: "Projects", href: "/projects", icon: FolderKanban, primary: true },
      { label: "Tasks", href: "/tasks", icon: CheckSquare, primary: true },
    ],
  },
  {
    label: "Finance",
    items: [
      { label: "Invoices", href: "/invoices", icon: FileText, permission: "invoice:view", primary: true },
      { label: "Payments", href: "/payments", icon: CreditCard, permission: "payment:manage" },
    ],
  },
  {
    label: "Workspace",
    items: [
      { label: "Files", href: "/files", icon: FolderOpen },
      { label: "Messages", href: "/messages", icon: MessagesSquare },
      { label: "Calendar", href: "/calendar", icon: CalendarDays },
      { label: "Analytics", href: "/analytics", icon: BarChart3, permission: "analytics:view" },
    ],
  },
  {
    items: [{ label: "FlowDesk AI", href: "/ai", icon: Sparkles, permission: "ai:use" }],
  },
];

export const SECONDARY_NAV: NavItem[] = [
  { label: "Notifications", href: "/notifications", icon: Bell },
  { label: "Settings", href: "/settings/profile", icon: Settings },
];

export function navForRole(role: WorkspaceRole): NavGroup[] {
  return NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => !i.permission || can(role, i.permission)) })).filter(
    (g) => g.items.length > 0,
  );
}

export function isActive(pathname: string, href: string) {
  const base = href.split("/").slice(0, 2).join("/");
  return pathname === href || pathname.startsWith(`${base}/`) || pathname === base;
}
