"use client";

import { Ban, Check, Copy, CopyPlus, Download, Link2, Link2Off, MoreHorizontal, Pencil, Plus, Send, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  cancelInvoice,
  createShareLink,
  deleteInvoice,
  duplicateInvoice,
  revokeShareLink,
  sendInvoice,
} from "@/features/invoices/actions";
import { useAction } from "@/hooks/use-action";
import type { InvoiceStatus } from "@/server/db/schema";

import { MarkPaidDialog, PaymentDialog } from "./payment-dialogs";

type Props = {
  id: string;
  number: string;
  status: InvoiceStatus;
  balance: number;
  currency: string;
  shareToken: string | null;
  appUrl: string;
  today: string;
};

export function InvoiceActions(props: Props) {
  const { id, number, status, balance } = props;
  const router = useRouter();
  const [confirm, setConfirm] = useState<"cancel" | "delete" | null>(null);
  const [paidOpen, setPaidOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const open = status === "SENT" || status === "OVERDUE";
  const refresh = () => router.refresh();

  const send = useAction(sendInvoice, {
    success: `Invoice ${number} sent — your client can now see it in their portal.`,
    onSuccess: refresh,
  });
  const duplicate = useAction(duplicateInvoice, {
    success: "Invoice duplicated as a new draft.",
    onSuccess: ({ id: newId }) => router.push(`/invoices/${newId}/edit`),
  });
  const cancel = useAction(cancelInvoice, {
    success: "Invoice cancelled.",
    onSuccess: () => {
      setConfirm(null);
      refresh();
    },
  });
  const remove = useAction(deleteInvoice, { success: "Draft deleted.", onSuccess: () => router.push("/invoices") });

  return (
    <div className="flex flex-col gap-2">
      {status === "DRAFT" && (
        <Button size="lg" onClick={() => send.execute({ id })} disabled={send.pending}>
          <Send /> {send.pending ? "Sending…" : "Send invoice"}
        </Button>
      )}
      {open && balance > 0 && (
        <Button size="lg" onClick={() => setPaidOpen(true)}>
          <Check /> Mark as paid
        </Button>
      )}
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" asChild>
          <a href={`/api/invoices/${id}/pdf`} download>
            <Download /> PDF
          </a>
        </Button>
        {status !== "PAID" && status !== "CANCELLED" && (
          <Button variant="outline" className="flex-1" asChild>
            <Link href={`/invoices/${id}/edit`}>
              <Pencil /> Edit
            </Link>
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" aria-label="More invoice actions">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {open && (
              <DropdownMenuItem onSelect={() => setPaymentOpen(true)}>
                <Plus /> Record partial payment
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={() => duplicate.execute({ id })}>
              <CopyPlus /> Duplicate
            </DropdownMenuItem>
            {(status === "DRAFT" || open) && <DropdownMenuSeparator />}
            {open && (
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirm("cancel")}>
                <Ban /> Cancel invoice
              </DropdownMenuItem>
            )}
            {status === "DRAFT" && (
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirm("delete")}>
                <Trash2 /> Delete draft
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <MarkPaidDialog
        open={paidOpen}
        onOpenChange={setPaidOpen}
        invoiceId={id}
        balance={balance}
        currency={props.currency}
        today={props.today}
      />
      <PaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        invoiceId={id}
        balance={balance}
        currency={props.currency}
        today={props.today}
      />
      <ConfirmDialog
        open={confirm === "cancel"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Cancel ${number}?`}
        description="The invoice is kept for your records but no longer counts as outstanding. Any share link is revoked."
        confirmLabel="Cancel invoice"
        pending={cancel.pending}
        onConfirm={() => cancel.execute({ id })}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Delete draft ${number}?`}
        description="This draft will be permanently deleted."
        confirmLabel="Delete draft"
        pending={remove.pending}
        onConfirm={() => remove.execute({ id })}
      />
    </div>
  );
}

/** Public share link: create, copy, revoke. */
export function SharePanel({ id, status, shareToken, appUrl }: Pick<Props, "id" | "status" | "shareToken" | "appUrl">) {
  const router = useRouter();
  const create = useAction(createShareLink, { success: "Share link created.", onSuccess: () => router.refresh() });
  const revoke = useAction(revokeShareLink, { success: "Share link revoked.", onSuccess: () => router.refresh() });
  const url = shareToken ? `${appUrl}/i/${shareToken}` : null;
  const shareable = status !== "DRAFT" && status !== "CANCELLED";

  async function copy() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard.");
  }

  return (
    <div>
      <p className="text-sm font-semibold">Share</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {shareable ? "Anyone with the link can view and download this invoice." : "Send the invoice to enable a share link."}
      </p>
      {url ? (
        <div className="mt-3 space-y-2">
          <div className="flex gap-2">
            <Input readOnly value={url} aria-label="Share link" className="text-xs" onFocus={(e) => e.currentTarget.select()} />
            <Button variant="outline" size="icon" onClick={copy} aria-label="Copy link">
              <Copy />
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => revoke.execute({ id })}
            disabled={revoke.pending}
          >
            <Link2Off /> Revoke link
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => create.execute({ id })}
          disabled={!shareable || create.pending}
        >
          <Link2 /> Create share link
        </Button>
      )}
    </div>
  );
}
