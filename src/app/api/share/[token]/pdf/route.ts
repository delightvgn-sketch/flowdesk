import { toDocumentData } from "@/features/invoices/document-data";
import { invoicePdfResponse } from "@/features/invoices/pdf/render";
import { getSharedInvoice } from "@/features/invoices/public";

export async function GET(_request: Request, { params }: RouteContext<"/api/share/[token]/pdf">) {
  const { token } = await params;
  const shared = await getSharedInvoice(token);
  if (!shared) return new Response("Not found", { status: 404 });
  return invoicePdfResponse(toDocumentData(shared.details, shared.workspace));
}
