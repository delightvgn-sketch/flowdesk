import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";

import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { InvoiceDocument } from "@/features/invoices/components/invoice-document";
import { toDocumentData } from "@/features/invoices/document-data";
import { getSharedInvoice } from "@/features/invoices/public";

export const metadata: Metadata = { title: "Invoice", robots: { index: false, follow: false } };

/** Public, read-only invoice reached through a share link. */
export default async function SharedInvoicePage({ params }: PageProps<"/i/[token]">) {
  const { token } = await params;
  const shared = await getSharedInvoice(token);
  if (!shared) notFound();
  const data = toDocumentData(shared.details, shared.workspace);

  return (
    <div className="min-h-dvh bg-muted/40">
      <header className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-5">
        <p className="text-sm text-muted-foreground">
          Invoice from <span className="font-medium text-foreground">{shared.workspace.name}</span>
        </p>
        <Button asChild>
          <a href={`/api/share/${token}/pdf`} download>
            <Download /> Download PDF
          </a>
        </Button>
      </header>
      <main className="mx-auto max-w-4xl px-4 pb-16">
        <InvoiceDocument data={data} />
        <p className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          Sent with
          <Link href="/" className="inline-flex items-center">
            <Logo compact />
          </Link>
        </p>
      </main>
    </div>
  );
}
