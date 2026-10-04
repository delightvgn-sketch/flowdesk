import { fromCents, toCents } from "./money";

export type LineItemInput = { quantity: number; unitPrice: number };

export type InvoiceTotalsInput = {
  items: LineItemInput[];
  discountType: "PERCENT" | "FIXED";
  discountValue: number;
  /** Percentage, e.g. 16 for 16% VAT. */
  taxRate: number;
};

export type InvoiceTotals = {
  lineAmounts: number[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
};

/**
 * Single source of truth for invoice arithmetic. Used by the editor for live
 * previews and — authoritatively — by the server when persisting, so totals
 * sent from the browser are never trusted.
 *
 * Order: subtotal → discount (capped at subtotal) → tax on the discounted base.
 */
export function calculateInvoiceTotals(input: InvoiceTotalsInput): InvoiceTotals {
  const lineCents = input.items.map((item) => Math.round(item.quantity * toCents(item.unitPrice)));
  const subtotalCents = lineCents.reduce((sum, c) => sum + c, 0);

  const rawDiscount =
    input.discountType === "PERCENT"
      ? Math.round((subtotalCents * clamp(input.discountValue, 0, 100)) / 100)
      : toCents(Math.max(0, input.discountValue));
  const discountCents = Math.min(rawDiscount, subtotalCents);

  const taxableCents = subtotalCents - discountCents;
  const taxCents = Math.round((taxableCents * clamp(input.taxRate, 0, 100)) / 100);

  return {
    lineAmounts: lineCents.map(fromCents),
    subtotal: fromCents(subtotalCents),
    discountTotal: fromCents(discountCents),
    taxTotal: fromCents(taxCents),
    total: fromCents(taxableCents + taxCents),
  };
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number.isFinite(n) ? n : 0));
}

/** Invoice number from the workspace prefix and sequence: INV-0042 */
export function formatInvoiceNumber(prefix: string, sequence: number): string {
  return `${prefix}-${String(sequence).padStart(4, "0")}`;
}

export type PaymentLike = { amount: number; status: string };

/** Sum of completed payments. Pending/failed/refunded payments don't count. */
export function sumCompletedPayments(payments: PaymentLike[]): number {
  return fromCents(payments.filter((p) => p.status === "COMPLETED").reduce((s, p) => s + toCents(p.amount), 0));
}

/**
 * Derive the status an invoice should have after its payments or due date change.
 * DRAFT and CANCELLED are explicit user choices and are never changed here.
 */
export function deriveInvoiceStatus(args: {
  current: "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "CANCELLED";
  total: number;
  amountPaid: number;
  dueDate: string;
  today: string;
}): "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "CANCELLED" {
  const { current, total, amountPaid, dueDate, today } = args;
  if (current === "DRAFT" || current === "CANCELLED") return current;
  if (total > 0 && toCents(amountPaid) >= toCents(total)) return "PAID";
  return dueDate < today ? "OVERDUE" : "SENT";
}
