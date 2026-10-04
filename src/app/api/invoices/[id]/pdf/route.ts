import { z } from "zod";

import { getInvoice } from "@/features/invoices/queries";
import { toDocumentData } from "@/features/invoices/document-data";
import { invoicePdfResponse } from "@/features/invoices/pdf/render";
import { getAppContext } from "@/server/auth/session";

/** Invoice PDF for signed-in users. RLS decides visibility (managers, or the invoice's client). */
export async function GET(_request: Request, { params }: RouteContext<"/api/invoices/[id]/pdf">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return new Response("Not found", { status: 404 });
  let ctx;
  try {
    ctx = await getAppContext();
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }
  const details = await ctx.db((tx) => getInvoice(tx, ctx.workspace.id, id));
  if (!details) return new Response("Not found", { status: 404 });
  return invoicePdfResponse(toDocumentData(details, ctx.workspace));
}
