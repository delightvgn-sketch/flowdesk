import { Badge } from "@/components/ui/badge";
import {
  APPROVAL_STATUS_META,
  CLIENT_STATUS_META,
  EVENT_TYPE_META,
  INVOICE_STATUS_META,
  MILESTONE_STATUS_META,
  PAYMENT_STATUS_META,
  PRIORITY_META,
  PROJECT_STATUS_META,
  ROLE_META,
  TASK_STATUS_META,
} from "@/lib/constants";
import type {
  ApprovalStatus,
  ClientStatus,
  EventType,
  InvoiceStatus,
  MilestoneStatus,
  PaymentStatus,
  Priority,
  ProjectStatus,
  TaskStatus,
  WorkspaceRole,
} from "@/server/db/schema";

type Props =
  | { kind: "client"; value: ClientStatus }
  | { kind: "project"; value: ProjectStatus }
  | { kind: "task"; value: TaskStatus }
  | { kind: "invoice"; value: InvoiceStatus }
  | { kind: "payment"; value: PaymentStatus }
  | { kind: "milestone"; value: MilestoneStatus }
  | { kind: "approval"; value: ApprovalStatus }
  | { kind: "event"; value: EventType }
  | { kind: "role"; value: WorkspaceRole };

const lookup = {
  client: CLIENT_STATUS_META,
  project: PROJECT_STATUS_META,
  task: TASK_STATUS_META,
  invoice: INVOICE_STATUS_META,
  payment: PAYMENT_STATUS_META,
  milestone: MILESTONE_STATUS_META,
  approval: APPROVAL_STATUS_META,
  event: EVENT_TYPE_META,
  role: ROLE_META,
} as const;

/** One component for every status in the app, so colours stay consistent. */
export function StatusBadge(props: Props & { className?: string }) {
  const meta = (lookup[props.kind] as Record<string, { label: string; tone: Parameters<typeof Badge>[0]["tone"] }>)[props.value];
  return (
    <Badge tone={meta.tone} dot={props.kind !== "role"} className={props.className}>
      {meta.label}
    </Badge>
  );
}

const PRIORITY_BARS: Record<Priority, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, URGENT: 4 };

/** Compact signal-bar indicator for priority, with an accessible label. */
export function PriorityIndicator({ value, showLabel = false }: { value: Priority; showLabel?: boolean }) {
  const bars = PRIORITY_BARS[value];
  const color = value === "URGENT" ? "bg-danger" : value === "HIGH" ? "bg-warning" : "bg-foreground/60";
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
      title={`${PRIORITY_META[value].label} priority`}
    >
      <span aria-hidden className="flex h-3 items-end gap-[2px]">
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={`w-[3px] rounded-sm ${i <= bars ? color : "bg-border-strong"}`}
            style={{ height: `${i * 25}%` }}
          />
        ))}
      </span>
      <span className={showLabel ? "" : "sr-only"}>{PRIORITY_META[value].label}</span>
    </span>
  );
}
