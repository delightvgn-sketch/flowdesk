import "server-only";

import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";

import type { InvoiceDocumentData } from "../components/invoice-document";
import { InvoicePdf } from "./invoice-pdf";

export async function invoicePdfResponse(data: InvoiceDocumentData) {
  const buffer = await renderToBuffer(createElement(InvoicePdf, { data }) as Parameters<typeof renderToBuffer>[0]);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${data.number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
