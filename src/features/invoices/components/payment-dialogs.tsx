"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Field, FormField } from "@/components/shared/form-field";
import { FormDialog, FormDialogBody, FormDialogFooter } from "@/components/shared/form-dialog";
import { SubmitButton } from "@/components/shared/misc";
import { EnumSelect, OptionSelect } from "@/components/shared/option-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { markInvoicePaid, recordPayment } from "@/features/invoices/actions";
import { applyFieldErrors, useAction } from "@/hooks/use-action";
import { useZodForm } from "@/hooks/use-zod-form";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABEL, PAYMENT_STATUSES, PAYMENT_STATUS_META } from "@/lib/constants";
import { formatMoney } from "@/lib/money";
import { paymentSchema } from "@/lib/validation";
import type { PaymentMethod } from "@/server/db/schema";

const METHOD_META = Object.fromEntries(PAYMENT_METHODS.map((m) => [m, { label: PAYMENT_METHOD_LABEL[m] }])) as Record<PaymentMethod, { label: string }>;

const NOTICE = "This records a payment you've received — FlowDesk doesn't move money.";

export function MarkPaidDialog({
  open,
  onOpenChange,
  invoiceId,
  balance,
  currency,
  today,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  balance: number;
  currency: string;
  today: string;
}) {
  const router = useRouter();
  const [method, setMethod] = useState<PaymentMethod>("MPESA");
  const [paidOn, setPaidOn] = useState(today);
  const [reference, setReference] = useState("");
  // Reset the fields each time the dialog closes, so it reopens clean.
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setMethod("MPESA");
      setPaidOn(today);
      setReference("");
    }
    onOpenChange(next);
  };
  const { execute, pending } = useAction(markInvoicePaid, {
    success: "Invoice marked as paid.",
    onSuccess: () => {
      handleOpenChange(false);
      router.refresh();
    },
  });

  return (
    <FormDialog open={open} onOpenChange={handleOpenChange} title="Mark as paid" description={`Record a payment of ${formatMoney(balance, { currency, decimals: true })} for the full balance. ${NOTICE}`}>
      <form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          execute({ id: invoiceId, method, paidOn, reference });
        }}
      >
        <FormDialogBody>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Method" required>
              {(p) => <EnumSelect {...p} values={PAYMENT_METHODS} labels={METHOD_META} value={method} onChange={setMethod} />}
            </Field>
            <Field label="Date received" required>
              {(p) => <Input {...p} type="date" value={paidOn} max={today} onChange={(e) => setPaidOn(e.target.value)} required />}
            </Field>
          </div>
          <Field label="Reference" description={method === "MPESA" ? "M-Pesa confirmation code, e.g. QJK7H2M9XP" : "Bank or transaction reference"}>
            {(p) => <Input {...p} value={reference} maxLength={80} onChange={(e) => setReference(e.target.value)} />}
          </Field>
        </FormDialogBody>
        <FormDialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <SubmitButton pending={pending} pendingLabel="Saving…">
            Mark as paid
          </SubmitButton>
        </FormDialogFooter>
      </form>
    </FormDialog>
  );
}

export function PaymentDialog({
  open,
  onOpenChange,
  invoiceId,
  invoices,
  balance,
  currency,
  today,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fixed invoice (invoice page) … */
  invoiceId?: string;
  /** … or a picker (payments page). */
  invoices?: { id: string; label: string; balance: number }[];
  balance?: number;
  currency: string;
  today: string;
}) {
  const router = useRouter();
  const form = useZodForm(paymentSchema, { invoiceId: invoiceId ?? "", amount: balance ?? 0, method: "MPESA", status: "COMPLETED", paidOn: today, reference: "", notes: "" });
  const selected = form.watch("invoiceId");
  const currentBalance = invoiceId ? balance : invoices?.find((i) => i.id === selected)?.balance;

  useEffect(() => {
    if (open) form.reset({ invoiceId: invoiceId ?? "", amount: balance ?? 0, method: "MPESA", status: "COMPLETED", paidOn: today, reference: "", notes: "" });
  }, [open, invoiceId, balance, today, form]);

  const { execute, pending } = useAction(recordPayment, {
    success: "Payment recorded.",
    onSuccess: () => {
      onOpenChange(false);
      router.refresh();
    },
    onError: (r) => applyFieldErrors(form, r.fieldErrors),
  });

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title="Record a payment" description={NOTICE}>
      <form noValidate className="flex min-h-0 flex-1 flex-col" onSubmit={form.handleSubmit((v) => execute(v))}>
        <FormDialogBody>
          {invoices && (
            <FormField
              control={form.control}
              name="invoiceId"
              label="Invoice"
              required
              render={({ field, props }) => (
                <OptionSelect
                  {...props}
                  options={invoices}
                  value={field.value || null}
                  onChange={(v) => {
                    field.onChange(v ?? "");
                    const inv = invoices.find((i) => i.id === v);
                    if (inv) form.setValue("amount", inv.balance);
                  }}
                  placeholder="Choose an unpaid invoice"
                />
              )}
            />
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="amount"
              label="Amount"
              required
              description={currentBalance !== undefined ? `Balance: ${formatMoney(currentBalance, { currency, decimals: true })}` : undefined}
              render={({ props }) => <Input {...props} type="number" inputMode="decimal" min={0} step="any" {...form.register("amount")} />}
            />
            <FormField control={form.control} name="paidOn" label="Date" required render={({ field, props }) => <Input {...field} {...props} type="date" max={today} />} />
            <FormField
              control={form.control}
              name="method"
              label="Method"
              render={({ field, props }) => <EnumSelect {...props} values={PAYMENT_METHODS} labels={METHOD_META} value={field.value} onChange={field.onChange} />}
            />
            <FormField
              control={form.control}
              name="status"
              label="Status"
              render={({ field, props }) => <EnumSelect {...props} values={PAYMENT_STATUSES} labels={PAYMENT_STATUS_META} value={field.value ?? "COMPLETED"} onChange={field.onChange} />}
            />
          </div>
          <FormField control={form.control} name="reference" label="Reference" render={({ field, props }) => <Input {...field} value={field.value ?? ""} {...props} placeholder="e.g. QJK7H2M9XP" />} />
          <FormField control={form.control} name="notes" label="Notes" render={({ field, props }) => <Textarea {...field} value={field.value ?? ""} {...props} rows={2} />} />
        </FormDialogBody>
        <FormDialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <SubmitButton pending={pending} pendingLabel="Saving…">
            Record payment
          </SubmitButton>
        </FormDialogFooter>
      </form>
    </FormDialog>
  );
}
