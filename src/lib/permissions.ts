import type { WorkspaceRole } from "@/server/db/schema";

/**
 * Application-level permission matrix. Row level security in Postgres enforces
 * *which rows* a user can touch; this matrix decides *which actions* a role may
 * attempt, so server actions can fail fast with a clear message and the UI can
 * hide controls that would be rejected anyway. Hiding is never the protection —
 * every server action calls `assertCan`.
 */
export const PERMISSIONS = {
  "workspace:update": ["OWNER", "ADMIN"],
  "workspace:delete": ["OWNER"],
  "team:view": ["OWNER", "ADMIN", "MEMBER"],
  "team:manage": ["OWNER", "ADMIN"],
  "team:transfer-ownership": ["OWNER"],

  "client:view": ["OWNER", "ADMIN", "MEMBER"],
  "client:manage": ["OWNER", "ADMIN"],

  "project:view": ["OWNER", "ADMIN", "MEMBER"],
  "project:create": ["OWNER", "ADMIN"],
  "project:update": ["OWNER", "ADMIN", "MEMBER"],
  "project:delete": ["OWNER", "ADMIN"],
  "project:manage-team": ["OWNER", "ADMIN"],

  "task:view": ["OWNER", "ADMIN", "MEMBER"],
  "task:create": ["OWNER", "ADMIN", "MEMBER"],
  "task:update": ["OWNER", "ADMIN", "MEMBER"],
  "task:delete": ["OWNER", "ADMIN", "MEMBER"],
  "task:comment": ["OWNER", "ADMIN", "MEMBER", "CLIENT"],

  "invoice:view": ["OWNER", "ADMIN"],
  "invoice:manage": ["OWNER", "ADMIN"],
  "payment:manage": ["OWNER", "ADMIN"],
  "analytics:view": ["OWNER", "ADMIN"],

  "file:view": ["OWNER", "ADMIN", "MEMBER", "CLIENT"],
  "file:upload": ["OWNER", "ADMIN", "MEMBER", "CLIENT"],
  "file:organize": ["OWNER", "ADMIN", "MEMBER"],

  "message:send": ["OWNER", "ADMIN", "MEMBER", "CLIENT"],
  "message:internal": ["OWNER", "ADMIN", "MEMBER"],
  "calendar:manage": ["OWNER", "ADMIN", "MEMBER"],
  "milestone:approve": ["CLIENT"],
  "ai:use": ["OWNER", "ADMIN", "MEMBER"],
} as const satisfies Record<string, readonly WorkspaceRole[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: WorkspaceRole | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return (PERMISSIONS[permission] as readonly WorkspaceRole[]).includes(role);
}

export class ForbiddenError extends Error {
  constructor(message = "You don't have permission to do that.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export function assertCan(role: WorkspaceRole | null | undefined, permission: Permission): void {
  if (!can(role, permission)) throw new ForbiddenError();
}

export const isStaffRole = (role: WorkspaceRole) => role !== "CLIENT";
export const isManagerRole = (role: WorkspaceRole) => role === "OWNER" || role === "ADMIN";

/**
 * Which roles an actor may assign. Admins can't create owners; nobody hands out
 * ownership through the normal role picker.
 */
export function assignableRoles(actor: WorkspaceRole): WorkspaceRole[] {
  if (actor === "OWNER" || actor === "ADMIN") return ["ADMIN", "MEMBER", "CLIENT"];
  return [];
}

/** Whether `actor` may change or remove a member who currently has `target` role. */
export function canManageMember(actor: WorkspaceRole, target: WorkspaceRole): boolean {
  if (!isManagerRole(actor)) return false;
  if (target === "OWNER") return false;
  return true;
}
