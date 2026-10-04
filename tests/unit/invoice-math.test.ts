import { describe, expect, it } from "vitest";

import {
  calculateInvoiceTotals,
  deriveInvoiceStatus,
  formatInvoiceNumber,
  sumCompletedPayments,
} from "@/lib/invoice-math";

describe("calculateInvoiceTotals", () => {
  it("sums line items and applies VAT on the subtotal", () => {
    const totals = calculateInvoiceTotals({
      items: [
        { quantity: 2, unitPrice: 45000 },
        { quantity: 1, unitPrice: 10000 },
      ],
      discountType: "PERCENT",
      discountValue: 0,
      taxRate: 16,
    });
    expect(totals.lineAmounts).toEqual([90000, 10000]);
    expect(totals.subtotal).toBe(100000);
    expect(totals.discountTotal).toBe(0);
    expect(totals.taxTotal).toBe(16000);
    expect(totals.total).toBe(116000);
  });

  it("applies a percentage discount before tax", () => {
    const totals = calculateInvoiceTotals({
      items: [{ quantity: 1, unitPrice: 248000 }],
      discountType: "PERCENT",
      discountValue: 5,
      taxRate: 16,
    });
    expect(totals.discountTotal).toBe(12400);
    expect(totals.taxTotal).toBe(37696); // 16% of 235,600
    expect(totals.total).toBe(273296);
  });

  it("applies a fixed discount and caps it at the subtotal", () => {
    const fixed = calculateInvoiceTotals({
      items: [{ quantity: 1, unitPrice: 1000 }],
      discountType: "FIXED",
      discountValue: 250,
      taxRate: 0,
    });
    expect(fixed.total).toBe(750);

    const capped = calculateInvoiceTotals({
      items: [{ quantity: 1, unitPrice: 1000 }],
      discountType: "FIXED",
      discountValue: 5000,
      taxRate: 16,
    });
    expect(capped.discountTotal).toBe(1000);
    expect(capped.total).toBe(0);
  });

  it("avoids floating point drift with fractional quantities and prices", () => {
    const totals = calculateInvoiceTotals({
      items: [
        { quantity: 3, unitPrice: 0.1 },
        { quantity: 1.5, unitPrice: 19.99 },
      ],
      discountType: "PERCENT",
      discountValue: 0,
      taxRate: 16,
    });
    expect(totals.lineAmounts).toEqual([0.3, 29.99]); // 29.985 rounds half-up to 29.99
    expect(totals.subtotal).toBe(30.29);
    expect(totals.taxTotal).toBe(4.85);
    expect(totals.total).toBe(35.14);
  });

  it("clamps out-of-range rates instead of producing nonsense", () => {
    const totals = calculateInvoiceTotals({
      items: [{ quantity: 1, unitPrice: 100 }],
      discountType: "PERCENT",
      discountValue: 150,
      taxRate: -10,
    });
    expect(totals.discountTotal).toBe(100);
    expect(totals.taxTotal).toBe(0);
    expect(totals.total).toBe(0);
  });

  it("returns zeros for an empty invoice", () => {
    const totals = calculateInvoiceTotals({ items: [], discountType: "PERCENT", discountValue: 10, taxRate: 16 });
    expect(totals).toEqual({ lineAmounts: [], subtotal: 0, discountTotal: 0, taxTotal: 0, total: 0 });
  });
});

describe("formatInvoiceNumber", () => {
  it("pads the sequence", () => {
    expect(formatInvoiceNumber("INV", 7)).toBe("INV-0007");
    expect(formatInvoiceNumber("MWS", 12345)).toBe("MWS-12345");
  });
});

describe("sumCompletedPayments", () => {
  it("only counts completed payments", () => {
    expect(
      sumCompletedPayments([
        { amount: 1000.1, status: "COMPLETED" },
        { amount: 2000.2, status: "COMPLETED" },
        { amount: 500, status: "PENDING" },
        { amount: 700, status: "FAILED" },
        { amount: 900, status: "REFUNDED" },
      ]),
    ).toBe(3000.3);
  });
});

describe("deriveInvoiceStatus", () => {
  const base = { total: 1000, amountPaid: 0, dueDate: "2026-10-10", today: "2026-10-04" } as const;

  it("marks fully paid invoices as PAID", () => {
    expect(deriveInvoiceStatus({ ...base, current: "SENT", amountPaid: 1000 })).toBe("PAID");
    expect(deriveInvoiceStatus({ ...base, current: "OVERDUE", amountPaid: 1200 })).toBe("PAID");
  });

  it("marks unpaid invoices past their due date as OVERDUE", () => {
    expect(deriveInvoiceStatus({ ...base, current: "SENT", dueDate: "2026-10-03" })).toBe("OVERDUE");
  });

  it("is not overdue on the due date itself", () => {
    expect(deriveInvoiceStatus({ ...base, current: "SENT", dueDate: "2026-10-04" })).toBe("SENT");
  });

  it("reverts to SENT/OVERDUE when a payment is removed", () => {
    expect(deriveInvoiceStatus({ ...base, current: "PAID", amountPaid: 400 })).toBe("SENT");
  });

  it("never changes DRAFT or CANCELLED invoices", () => {
    expect(deriveInvoiceStatus({ ...base, current: "DRAFT", amountPaid: 1000 })).toBe("DRAFT");
    expect(deriveInvoiceStatus({ ...base, current: "CANCELLED", dueDate: "2020-01-01" })).toBe("CANCELLED");
  });
});
