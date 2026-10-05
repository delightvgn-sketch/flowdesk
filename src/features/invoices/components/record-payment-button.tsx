"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import { PaymentDialog } from "./payment-dialogs";

export function RecordPaymentButton({
  invoices,
  currency,
  today,
}: {
  invoices: { id: string; label: string; balance: number }[];
  currency: string;
  today: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={invoices.length === 0}>
        <Plus /> Record payment
      </Button>
      <PaymentDialog open={open} onOpenChange={setOpen} invoices={invoices} currency={currency} today={today} />
    </>
  );
}
