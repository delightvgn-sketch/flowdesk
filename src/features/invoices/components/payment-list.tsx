"use client";

import { MoreHorizontal, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deletePayment, updatePaymentStatus } from "@/features/invoices/actions";
import { useAction } from "@/hooks/use-action";
import { PAYMENT_METHOD_LABEL, PAYMENT_STATUSES, PAYMENT_STATUS_META } from "@/lib/constants";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import type { PaymentMethod, PaymentStatus } from "@/server/db/schema";

type Row = {
  id: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  paidOn: string;
  reference: string | null;
  recordedBy: string | null;
};

export function PaymentList({ payments, currency, readOnly = false }: { payments: Row[]; currency: string; readOnly?: boolean }) {
  const router = useRouter();
  const setStatus = useAction(updatePaymentStatus, { success: "Payment updated.", onSuccess: () => router.refresh() });
  const remove = useAction(deletePayment, { success: "Payment removed.", onSuccess: () => router.refresh() });

  if (payments.length === 0) return <p className="text-sm text-muted-foreground">No payments recorded yet.</p>;
  return (
    <ul className="divide-y">
      {payments.map((p) => (
        <li key={p.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
          <div className="min-w-0 flex-1">
            <p className="tabular text-sm font-medium">{formatMoney(p.amount, { currency })}</p>
            <p className="truncate text-xs text-muted-foreground">
              {PAYMENT_METHOD_LABEL[p.method]} · {formatDate(p.paidOn, "d MMM yyyy")}
              {p.reference && <> · {p.reference}</>}
            </p>
          </div>
          <StatusBadge kind="payment" value={p.status} />
          {!readOnly && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-xs" aria-label="Payment actions">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="text-xs text-muted-foreground">Set status</DropdownMenuLabel>
                {PAYMENT_STATUSES.map((s) => (
                  <DropdownMenuItem key={s} disabled={s === p.status} onSelect={() => setStatus.execute({ id: p.id, status: s })}>
                    {PAYMENT_STATUS_META[s].label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => remove.execute({ id: p.id })}>
                  <Trash2 /> Delete record
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </li>
      ))}
    </ul>
  );
}
