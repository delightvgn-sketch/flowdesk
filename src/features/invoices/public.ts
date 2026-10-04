import "server-only";

import { and, eq, notInArray } from "drizzle-orm";

import { adminDb } from "@/server/db";
import { invoices, workspaces } from "@/server/db/schema";

import { getInvoice } from "./queries";

/**
 * Resolve a public share token. Uses the privileged connection because the
 * viewer isn't signed in; the 32-byte random token is the capability, and
 * drafts/cancelled invoices are never exposed.
 */
export async function getSharedInvoice(token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const row = await adminDb.query.invoices.findFirst({
    where: and(eq(invoices.shareToken, token), notInArray(invoices.status, ["DRAFT", "CANCELLED"])),
  });
  if (!row) return null;
  const [details, workspace] = await Promise.all([
    adminDb.transaction((tx) => getInvoice(tx, row.workspaceId, row.id)),
    adminDb.query.workspaces.findFirst({ where: eq(workspaces.id, row.workspaceId) }),
  ]);
  if (!details || !workspace) return null;
  return { details, workspace };
}
