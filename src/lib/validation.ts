import { z } from "zod";

import {
  CLIENT_STATUSES,
  EVENT_TYPES,
  INVOICE_STATUSES,
  LABEL_COLORS,
  MILESTONE_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  PRIORITIES,
  PROJECT_STATUSES,
  TASK_STATUSES,
} from "./constants";

/**
 * Validation schemas shared by client forms (react-hook-form + zodResolver)
 * and server actions. The server always re-validates — the browser copy only
 * exists to give instant feedback.
 */

const trimmed = (max = 200) => z.string().trim().max(max, `Must be ${max} characters or fewer`);
const optionalText = (max = 200) =>
  trimmed(max)
    .nullish()
    .transform((v) => (v ? v : null));
const required = (label: string, max = 200) => trimmed(max).min(1, `${label} is required`);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date");
const optionalDate = z
  .union([isoDate, z.literal(""), z.null()])
  .optional()
  .transform((v) => (v ? v : null));
const optionalUuid = z
  .union([z.uuid(), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v ? v : null));

const optionalEmail = z
  .union([z.email("Enter a valid email address").trim().max(200), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v ? v.toLowerCase() : null));

const optionalUrl = z
  .union([z.string().trim().max(300), z.literal(""), z.null()])
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    const withProtocol = /^https?:\/\//i.test(v) ? v : `https://${v}`;
    try {
      new URL(withProtocol);
      return withProtocol;
    } catch {
      ctx.addIssue({ code: "custom", message: "Enter a valid website" });
      return z.NEVER;
    }
  });

export const idSchema = z.object({ id: z.uuid() });

/* ---------------------------------- Clients --------------------------------- */

export const clientSchema = z.object({
  name: required("Contact name", 120),
  company: optionalText(120),
  email: optionalEmail,
  phone: optionalText(40),
  website: optionalUrl,
  address: optionalText(300),
  notes: optionalText(5000),
  status: z.enum(CLIENT_STATUSES),
  tags: z
    .array(trimmed(30).min(1))
    .max(10, "Use at most 10 tags")
    .default([])
    .transform((tags) => [...new Set(tags.map((t) => t.toLowerCase()))]),
});
export type ClientInput = z.input<typeof clientSchema>;

export const clientContactSchema = z.object({
  clientId: z.uuid(),
  name: required("Name", 120),
  email: optionalEmail,
  phone: optionalText(40),
  jobTitle: optionalText(80),
});

/* --------------------------------- Projects --------------------------------- */

export const projectSchema = z
  .object({
    name: required("Project name", 120),
    description: optionalText(5000),
    clientId: optionalUuid,
    status: z.enum(PROJECT_STATUSES),
    priority: z.enum(PRIORITIES),
    startDate: optionalDate,
    dueDate: optionalDate,
    budget: z.coerce
      .number<number>({ error: "Enter a number" })
      .min(0, "Budget can't be negative")
      .max(1_000_000_000)
      .nullable()
      .optional()
      .transform((v) => v ?? null),
    memberIds: z.array(z.uuid()).max(50).default([]),
  })
  .refine((v) => !v.startDate || !v.dueDate || v.startDate <= v.dueDate, {
    message: "Due date must be after the start date",
    path: ["dueDate"],
  });
export type ProjectInput = z.input<typeof projectSchema>;

export const milestoneSchema = z.object({
  projectId: z.uuid(),
  title: required("Title", 120),
  description: optionalText(1000),
  dueDate: optionalDate,
  status: z.enum(MILESTONE_STATUSES).default("UPCOMING"),
  requiresApproval: z.boolean().default(false),
});

/* ----------------------------------- Tasks ---------------------------------- */

export const taskSchema = z.object({
  title: required("Title", 200),
  description: optionalText(10000),
  projectId: optionalUuid,
  status: z.enum(TASK_STATUSES).default("TODO"),
  priority: z.enum(PRIORITIES).default("MEDIUM"),
  assigneeId: optionalUuid,
  dueDate: optionalDate,
  labelIds: z.array(z.uuid()).max(10).default([]),
});
export type TaskInput = z.input<typeof taskSchema>;

export const taskMoveSchema = z.object({
  id: z.uuid(),
  status: z.enum(TASK_STATUSES),
  /** Neighbour ids in the destination column, for fractional positioning. */
  beforeId: z.uuid().nullable().optional(),
  afterId: z.uuid().nullable().optional(),
});

export const commentSchema = z.object({
  taskId: z.uuid(),
  body: required("Comment", 5000),
});

export const labelSchema = z.object({
  name: required("Label name", 30),
  color: z.enum(LABEL_COLORS),
});

/* --------------------------------- Invoices --------------------------------- */

export const invoiceItemSchema = z.object({
  description: required("Description", 300),
  quantity: z.coerce.number<number>({ error: "Enter a quantity" }).positive("Must be more than 0").max(100000),
  unitPrice: z.coerce.number<number>({ error: "Enter a price" }).min(0, "Can't be negative").max(100_000_000),
});

