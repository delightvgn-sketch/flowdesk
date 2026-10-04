import type {
  ApprovalStatus,
  ClientStatus,
  EventType,
  InvoiceStatus,
  MilestoneStatus,
  PaymentMethod,
  PaymentStatus,
  Priority,
  ProjectStatus,
  TaskStatus,
  WorkspaceRole,
} from "@/server/db/schema";

/** Semantic tones understood by <Badge>. Keeps color decisions in one place. */
export type Tone = "neutral" | "brand" | "info" | "success" | "warning" | "danger" | "muted";

type Meta = { label: string; tone: Tone };

export const CLIENT_STATUSES = ["LEAD", "ACTIVE", "INACTIVE", "ARCHIVED"] as const satisfies ClientStatus[];
export const CLIENT_STATUS_META: Record<ClientStatus, Meta> = {
  LEAD: { label: "Lead", tone: "info" },
  ACTIVE: { label: "Active", tone: "success" },
  INACTIVE: { label: "Inactive", tone: "neutral" },
  ARCHIVED: { label: "Archived", tone: "muted" },
};

export const PROJECT_STATUSES = [
  "PLANNING",
  "IN_PROGRESS",
  "REVIEW",
  "COMPLETED",
  "ON_HOLD",
  "CANCELLED",
] as const satisfies ProjectStatus[];
export const PROJECT_STATUS_META: Record<ProjectStatus, Meta> = {
  PLANNING: { label: "Planning", tone: "neutral" },
  IN_PROGRESS: { label: "In progress", tone: "brand" },
  REVIEW: { label: "In review", tone: "warning" },
  COMPLETED: { label: "Completed", tone: "success" },
  ON_HOLD: { label: "On hold", tone: "muted" },
  CANCELLED: { label: "Cancelled", tone: "danger" },
};
export const ACTIVE_PROJECT_STATUSES: ProjectStatus[] = ["PLANNING", "IN_PROGRESS", "REVIEW"];

export const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const satisfies Priority[];
export const PRIORITY_META: Record<Priority, Meta & { rank: number }> = {
  LOW: { label: "Low", tone: "muted", rank: 0 },
  MEDIUM: { label: "Medium", tone: "neutral", rank: 1 },
  HIGH: { label: "High", tone: "warning", rank: 2 },
  URGENT: { label: "Urgent", tone: "danger", rank: 3 },
};

export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "REVIEW", "DONE"] as const satisfies TaskStatus[];
export const TASK_STATUS_META: Record<TaskStatus, Meta> = {
  TODO: { label: "To do", tone: "neutral" },
  IN_PROGRESS: { label: "In progress", tone: "brand" },
  REVIEW: { label: "Review", tone: "warning" },
  DONE: { label: "Done", tone: "success" },
};

export const MILESTONE_STATUSES = ["UPCOMING", "CURRENT", "COMPLETED"] as const satisfies MilestoneStatus[];
export const MILESTONE_STATUS_META: Record<MilestoneStatus, Meta> = {
  UPCOMING: { label: "Upcoming", tone: "neutral" },
  CURRENT: { label: "In progress", tone: "brand" },
  COMPLETED: { label: "Completed", tone: "success" },
};

export const APPROVAL_STATUS_META: Record<ApprovalStatus, Meta> = {
  NOT_REQUIRED: { label: "No approval needed", tone: "muted" },
  PENDING: { label: "Awaiting approval", tone: "warning" },
  APPROVED: { label: "Approved", tone: "success" },
  CHANGES_REQUESTED: { label: "Changes requested", tone: "danger" },
};

export const INVOICE_STATUSES = ["DRAFT", "SENT", "PAID", "OVERDUE", "CANCELLED"] as const satisfies InvoiceStatus[];
export const INVOICE_STATUS_META: Record<InvoiceStatus, Meta> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  SENT: { label: "Sent", tone: "info" },
  PAID: { label: "Paid", tone: "success" },
  OVERDUE: { label: "Overdue", tone: "danger" },
  CANCELLED: { label: "Cancelled", tone: "muted" },
};

export const PAYMENT_METHODS = ["MPESA", "BANK", "CARD", "CASH", "OTHER"] as const satisfies PaymentMethod[];
export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  MPESA: "M-Pesa",
  BANK: "Bank transfer",
  CARD: "Card",
  CASH: "Cash",
  OTHER: "Other",
};

export const PAYMENT_STATUSES = ["PENDING", "COMPLETED", "FAILED", "REFUNDED"] as const satisfies PaymentStatus[];
export const PAYMENT_STATUS_META: Record<PaymentStatus, Meta> = {
  PENDING: { label: "Pending", tone: "warning" },
  COMPLETED: { label: "Completed", tone: "success" },
  FAILED: { label: "Failed", tone: "danger" },
  REFUNDED: { label: "Refunded", tone: "muted" },
};

export const EVENT_TYPES = ["MEETING", "DEADLINE", "MILESTONE", "OTHER"] as const satisfies EventType[];
export const EVENT_TYPE_META: Record<EventType, Meta> = {
  MEETING: { label: "Meeting", tone: "brand" },
  DEADLINE: { label: "Deadline", tone: "danger" },
  MILESTONE: { label: "Milestone", tone: "success" },
  OTHER: { label: "Other", tone: "neutral" },
};

export const ROLE_META: Record<WorkspaceRole, Meta & { description: string }> = {
  OWNER: { label: "Owner", tone: "brand", description: "Full access, including workspace settings and ownership." },
  ADMIN: { label: "Admin", tone: "info", description: "Manages clients, projects, invoices and the team." },
  MEMBER: { label: "Member", tone: "neutral", description: "Works on the projects they're assigned to." },
  CLIENT: { label: "Client", tone: "warning", description: "Uses the client portal for their own projects." },
};

export const LABEL_COLORS = ["slate", "blue", "green", "amber", "red", "violet", "teal", "pink"] as const;
export type LabelColor = (typeof LABEL_COLORS)[number];

export const PAGE_SIZE = 20;

export const TIMEZONES = [
  "Africa/Nairobi",
  "Africa/Kampala",
  "Africa/Dar_es_Salaam",
  "Africa/Kigali",
  "Africa/Lagos",
  "Africa/Johannesburg",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Dubai",
  "UTC",
];
