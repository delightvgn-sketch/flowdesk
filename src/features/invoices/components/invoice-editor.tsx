"use client";

import { GripVertical, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useFieldArray, useWatch } from "react-hook-form";

import { Field, FormField } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/misc";
import { OptionSelect } from "@/components/shared/option-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createInvoice, updateInvoice } from "@/features/invoices/actions";
import { applyFieldErrors, useAction } from "@/hooks/use-action";
import { useZodForm } from "@/hooks/use-zod-form";
import { calculateInvoiceTotals } from "@/lib/invoice-math";
import { currencySymbol, formatMoney } from "@/lib/money";
import { invoiceSchema, type InvoiceInput } from "@/lib/validation";

import { AiDraftButton } from "./ai-draft-button";

type Option = { id: string; label: string };

export function InvoiceEditor({
  invoiceId,
  initial,
  clients,
  projects,
  currency,
  numberPreview,
  aiEnabled,
}: {
  invoiceId?: string;
  initial: InvoiceInput;
  clients: Option[];
  projects: (Option & { clientId: string | null })[];
  currency: string;
  numberPreview: string;
  aiEnabled: boolean;
}) {
  const router = useRouter();
  const form = useZodForm(invoiceSchema, initial);
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });
  const values = useWatch({ control: form.control });
  const clientId = values.clientId;

  const totals = calculateInvoiceTotals({
    items: (values.items ?? []).map((i) => ({ quantity: Number(i?.quantity) || 0, unitPrice: Number(i?.unitPrice) || 0 })),
    discountType: values.discountType ?? "PERCENT",
    discountValue: Number(values.discountValue) || 0,
    taxRate: Number(values.taxRate) || 0,
  });
  const money = (n: number) => formatMoney(n, { currency, decimals: true });
  const projectChoices = projects.filter((p) => !clientId || !p.clientId || p.clientId === clientId);

  const onError = (r: { fieldErrors?: Record<string, string[] | undefined> }) => applyFieldErrors(form, r.fieldErrors);
  const create = useAction(createInvoice, {
    success: (d) => `Invoice ${d.number} created.`,
    onSuccess: (d) => router.push(`/invoices/${d.id}`),
    onError,
  });
  const update = useAction(updateInvoice, {
    success: "Invoice saved.",
    onSuccess: () => router.push(`/invoices/${invoiceId}`),
    onError,
  });
  const pending = create.pending || update.pending;

  const submit = (send: boolean) =>
    form.handleSubmit((v) => (invoiceId ? update.execute({ ...v, id: invoiceId }) : create.execute({ ...v, send })));

  return (
    <form noValidate onSubmit={submit(false)} className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
      <div className="space-y-6">
        <section className="rounded-xl border bg-card p-4 shadow-xs sm:p-5" aria-labelledby="invoice-details">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 id="invoice-details" className="text-sm font-semibold">
              Details
            </h2>
            <span className="tabular text-sm text-muted-foreground">{numberPreview}</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="clientId"
              label="Bill to"
              required
              render={({ field, props }) => (
                <OptionSelect
                  {...props}
                  options={clients}
                  value={field.value || null}
                  onChange={(v) => {
                    field.onChange(v ?? "");
                    const current = form.getValues("projectId");
                    if (current && !projects.some((p) => p.id === current && (!p.clientId || p.clientId === v))) form.setValue("projectId", null);
                  }}
                  placeholder="Choose a client"
                />
              )}
            />
            <FormField
              control={form.control}
              name="projectId"
              label="Project"
              render={({ field, props }) => <OptionSelect {...props} options={projectChoices} value={field.value} onChange={field.onChange} noneLabel="No project" />}
            />
            <FormField control={form.control} name="issueDate" label="Issue date" required render={({ field, props }) => <Input {...field} {...props} type="date" />} />
            <FormField control={form.control} name="dueDate" label="Due date" required render={({ field, props }) => <Input {...field} {...props} type="date" />} />
          </div>
        </section>

        <section className="rounded-xl border bg-card shadow-xs" aria-labelledby="invoice-items">
          <div className="flex items-center justify-between border-b px-4 py-3 sm:px-5">
            <h2 id="invoice-items" className="text-sm font-semibold">
              Line items
            </h2>
            <span className="text-xs text-muted-foreground">Amounts in {currencySymbol(currency)}</span>
          </div>
          <div className="hidden grid-cols-[1fr_88px_128px_120px_36px] gap-3 border-b px-5 py-2 text-xs font-medium text-muted-foreground sm:grid">
            <span>Description</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Unit price</span>
            <span className="text-right">Amount</span>
            <span />
          </div>
          <ul className="divide-y">
            {fields.map((field, index) => {
              const err = form.formState.errors.items?.[index];
              return (
                <li key={field.id} className="grid grid-cols-2 gap-3 px-4 py-3 sm:grid-cols-[1fr_88px_128px_120px_36px] sm:items-start sm:px-5">
                  <div className="col-span-2 flex items-start gap-1 sm:col-span-1">
                    <GripVertical className="mt-2.5 hidden size-4 shrink-0 text-border-strong sm:block" aria-hidden />
                    <div className="flex-1">
                      <label className="sr-only" htmlFor={`item-${index}-description`}>
                        Description for line {index + 1}
                      </label>
                      <Textarea
                        id={`item-${index}-description`}
                        rows={1}
                        className="min-h-9 resize-none py-1.5"
                        placeholder="e.g. Website design — homepage and 5 inner pages"
                        aria-invalid={!!err?.description}
                        {...form.register(`items.${index}.description`)}
                      />
                      {err?.description && <p className="mt-1 text-xs text-danger">{err.description.message}</p>}
                      {aiEnabled && (
                        <AiDraftButton
                          getContext={() => ({
                            draft: form.getValues(`items.${index}.description`),
                            client: clients.find((c) => c.id === form.getValues("clientId"))?.label,
                            project: projects.find((p) => p.id === form.getValues("projectId"))?.label,
                          })}
                          onDraft={(text) => form.setValue(`items.${index}.description`, text, { shouldDirty: true })}
                        />
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground sm:sr-only" htmlFor={`item-${index}-qty`}>
                      Quantity
                    </label>
                    <Input id={`item-${index}-qty`} type="number" inputMode="decimal" min={0} step="any" className="text-right" aria-invalid={!!err?.quantity} {...form.register(`items.${index}.quantity`)} />
                    {err?.quantity && <p className="mt-1 text-xs text-danger">{err.quantity.message}</p>}
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground sm:sr-only" htmlFor={`item-${index}-price`}>
                      Unit price
                    </label>
                    <Input id={`item-${index}-price`} type="number" inputMode="decimal" min={0} step="any" className="text-right" aria-invalid={!!err?.unitPrice} {...form.register(`items.${index}.unitPrice`)} />
                    {err?.unitPrice && <p className="mt-1 text-xs text-danger">{err.unitPrice.message}</p>}
                  </div>
                  <p className="tabular col-span-1 self-center text-sm font-medium sm:text-right" aria-label={`Line ${index + 1} amount`}>
                    {money(totals.lineAmounts[index] ?? 0)}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="justify-self-end"
                    onClick={() => remove(index)}
                    disabled={fields.length === 1}
                    aria-label={`Remove line ${index + 1}`}
                  >
                    <Trash2 />
                  </Button>
                </li>
              );
            })}
          </ul>
          {form.formState.errors.items?.root?.message && <p className="px-5 pb-2 text-xs text-danger">{form.formState.errors.items.root.message}</p>}
          <div className="border-t px-4 py-3 sm:px-5">
            <Button type="button" variant="ghost" size="sm" onClick={() => append({ description: "", quantity: 1, unitPrice: 0 })} disabled={fields.length >= 100}>
              <Plus /> Add line
            </Button>
          </div>
        </section>

        <section className="rounded-xl border bg-card p-4 shadow-xs sm:p-5">
          <FormField
            control={form.control}
            name="notes"
            label="Notes & payment instructions"
            description="Shown at the bottom of the invoice."
            render={({ field, props }) => <Textarea {...field} value={field.value ?? ""} {...props} rows={3} placeholder="M-Pesa Paybill 522522, Account 1234567…" />}
          />
        </section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-20">
        <section className="rounded-xl border bg-card p-4 shadow-xs sm:p-5" aria-labelledby="invoice-summary">
          <h2 id="invoice-summary" className="mb-4 text-sm font-semibold">
            Summary
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Discount">
              {(p) => (
                <div className="flex gap-1.5">
                  <Input {...p} type="number" inputMode="decimal" min={0} step="any" className="text-right" {...form.register("discountValue")} />
                  <Select value={values.discountType} onValueChange={(v) => form.setValue("discountType", v as "PERCENT" | "FIXED")}>
                    <SelectTrigger className="w-16 shrink-0" aria-label="Discount type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PERCENT">%</SelectItem>
                      <SelectItem value="FIXED">{currencySymbol(currency)}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </Field>
            <FormField control={form.control} name="taxRate" label="Tax (VAT %)" render={({ props }) => <Input {...props} type="number" inputMode="decimal" min={0} max={100} step="any" className="text-right" {...form.register("taxRate")} />} />
          </div>
          {form.formState.errors.discountValue && <p className="mt-1 text-xs text-danger">{form.formState.errors.discountValue.message}</p>}

          <dl className="mt-5 space-y-2 border-t pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="tabular">{money(totals.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Discount</dt>
              <dd className="tabular">−{money(totals.discountTotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Tax</dt>
              <dd className="tabular">{money(totals.taxTotal)}</dd>
            </div>
            <div className="flex items-baseline justify-between border-t pt-3">
              <dt className="font-semibold">Total</dt>
              <dd className="tabular text-xl font-semibold">{money(totals.total)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-[11px] text-muted-foreground">Totals are recalculated on the server when you save.</p>
        </section>

        <div className="flex flex-col gap-2">
          {invoiceId ? (
            <SubmitButton pending={pending} pendingLabel="Saving…" size="lg">
              Save changes
            </SubmitButton>
          ) : (
            <>
              <Button type="button" size="lg" disabled={pending} onClick={submit(true)}>
                Save &amp; send
              </Button>
              <SubmitButton pending={pending} pendingLabel="Saving…" variant="outline" size="lg">
                Save as draft
              </SubmitButton>
            </>
          )}
          <Button type="button" variant="ghost" onClick={() => router.back()} disabled={pending}>
            Cancel
          </Button>
        </div>
      </aside>
    </form>
  );
}
