import { describe, expect, it } from "vitest";

import { clientSchema, eventSchema, fileUploadSchema, invoiceSchema, inviteSchema, projectSchema } from "@/lib/validation";

const uuid = "8b1d5a8e-4a6f-4c55-9d43-2f0f6a3c9e11";

describe("clientSchema", () => {
  it("normalises optional fields, websites and tags", () => {
    const parsed = clientSchema.parse({
      name: "  Grace Achieng ",
      company: "",
      email: "Grace@Northstar.co.ke",
      website: "northstar.co.ke",
      status: "ACTIVE",
      tags: ["Retainer", "retainer", "E-commerce"],
    });
    expect(parsed.name).toBe("Grace Achieng");
    expect(parsed.company).toBeNull();
    expect(parsed.email).toBe("grace@northstar.co.ke");
    expect(parsed.website).toBe("https://northstar.co.ke");
    expect(parsed.tags).toEqual(["retainer", "e-commerce"]);
  });

  it("requires a name and a valid email", () => {
    const result = clientSchema.safeParse({ name: "", email: "nope", status: "LEAD" });
    expect(result.success).toBe(false);
    const fields = result.error!.issues.map((i) => i.path[0]);
    expect(fields).toContain("name");
    expect(fields).toContain("email");
  });
});

describe("projectSchema", () => {
  it("rejects a due date before the start date", () => {
    const result = projectSchema.safeParse({
      name: "Brand Website",
      status: "PLANNING",
      priority: "MEDIUM",
      startDate: "2026-10-10",
      dueDate: "2026-10-01",
    });
    expect(result.success).toBe(false);
    expect(result.error!.issues[0].path).toEqual(["dueDate"]);
  });

  it("coerces budget strings", () => {
    const parsed = projectSchema.parse({ name: "X", status: "PLANNING", priority: "LOW", budget: "85000" });
    expect(parsed.budget).toBe(85000);
  });
});

describe("invoiceSchema", () => {
  const valid = {
    clientId: uuid,
    issueDate: "2026-10-01",
    dueDate: "2026-10-15",
    discountType: "PERCENT" as const,
    discountValue: 0,
    taxRate: 16,
    items: [{ description: "Design sprint", quantity: 1, unitPrice: 120000 }],
  };

  it("accepts a valid invoice and ignores any client-sent totals", () => {
    const parsed = invoiceSchema.parse({ ...valid, total: 1, subtotal: 1 });
    expect(parsed).not.toHaveProperty("total");
    expect(parsed).not.toHaveProperty("subtotal");
  });

  it("requires at least one item, positive quantities and sane discounts", () => {
    expect(invoiceSchema.safeParse({ ...valid, items: [] }).success).toBe(false);
    expect(invoiceSchema.safeParse({ ...valid, items: [{ description: "x", quantity: 0, unitPrice: 1 }] }).success).toBe(false);
    expect(invoiceSchema.safeParse({ ...valid, discountValue: 120 }).success).toBe(false);
    expect(invoiceSchema.safeParse({ ...valid, discountType: "FIXED", discountValue: 120 }).success).toBe(true);
    expect(invoiceSchema.safeParse({ ...valid, dueDate: "2026-09-01" }).success).toBe(false);
  });
});

describe("fileUploadSchema", () => {
  it("allows common document types under 25 MB", () => {
    expect(fileUploadSchema.safeParse({ name: "brief.pdf", mimeType: "application/pdf", sizeBytes: 1024 }).success).toBe(true);
  });

  it("rejects executables, oversized files and path tricks", () => {
    expect(fileUploadSchema.safeParse({ name: "x.exe", mimeType: "application/x-msdownload", sizeBytes: 10 }).success).toBe(false);
    expect(fileUploadSchema.safeParse({ name: "big.pdf", mimeType: "application/pdf", sizeBytes: 26 * 1024 * 1024 }).success).toBe(false);
    expect(fileUploadSchema.safeParse({ name: "../etc/passwd", mimeType: "text/plain", sizeBytes: 10 }).success).toBe(false);
  });
});

describe("inviteSchema", () => {
  it("requires a client for CLIENT invitations and never allows OWNER", () => {
    expect(inviteSchema.safeParse({ email: "a@b.co", role: "CLIENT" }).success).toBe(false);
    expect(inviteSchema.safeParse({ email: "a@b.co", role: "CLIENT", clientId: uuid }).success).toBe(true);
    expect(inviteSchema.safeParse({ email: "a@b.co", role: "OWNER" }).success).toBe(false);
  });
});

describe("eventSchema", () => {
  it("requires a start time unless all-day, and end after start", () => {
    const base = { title: "Sync", type: "MEETING" as const, date: "2026-10-05" };
    expect(eventSchema.safeParse({ ...base, allDay: false }).success).toBe(false);
    expect(eventSchema.safeParse({ ...base, allDay: true }).success).toBe(true);
    expect(eventSchema.safeParse({ ...base, startTime: "10:00", endTime: "09:00" }).success).toBe(false);
    expect(eventSchema.safeParse({ ...base, startTime: "10:00", endTime: "10:45" }).success).toBe(true);
  });
});
