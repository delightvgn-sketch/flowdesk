import { describe, expect, it } from "vitest";

import { addDaysISO, daysUntil, dueLabel } from "@/lib/dates";
import { formatMoney, fromCents, toCents } from "@/lib/money";
import { assertCan, assignableRoles, can, canManageMember, ForbiddenError } from "@/lib/permissions";

describe("formatMoney", () => {
  it("formats Kenyan shillings by default", () => {
    expect(formatMoney(85000)).toBe("KSh 85,000");
    expect(formatMoney(1234.5)).toBe("KSh 1,234.50");
    expect(formatMoney(0)).toBe("KSh 0");
    expect(formatMoney(null)).toBe("KSh 0");
  });

  it("supports forced decimals, negatives, compact and other currencies", () => {
    expect(formatMoney(85000, { decimals: true })).toBe("KSh 85,000.00");
    expect(formatMoney(-2500)).toBe("-KSh 2,500");
    expect(formatMoney(1_250_000, { compact: true })).toBe("KSh 1.3M");
    expect(formatMoney(99.99, { currency: "USD" })).toBe("$ 99.99");
  });

  it("round-trips cents", () => {
    expect(toCents(19.99)).toBe(1999);
    expect(fromCents(1999)).toBe(19.99);
    expect(toCents(0.1 + 0.2)).toBe(30);
  });
});

describe("dates", () => {
  it("adds days across month boundaries", () => {
    expect(addDaysISO("2026-10-30", 3)).toBe("2026-11-02");
    expect(addDaysISO("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("computes due labels relative to today", () => {
    expect(daysUntil("2026-10-10", "2026-10-04")).toBe(6);
    expect(dueLabel("2026-10-01", "2026-10-04")).toEqual({ text: "3d overdue", overdue: true });
    expect(dueLabel("2026-10-04", "2026-10-04").text).toBe("Due today");
    expect(dueLabel("2026-10-05", "2026-10-04").text).toBe("Due tomorrow");
    expect(dueLabel(null).text).toBe("No due date");
  });
});

describe("permissions", () => {
  it("lets owners and admins manage invoices but not members or clients", () => {
    expect(can("OWNER", "invoice:manage")).toBe(true);
    expect(can("ADMIN", "invoice:manage")).toBe(true);
    expect(can("MEMBER", "invoice:manage")).toBe(false);
    expect(can("CLIENT", "invoice:manage")).toBe(false);
  });

  it("keeps clients out of internal features", () => {
    for (const p of ["client:view", "project:view", "task:create", "analytics:view", "ai:use", "message:internal"] as const) {
      expect(can("CLIENT", p)).toBe(false);
    }
    expect(can("CLIENT", "milestone:approve")).toBe(true);
    expect(can("OWNER", "milestone:approve")).toBe(false);
  });

  it("reserves ownership transfer and workspace deletion for the owner", () => {
    expect(can("OWNER", "team:transfer-ownership")).toBe(true);
    expect(can("ADMIN", "team:transfer-ownership")).toBe(false);
    expect(can("ADMIN", "workspace:delete")).toBe(false);
  });

  it("throws ForbiddenError from assertCan and treats a missing role as no access", () => {
    expect(() => assertCan("MEMBER", "team:manage")).toThrow(ForbiddenError);
    expect(() => assertCan("OWNER", "team:manage")).not.toThrow();
    expect(can(null, "task:view")).toBe(false);
  });

  it("never lets anyone assign or manage the OWNER role through the team page", () => {
    expect(assignableRoles("OWNER")).not.toContain("OWNER");
    expect(assignableRoles("ADMIN")).not.toContain("OWNER");
    expect(assignableRoles("MEMBER")).toEqual([]);
    expect(canManageMember("ADMIN", "OWNER")).toBe(false);
    expect(canManageMember("ADMIN", "MEMBER")).toBe(true);
    expect(canManageMember("MEMBER", "MEMBER")).toBe(false);
  });
});

describe("zonedTimeToUtc", () => {
  it("converts Nairobi wall-clock time (UTC+3) to UTC", async () => {
    const { zonedTimeToUtc } = await import("@/lib/dates");
    expect(zonedTimeToUtc("2026-10-05", "10:00", "Africa/Nairobi").toISOString()).toBe("2026-10-05T07:00:00.000Z");
    expect(zonedTimeToUtc("2026-10-05", "01:30", "Africa/Nairobi").toISOString()).toBe("2026-10-04T22:30:00.000Z");
  });

  it("handles DST zones", async () => {
    const { zonedTimeToUtc } = await import("@/lib/dates");
    expect(zonedTimeToUtc("2026-07-01", "09:00", "Europe/London").toISOString()).toBe("2026-07-01T08:00:00.000Z");
    expect(zonedTimeToUtc("2026-12-01", "09:00", "Europe/London").toISOString()).toBe("2026-12-01T09:00:00.000Z");
  });
});
