import { relations, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* -------------------------------------------------------------------------- */
/*                                   Enums                                    */
/* -------------------------------------------------------------------------- */

export const workspaceRole = pgEnum("workspace_role", ["OWNER", "ADMIN", "MEMBER", "CLIENT"]);
export const clientStatus = pgEnum("client_status", ["LEAD", "ACTIVE", "INACTIVE", "ARCHIVED"]);
export const projectStatus = pgEnum("project_status", ["PLANNING", "IN_PROGRESS", "REVIEW", "COMPLETED", "ON_HOLD", "CANCELLED"]);
export const priority = pgEnum("priority", ["LOW", "MEDIUM", "HIGH", "URGENT"]);
export const taskStatus = pgEnum("task_status", ["TODO", "IN_PROGRESS", "REVIEW", "DONE"]);
export const milestoneStatus = pgEnum("milestone_status", ["UPCOMING", "CURRENT", "COMPLETED"]);
export const approvalStatus = pgEnum("approval_status", ["NOT_REQUIRED", "PENDING", "APPROVED", "CHANGES_REQUESTED"]);
export const invoiceStatus = pgEnum("invoice_status", ["DRAFT", "SENT", "PAID", "OVERDUE", "CANCELLED"]);
export const discountType = pgEnum("discount_type", ["PERCENT", "FIXED"]);
export const paymentMethod = pgEnum("payment_method", ["MPESA", "BANK", "CARD", "CASH", "OTHER"]);
export const paymentStatus = pgEnum("payment_status", ["PENDING", "COMPLETED", "FAILED", "REFUNDED"]);
export const eventType = pgEnum("event_type", ["MEETING", "DEADLINE", "MILESTONE", "OTHER"]);
export const aiRole = pgEnum("ai_role", ["user", "assistant"]);

/* -------------------------------------------------------------------------- */
/*                                  Helpers                                   */
/* -------------------------------------------------------------------------- */

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
const money = (name: string) => numeric(name, { precision: 14, scale: 2, mode: "number" });
const workspaceRef = () =>
  uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" });

/* -------------------------------------------------------------------------- */
/*                           Identity & workspaces                            */
/* -------------------------------------------------------------------------- */

export type NotificationPrefs = {
  taskAssigned: boolean;
  comments: boolean;
  invoices: boolean;
  files: boolean;
  messages: boolean;
  deadlines: boolean;
};

/**
 * Application profile. Authentication lives in Clerk; this row only stores what
 * FlowDesk needs (display info + preferences) and is linked by `clerk_user_id`.
 * Seeded/invited profiles can exist before a Clerk user does and are claimed by
 * verified email on first sign-in.
 */
export const profiles = pgTable(
  "profiles",
  {
    id: id(),
    clerkUserId: text("clerk_user_id").unique(),
    email: text("email").notNull(),
    fullName: text("full_name").notNull(),
    avatarUrl: text("avatar_url"),
    notificationPrefs: jsonb("notification_prefs").$type<NotificationPrefs>(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("profiles_email_lower_idx").on(sql`lower(${t.email})`)],
);

export const workspaces = pgTable("workspaces", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logoUrl: text("logo_url"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  currency: text("currency").notNull().default("KES"),
  timezone: text("timezone").notNull().default("Africa/Nairobi"),
  invoicePrefix: text("invoice_prefix").notNull().default("INV"),
  nextInvoiceNumber: integer("next_invoice_number").notNull().default(1),
  defaultTaxRate: numeric("default_tax_rate", { precision: 5, scale: 2, mode: "number" }).notNull().default(16),
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    id: id(),
    workspaceId: workspaceRef(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    role: workspaceRole("role").notNull().default("MEMBER"),
    /** Set only for CLIENT members: the CRM client they represent. */
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }),
    title: text("title"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("workspace_members_ws_profile_idx").on(t.workspaceId, t.profileId),
    index("workspace_members_profile_idx").on(t.profileId),
    check("client_role_has_client", sql`(${t.role} = 'CLIENT') = (${t.clientId} IS NOT NULL)`),
  ],
);

export const workspaceInvitations = pgTable(
  "workspace_invitations",
  {
    id: id(),
    workspaceId: workspaceRef(),
    email: text("email").notNull(),
    role: workspaceRole("role").notNull(),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    invitedById: uuid("invited_by_id").references(() => profiles.id, { onDelete: "set null" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("workspace_invitations_ws_idx").on(t.workspaceId)],
);

/* -------------------------------------------------------------------------- */
/*                                    CRM                                     */
/* -------------------------------------------------------------------------- */

export const clients = pgTable(
  "clients",
  {
    id: id(),
    workspaceId: workspaceRef(),
    /** Primary contact person. */
    name: text("name").notNull(),
    company: text("company"),
    email: text("email"),
    phone: text("phone"),
    website: text("website"),
    address: text("address"),
    notes: text("notes"),
    status: clientStatus("status").notNull().default("LEAD"),
    tags: text("tags")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    createdById: uuid("created_by_id").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("clients_ws_status_idx").on(t.workspaceId, t.status),
    index("clients_ws_created_idx").on(t.workspaceId, t.createdAt),
  ],
);

export const clientContacts = pgTable(
  "client_contacts",
  {
    id: id(),
    workspaceId: workspaceRef(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    jobTitle: text("job_title"),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("client_contacts_client_idx").on(t.clientId)],
);

/* -------------------------------------------------------------------------- */
/*                             Projects & tasks                               */
/* -------------------------------------------------------------------------- */

export const projects = pgTable(
  "projects",
  {
    id: id(),
    workspaceId: workspaceRef(),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    description: text("description"),
    status: projectStatus("status").notNull().default("PLANNING"),
    priority: priority("priority").notNull().default("MEDIUM"),
    startDate: date("start_date"),
    dueDate: date("due_date"),
    budget: money("budget"),
    /** 0–100. Recomputed from tasks whenever tasks change. */
    progress: integer("progress").notNull().default(0),
    createdById: uuid("created_by_id").references(() => profiles.id, { onDelete: "set null" }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("projects_ws_status_idx").on(t.workspaceId, t.status),
    index("projects_client_idx").on(t.clientId),
    check("progress_range", sql`${t.progress} BETWEEN 0 AND 100`),
  ],
);

export const projectMembers = pgTable(
  "project_members",
  {
    workspaceId: workspaceRef(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.profileId] }), index("project_members_profile_idx").on(t.profileId)],
);

export const milestones = pgTable(
  "milestones",
  {
    id: id(),
    workspaceId: workspaceRef(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    dueDate: date("due_date"),
    status: milestoneStatus("status").notNull().default("UPCOMING"),
    position: integer("position").notNull().default(0),
    approvalStatus: approvalStatus("approval_status").notNull().default("NOT_REQUIRED"),
    approvalNote: text("approval_note"),
    approvedById: uuid("approved_by_id").references(() => profiles.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("milestones_project_idx").on(t.projectId, t.position)],
);

export const labels = pgTable(
  "labels",
  {
    id: id(),
    workspaceId: workspaceRef(),
    name: text("name").notNull(),
    color: text("color").notNull().default("slate"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("labels_ws_name_idx").on(t.workspaceId, sql`lower(${t.name})`)],
);

export const tasks = pgTable(
  "tasks",
  {
    id: id(),
    workspaceId: workspaceRef(),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    status: taskStatus("status").notNull().default("TODO"),
    priority: priority("priority").notNull().default("MEDIUM"),
    assigneeId: uuid("assignee_id").references(() => profiles.id, { onDelete: "set null" }),
    dueDate: date("due_date"),
    /** Fractional ordering within a Kanban column. */
    position: doublePrecision("position").notNull().default(0),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdById: uuid("created_by_id").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("tasks_ws_status_idx").on(t.workspaceId, t.status, t.position),
    index("tasks_project_idx").on(t.projectId),
    index("tasks_assignee_idx").on(t.assigneeId),
    index("tasks_due_idx").on(t.workspaceId, t.dueDate),
  ],
);

export const taskLabels = pgTable(
  "task_labels",
  {
    workspaceId: workspaceRef(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    labelId: uuid("label_id")
      .notNull()
      .references(() => labels.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.taskId, t.labelId] })],
);

export const taskComments = pgTable(
  "task_comments",
  {
    id: id(),
    workspaceId: workspaceRef(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").references(() => profiles.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("task_comments_task_idx").on(t.taskId, t.createdAt)],
);

/* -------------------------------------------------------------------------- */
/*                           Invoices & payments                              */
/* -------------------------------------------------------------------------- */

export const invoices = pgTable(
  "invoices",
  {
    id: id(),
    workspaceId: workspaceRef(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    number: text("number").notNull(),
    status: invoiceStatus("status").notNull().default("DRAFT"),
    issueDate: date("issue_date").notNull(),
    dueDate: date("due_date").notNull(),
    currency: text("currency").notNull().default("KES"),
    notes: text("notes"),
    discountType: discountType("discount_type").notNull().default("PERCENT"),
    discountValue: money("discount_value").notNull().default(0),
    taxRate: numeric("tax_rate", { precision: 5, scale: 2, mode: "number" }).notNull().default(0),
    // Derived amounts — always computed server-side from items.
    subtotal: money("subtotal").notNull().default(0),
    discountTotal: money("discount_total").notNull().default(0),
    taxTotal: money("tax_total").notNull().default(0),
    total: money("total").notNull().default(0),
    amountPaid: money("amount_paid").notNull().default(0),
    shareToken: text("share_token").unique(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdById: uuid("created_by_id").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("invoices_ws_number_idx").on(t.workspaceId, t.number),
    index("invoices_ws_status_idx").on(t.workspaceId, t.status),
    index("invoices_client_idx").on(t.clientId),
    index("invoices_ws_issue_idx").on(t.workspaceId, t.issueDate),
  ],
);

export const invoiceItems = pgTable(
  "invoice_items",
  {
    id: id(),
    workspaceId: workspaceRef(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    quantity: numeric("quantity", { precision: 10, scale: 2, mode: "number" }).notNull(),
    unitPrice: money("unit_price").notNull(),
    amount: money("amount").notNull(),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("invoice_items_invoice_idx").on(t.invoiceId, t.position)],
);

export const payments = pgTable(
  "payments",
  {
    id: id(),
    workspaceId: workspaceRef(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    amount: money("amount").notNull(),
    method: paymentMethod("method").notNull(),
    status: paymentStatus("status").notNull().default("COMPLETED"),
    paidOn: date("paid_on").notNull(),
    reference: text("reference"),
    notes: text("notes"),
    recordedById: uuid("recorded_by_id").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("payments_invoice_idx").on(t.invoiceId),
    index("payments_ws_paid_idx").on(t.workspaceId, t.paidOn),
    check("payment_amount_positive", sql`${t.amount} > 0`),
  ],
);

/* -------------------------------------------------------------------------- */
/*                                   Files                                    */
/* -------------------------------------------------------------------------- */

export const folders = pgTable(
  "folders",
  {
    id: id(),
    workspaceId: workspaceRef(),
    parentId: uuid("parent_id").references((): AnyPgColumn => folders.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdById: uuid("created_by_id").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("folders_ws_parent_idx").on(t.workspaceId, t.parentId)],
);

export const files = pgTable(
  "files",
  {
    id: id(),
    workspaceId: workspaceRef(),
    folderId: uuid("folder_id").references(() => folders.id, { onDelete: "set null" }),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    taskId: uuid("task_id").references(() => tasks.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    storagePath: text("storage_path").notNull().unique(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    /** Visible in the client portal when linked to that client or one of its projects. */
    sharedWithClient: boolean("shared_with_client").notNull().default(false),
    uploadedById: uuid("uploaded_by_id").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("files_ws_folder_idx").on(t.workspaceId, t.folderId),
    index("files_project_idx").on(t.projectId),
    index("files_client_idx").on(t.clientId),
    index("files_task_idx").on(t.taskId),
  ],
);

/* -------------------------------------------------------------------------- */
/*                               Collaboration                                */
/* -------------------------------------------------------------------------- */

export const messages = pgTable(
  "messages",
  {
    id: id(),
    workspaceId: workspaceRef(),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").references(() => profiles.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    /** Internal notes are never visible to client users. */
    internal: boolean("internal").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    index("messages_project_idx").on(t.projectId, t.createdAt),
    index("messages_client_idx").on(t.clientId, t.createdAt),
    index("messages_ws_idx").on(t.workspaceId, t.createdAt),
  ],
);

export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    workspaceId: workspaceRef(),
    recipientId: uuid("recipient_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => profiles.id, { onDelete: "set null" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    href: text("href"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_recipient_idx").on(t.recipientId, t.workspaceId, t.createdAt)],
);

export const activityLogs = pgTable(
  "activity_logs",
  {
    id: id(),
    workspaceId: workspaceRef(),
    actorId: uuid("actor_id").references(() => profiles.id, { onDelete: "set null" }),
    /** Dotted verb, e.g. `project.created`, `invoice.paid`. */
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),
    entityLabel: text("entity_label"),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    metadata: jsonb("metadata").$type<Record<string, string | number | boolean | null>>(),
    createdAt: createdAt(),
  },
  (t) => [
    index("activity_ws_created_idx").on(t.workspaceId, t.createdAt),
    index("activity_project_idx").on(t.projectId, t.createdAt),
    index("activity_client_idx").on(t.clientId, t.createdAt),
    index("activity_entity_idx").on(t.entityId),
  ],
);

export const calendarEvents = pgTable(
  "calendar_events",
  {
    id: id(),
    workspaceId: workspaceRef(),
    title: text("title").notNull(),
    description: text("description"),
    type: eventType("type").notNull().default("MEETING"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    allDay: boolean("all_day").notNull().default(false),
    location: text("location"),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    createdById: uuid("created_by_id").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("calendar_events_ws_start_idx").on(t.workspaceId, t.startsAt)],
);

/* -------------------------------------------------------------------------- */
/*                                     AI                                     */
/* -------------------------------------------------------------------------- */

export const aiConversations = pgTable(
  "ai_conversations",
  {
    id: id(),
    workspaceId: workspaceRef(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("New conversation"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("ai_conversations_owner_idx").on(t.profileId, t.workspaceId, t.updatedAt)],
);

export const aiMessages = pgTable(
  "ai_messages",
  {
    id: id(),
    workspaceId: workspaceRef(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => aiConversations.id, { onDelete: "cascade" }),
    role: aiRole("role").notNull(),
    content: text("content").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("ai_messages_conversation_idx").on(t.conversationId, t.createdAt)],
);

/* -------------------------------------------------------------------------- */
/*                                 Relations                                  */
/* -------------------------------------------------------------------------- */

export const workspaceMembersRelations = relations(workspaceMembers, ({ one }) => ({
  profile: one(profiles, { fields: [workspaceMembers.profileId], references: [profiles.id] }),
  workspace: one(workspaces, { fields: [workspaceMembers.workspaceId], references: [workspaces.id] }),
  client: one(clients, { fields: [workspaceMembers.clientId], references: [clients.id] }),
}));

export const clientsRelations = relations(clients, ({ many }) => ({
  projects: many(projects),
  invoices: many(invoices),
  contacts: many(clientContacts),
}));

export const clientContactsRelations = relations(clientContacts, ({ one }) => ({
  client: one(clients, { fields: [clientContacts.clientId], references: [clients.id] }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  client: one(clients, { fields: [projects.clientId], references: [clients.id] }),
  tasks: many(tasks),
  members: many(projectMembers),
  milestones: many(milestones),
}));

export const projectMembersRelations = relations(projectMembers, ({ one }) => ({
  project: one(projects, { fields: [projectMembers.projectId], references: [projects.id] }),
  profile: one(profiles, { fields: [projectMembers.profileId], references: [profiles.id] }),
}));

export const milestonesRelations = relations(milestones, ({ one }) => ({
  project: one(projects, { fields: [milestones.projectId], references: [projects.id] }),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, { fields: [tasks.projectId], references: [projects.id] }),
  assignee: one(profiles, { fields: [tasks.assigneeId], references: [profiles.id] }),
  labels: many(taskLabels),
  comments: many(taskComments),
}));

export const taskLabelsRelations = relations(taskLabels, ({ one }) => ({
  task: one(tasks, { fields: [taskLabels.taskId], references: [tasks.id] }),
  label: one(labels, { fields: [taskLabels.labelId], references: [labels.id] }),
}));

export const taskCommentsRelations = relations(taskComments, ({ one }) => ({
  task: one(tasks, { fields: [taskComments.taskId], references: [tasks.id] }),
  author: one(profiles, { fields: [taskComments.authorId], references: [profiles.id] }),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  client: one(clients, { fields: [invoices.clientId], references: [clients.id] }),
  project: one(projects, { fields: [invoices.projectId], references: [projects.id] }),
  items: many(invoiceItems),
  payments: many(payments),
}));

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(invoices, { fields: [invoiceItems.invoiceId], references: [invoices.id] }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  invoice: one(invoices, { fields: [payments.invoiceId], references: [invoices.id] }),
}));

export const filesRelations = relations(files, ({ one }) => ({
  uploadedBy: one(profiles, { fields: [files.uploadedById], references: [profiles.id] }),
  project: one(projects, { fields: [files.projectId], references: [projects.id] }),
  client: one(clients, { fields: [files.clientId], references: [clients.id] }),
  folder: one(folders, { fields: [files.folderId], references: [folders.id] }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  author: one(profiles, { fields: [messages.authorId], references: [profiles.id] }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  actor: one(profiles, { fields: [activityLogs.actorId], references: [profiles.id] }),
}));

export const aiConversationsRelations = relations(aiConversations, ({ many }) => ({
  messages: many(aiMessages),
}));

export const aiMessagesRelations = relations(aiMessages, ({ one }) => ({
  conversation: one(aiConversations, { fields: [aiMessages.conversationId], references: [aiConversations.id] }),
}));

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */

export type Profile = typeof profiles.$inferSelect;
export type Workspace = typeof workspaces.$inferSelect;
export type WorkspaceMember = typeof workspaceMembers.$inferSelect;
export type WorkspaceRole = (typeof workspaceRole.enumValues)[number];
export type Client = typeof clients.$inferSelect;
export type ClientStatus = (typeof clientStatus.enumValues)[number];
export type Project = typeof projects.$inferSelect;
export type ProjectStatus = (typeof projectStatus.enumValues)[number];
export type Priority = (typeof priority.enumValues)[number];
export type Task = typeof tasks.$inferSelect;
export type TaskStatus = (typeof taskStatus.enumValues)[number];
export type Milestone = typeof milestones.$inferSelect;
export type MilestoneStatus = (typeof milestoneStatus.enumValues)[number];
export type ApprovalStatus = (typeof approvalStatus.enumValues)[number];
export type Invoice = typeof invoices.$inferSelect;
export type InvoiceStatus = (typeof invoiceStatus.enumValues)[number];
export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type DiscountType = (typeof discountType.enumValues)[number];
export type Payment = typeof payments.$inferSelect;
export type PaymentMethod = (typeof paymentMethod.enumValues)[number];
export type PaymentStatus = (typeof paymentStatus.enumValues)[number];
export type FileRecord = typeof files.$inferSelect;
export type Folder = typeof folders.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type EventType = (typeof eventType.enumValues)[number];
export type Label = typeof labels.$inferSelect;