export const invoiceSchema = z
  .object({
    clientId: z.uuid({ error: "Choose a client" }),
    projectId: optionalUuid,
    issueDate: isoDate,
    dueDate: isoDate,
    notes: optionalText(2000),
    discountType: z.enum(["PERCENT", "FIXED"]),
    discountValue: z.coerce.number<number>().min(0, "Can't be negative").max(100_000_000).default(0),
    taxRate: z.coerce.number<number>().min(0, "Can't be negative").max(100, "Max 100%").default(0),
    items: z.array(invoiceItemSchema).min(1, "Add at least one line item").max(100),
  })
  .refine((v) => v.dueDate >= v.issueDate, { message: "Due date can't be before the issue date", path: ["dueDate"] })
  .refine((v) => v.discountType !== "PERCENT" || v.discountValue <= 100, {
    message: "Percentage discount can't exceed 100%",
    path: ["discountValue"],
  });
export type InvoiceInput = z.input<typeof invoiceSchema>;

export const invoiceStatusSchema = z.object({
  id: z.uuid(),
  status: z.enum(INVOICE_STATUSES),
});

export const paymentSchema = z.object({
  invoiceId: z.uuid({ error: "Choose an invoice" }),
  amount: z.coerce.number<number>({ error: "Enter an amount" }).positive("Must be more than 0").max(1_000_000_000),
  method: z.enum(PAYMENT_METHODS),
  status: z.enum(PAYMENT_STATUSES).default("COMPLETED"),
  paidOn: isoDate,
  reference: optionalText(80),
  notes: optionalText(500),
});
export type PaymentInput = z.input<typeof paymentSchema>;

/* ------------------------------ Collaboration ------------------------------- */

export const messageSchema = z
  .object({
    body: required("Message", 5000),
    projectId: optionalUuid,
    clientId: optionalUuid,
    internal: z.boolean().default(false),
  })
  .refine((v) => !(v.projectId && v.clientId), { message: "Pick one conversation", path: ["projectId"] });

export const eventSchema = z
  .object({
    title: required("Title", 120),
    description: optionalText(2000),
    type: z.enum(EVENT_TYPES),
    date: isoDate,
    startTime: z.union([z.string().regex(/^\d{2}:\d{2}$/), z.literal("")]).optional(),
    endTime: z.union([z.string().regex(/^\d{2}:\d{2}$/), z.literal("")]).optional(),
    allDay: z.boolean().default(false),
    location: optionalText(200),
    projectId: optionalUuid,
    clientId: optionalUuid,
  })
  .refine((v) => v.allDay || !!v.startTime, { message: "Pick a start time", path: ["startTime"] })
  .refine((v) => v.allDay || !v.endTime || !v.startTime || v.endTime > v.startTime, {
    message: "End must be after start",
    path: ["endTime"],
  });
export type EventInput = z.input<typeof eventSchema>;

/* -------------------------------- Workspace --------------------------------- */

export const workspaceSchema = z.object({
  name: required("Workspace name", 80),
  email: optionalEmail,
  phone: optionalText(40),
  address: optionalText(300),
  currency: z.string().length(3),
  timezone: z.string().min(1).max(60),
  invoicePrefix: z
    .string()
    .trim()
    .regex(/^[A-Z0-9]{2,6}$/, "2–6 uppercase letters or digits"),
  defaultTaxRate: z.coerce.number<number>().min(0).max(100),
});

export const onboardingSchema = z.object({
  workspaceName: required("Workspace name", 80),
  fullName: required("Your name", 80),
});

export const profileSchema = z.object({
  fullName: required("Name", 80),
});

export const notificationPrefsSchema = z.object({
  taskAssigned: z.boolean(),
  comments: z.boolean(),
  invoices: z.boolean(),
  files: z.boolean(),
  messages: z.boolean(),
  deadlines: z.boolean(),
});

export const inviteSchema = z
  .object({
    email: z.email("Enter a valid email address").trim().toLowerCase(),
    role: z.enum(["ADMIN", "MEMBER", "CLIENT"]),
    clientId: optionalUuid,
  })
  .refine((v) => v.role !== "CLIENT" || !!v.clientId, { message: "Choose the client this person represents", path: ["clientId"] });

export const memberRoleSchema = z.object({
  memberId: z.uuid(),
  role: z.enum(["ADMIN", "MEMBER"]),
});

/* ---------------------------------- Files ----------------------------------- */

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export const ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "application/pdf",
  "text/plain",
  "text/csv",
  "text/markdown",
  "application/zip",
  "application/x-zip-compressed",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/json",
  "video/mp4",
  "audio/mpeg",
] as const;

export const fileUploadSchema = z.object({
  name: required("File name", 200).refine((n) => !/[\\/]/.test(n), "File name can't contain slashes"),
  mimeType: z.enum(ALLOWED_MIME_TYPES, { error: "This file type isn't supported" }),
  sizeBytes: z
    .number()
    .int()
    .positive("File is empty")
    .max(MAX_UPLOAD_BYTES, "Files must be 25 MB or smaller"),
  folderId: optionalUuid,
  clientId: optionalUuid,
  projectId: optionalUuid,
  taskId: optionalUuid,
  sharedWithClient: z.boolean().default(false),
});

export const folderSchema = z.object({
  name: required("Folder name", 80),
  parentId: optionalUuid,
});
