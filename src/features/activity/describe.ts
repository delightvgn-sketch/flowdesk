import { PROJECT_STATUS_META, TASK_STATUS_META } from "@/lib/constants";
import { formatMoney } from "@/lib/money";
import type { ProjectStatus, TaskStatus } from "@/server/db/schema";

export type ActivityItem = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  entityLabel: string | null;
  projectId: string | null;
  metadata: Record<string, string | number | boolean | null> | null;
  createdAt: Date;
  actorName: string | null;
  actorAvatar: string | null;
};

/** Human sentence fragments for activity entries: "{actor} {verb} {target}". */
export function describeActivity(a: ActivityItem): { verb: string; target: string | null } {
  const m = a.metadata ?? {};
  const label = a.entityLabel;
  switch (a.action) {
    case "client.created":
      return { verb: "added client", target: label };
    case "client.updated":
      return { verb: "updated client", target: label };
    case "client.archived":
      return { verb: "archived client", target: label };
    case "project.created":
      return { verb: "created project", target: label };
    case "project.updated":
      return { verb: "updated project", target: label };
    case "project.status_changed":
      return { verb: `moved to ${PROJECT_STATUS_META[m.to as ProjectStatus]?.label.toLowerCase() ?? "a new status"}:`, target: label };
    case "project.deleted":
      return { verb: "deleted project", target: label };
    case "task.created":
      return { verb: "created task", target: label };
    case "task.completed":
      return { verb: "completed", target: label };
    case "task.status_changed":
      return { verb: `moved to ${TASK_STATUS_META[m.to as TaskStatus]?.label.toLowerCase() ?? "a new status"}:`, target: label };
    case "task.assigned":
      return { verb: `assigned ${m.assignee ?? "someone"} to`, target: label };
    case "comment.posted":
      return { verb: "commented on", target: label };
    case "invoice.created":
      return { verb: "created invoice", target: label };
    case "invoice.sent":
      return { verb: "sent invoice", target: label };
    case "invoice.paid":
      return { verb: "marked as paid:", target: label };
    case "invoice.cancelled":
      return { verb: "cancelled invoice", target: label };
    case "payment.recorded":
      return { verb: `recorded ${m.amount ? formatMoney(Number(m.amount)) : "a payment"} for`, target: label };
    case "file.uploaded":
      return { verb: "uploaded", target: label };
    case "file.deleted":
      return { verb: "deleted file", target: label };
    case "milestone.approved":
      return { verb: "approved milestone", target: label };
    case "milestone.changes_requested":
      return { verb: "requested changes on", target: label };
    case "milestone.created":
      return { verb: "added milestone", target: label };
    case "message.posted":
      return { verb: "posted a message in", target: label };
    case "member.joined":
      return { verb: "joined the workspace", target: null };
    case "member.invited":
      return { verb: "invited", target: label };
    case "event.created":
      return { verb: "scheduled", target: label };
    default:
      return { verb: a.action.replace(".", " "), target: label };
  }
}

export function activityHref(a: ActivityItem): string | null {
  if (!a.entityId) return a.projectId ? `/projects/${a.projectId}` : null;
  switch (a.entityType) {
    case "client":
      return `/clients/${a.entityId}`;
    case "project":
      return `/projects/${a.entityId}`;
    case "task":
      return `/tasks?task=${a.entityId}`;
    case "invoice":
    case "payment":
      return `/invoices/${a.entityId}`;
    case "file":
      return a.projectId ? `/projects/${a.projectId}?tab=files` : "/files";
    default:
      return a.projectId ? `/projects/${a.projectId}` : null;
  }
}
