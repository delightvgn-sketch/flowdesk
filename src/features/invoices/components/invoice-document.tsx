import { LogoMark } from "@/components/layout/logo";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export type InvoiceDocumentData = {
  number: string;
  status: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  notes: string | null;
  subtotal: number;
  discountTotal: number;
  discountType: "PERCENT" | "FIXED";
  discountValue: number;
  taxRate: number;
  taxTotal: number;
  total: number;
  amountPaid: number;
  from: { name: string; email: string | null; phone: string | null; address: string | null };
  to: { company: string | null; name: string; email: string | null; phone: string | null; address: string | null };
  projectName: string | null;
  items: { description: string; quantity: number; unitPrice: number; amount: number }[];
};

/**
 * Paper-style invoice used on screen. The PDF (pdf/invoice-pdf.tsx) is a
 * separate react-pdf document built from the same data shape.
 */
export function InvoiceDocument({ data, className }: { data: InvoiceDocumentData; className?: string }) {
  const money = (n: number) => formatMoney(n, { currency: data.currency, decimals: true });
  const balance = Math.max(0, data.total - data.amountPaid);

  return (
    <article
      className={cn("relative overflow-hidden rounded-xl border bg-card p-6 shadow-sm sm:p-10", className)}
      aria-label={`Invoice ${data.number}`}
    >
      {data.status === "PAID" && (
        <span
          aria-hidden
          className="pointer-events-none absolute top-8 -right-12 rotate-45 bg-success px-14 py-1 text-xs font-semibold tracking-widest text-white"
        >
          PAID
        </span>
      )}
      <header className="flex flex-col justify-between gap-6 sm:flex-row">
        <div>
          <div className="flex items-center gap-2">
            <LogoMark className="size-8" />
            <span className="text-lg font-semibold tracking-tight">{data.from.name}</span>
          </div>
          <address className="mt-3 text-sm leading-relaxed whitespace-pre-line text-muted-foreground not-italic">
            {[data.from.address, data.from.email, data.from.phone].filter(Boolean).join("\n")}
          </address>
        </div>
        <div className="sm:text-right">
          <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">Invoice</p>
          <p className="tabular mt-1 text-2xl font-semibold tracking-tight">{data.number}</p>
          <dl className="mt-3 grid grid-cols-[auto_auto] gap-x-4 gap-y-1 text-sm sm:justify-end">
            <dt className="text-muted-foreground">Issued</dt>
            <dd className="tabular">{formatDate(data.issueDate)}</dd>
            <dt className="text-muted-foreground">Due</dt>
            <dd className="tabular">{formatDate(data.dueDate)}</dd>
          </dl>
        </div>
      </header>

      <section className="mt-8 grid gap-6 border-t pt-6 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Bill to</p>
          <p className="mt-2 font-semibold">{data.to.company ?? data.to.name}</p>
          <address className="mt-1 text-sm leading-relaxed whitespace-pre-line text-muted-foreground not-italic">
            {[data.to.company ? `Attn: ${data.to.name}` : null, data.to.address, data.to.email, data.to.phone]
              .filter(Boolean)
              .join("\n")}
          </address>
        </div>
        {data.projectName && (
          <div className="sm:text-right">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Project</p>
            <p className="mt-2 font-medium">{data.projectName}</p>
          </div>
        )}
      </section>

      <div className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th scope="col" className="py-2 text-left font-medium">
                Description
              </th>
              <th scope="col" className="w-16 py-2 text-right font-medium">
                Qty
              </th>
              <th scope="col" className="w-32 py-2 text-right font-medium">
                Unit price
              </th>
              <th scope="col" className="w-32 py-2 text-right font-medium">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="py-3 pr-4">{item.description}</td>
                <td className="tabular py-3 text-right">{item.quantity}</td>
                <td className="tabular py-3 text-right">{money(item.unitPrice)}</td>
                <td className="tabular py-3 text-right font-medium">{money(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="mt-6 flex justify-end">
        <dl className="w-full max-w-xs space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd className="tabular">{money(data.subtotal)}</dd>
          </div>
          {data.discountTotal > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">
                Discount{data.discountType === "PERCENT" ? ` (${data.discountValue}%)` : ""}
              </dt>
              <dd className="tabular">−{money(data.discountTotal)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Tax ({data.taxRate}% VAT)</dt>
            <dd className="tabular">{money(data.taxTotal)}</dd>
          </div>
          <div className="flex items-baseline justify-between border-t pt-3">
            <dt className="font-semibold">Total</dt>
            <dd className="tabular text-lg font-semibold">{money(data.total)}</dd>
          </div>
          {data.amountPaid > 0 && (
            <>
              <div className="flex justify-between text-success">
                <dt>Paid</dt>
                <dd className="tabular">−{money(data.amountPaid)}</dd>
              </div>
              <div className="flex justify-between font-semibold">
                <dt>Balance due</dt>
                <dd className="tabular">{money(balance)}</dd>
              </div>
            </>
          )}
        </dl>
      </section>

      {data.notes && (
        <footer className="mt-10 border-t pt-5">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Notes</p>
          <p className="mt-2 text-sm whitespace-pre-line text-muted-foreground">{data.notes}</p>
        </footer>
      )}
    </article>
  );
}
