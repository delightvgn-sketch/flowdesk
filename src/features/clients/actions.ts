"use server";

import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { clientContactSchema, clientSchema, idSchema } from "@/lib/validation";
import { createAction } from "@/server/actions/safe-action";
import { clientContacts, clients, invoices } from "@/server/db/schema";
import { NotFoundError, UserFacingError } from "@/server/errors";
import { logActivity } from "@/server/services/activity";

const label = (c: { company: string | null; name: string }) => c.company ?? c.name;

export const createClient = createAction({ schema: clientSchema, permission: "client:manage" }, async (input, ctx) => {
  const client = await ctx.db(async (tx) => {
    const [row] = await tx
      .insert(clients)
      .values({ ...input, workspaceId: ctx.workspace.id, createdById: ctx.profile.id })
      .returning();
    // The primary contact mirrors the client's main contact details.
    await tx.insert(clientContacts).values({
      workspaceId: ctx.workspace.id,
      clientId: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      isPrimary: true,
    });
    await logActivity(tx, ctx, { action: "client.created", entityType: "client", entityId: row.id, entityLabel: label(row), clientId: row.id });
    return row;
  });
  revalidatePath("/clients");
  return { id: client.id };
});

export const updateClient = createAction(
  { schema: clientSchema.extend({ id: z.uuid() }), permission: "client:manage" },
  async ({ id, ...input }, ctx) => {
    await ctx.db(async (tx) => {
      const [row] = await tx
        .update(clients)
        .set(input)
        .where(and(eq(clients.id, id), eq(clients.workspaceId, ctx.workspace.id)))
        .returning();
      if (!row) throw new NotFoundError("Client");
      await tx
        .update(clientContacts)
        .set({ name: row.name, email: row.email, phone: row.phone })
        .where(and(eq(clientContacts.clientId, id), eq(clientContacts.isPrimary, true)));
      await logActivity(tx, ctx, {
        action: input.status === "ARCHIVED" ? "client.archived" : "client.updated",
        entityType: "client",
        entityId: id,
        entityLabel: label(row),
        clientId: id,
      });
    });
    revalidatePath("/clients");
    revalidatePath(`/clients/${id}`);
  },
);

export const setClientArchived = createAction(
  { schema: idSchema.extend({ archived: z.boolean() }), permission: "client:manage" },
  async ({ id, archived }, ctx) => {
    await ctx.db(async (tx) => {
      const [row] = await tx
        .update(clients)
        .set({ status: archived ? "ARCHIVED" : "ACTIVE" })
        .where(and(eq(clients.id, id), eq(clients.workspaceId, ctx.workspace.id)))
        .returning();
      if (!row) throw new NotFoundError("Client");
      await logActivity(tx, ctx, {
        action: archived ? "client.archived" : "client.updated",
        entityType: "client",
        entityId: id,
        entityLabel: label(row),
        clientId: id,
      });
    });
    revalidatePath("/clients");
    revalidatePath(`/clients/${id}`);
  },
);

/** Hard delete is only allowed for clients without invoices — financial history is kept. */
export const deleteClient = createAction({ schema: idSchema, permission: "client:manage" }, async ({ id }, ctx) => {
  await ctx.db(async (tx) => {
    const [{ invoiceCount }] = await tx.select({ invoiceCount: count() }).from(invoices).where(eq(invoices.clientId, id));
    if (invoiceCount > 0) {
      throw new UserFacingError("This client has invoices, so it can't be deleted. Archive it instead to keep your financial records intact.");
    }
    const deleted = await tx
      .delete(clients)
      .where(and(eq(clients.id, id), eq(clients.workspaceId, ctx.workspace.id)))
      .returning({ id: clients.id });
    if (deleted.length === 0) throw new NotFoundError("Client");
  });
  revalidatePath("/clients");
});

export const addContact = createAction({ schema: clientContactSchema, permission: "client:manage" }, async (input, ctx) => {
  await ctx.db((tx) => tx.insert(clientContacts).values({ ...input, workspaceId: ctx.workspace.id }));
  revalidatePath(`/clients/${input.clientId}`);
});

export const deleteContact = createAction({ schema: idSchema, permission: "client:manage" }, async ({ id }, ctx) => {
  const [row] = await ctx.db((tx) =>
    tx
      .delete(clientContacts)
      .where(and(eq(clientContacts.id, id), eq(clientContacts.workspaceId, ctx.workspace.id), eq(clientContacts.isPrimary, false)))
      .returning({ clientId: clientContacts.clientId }),
  );
  if (!row) throw new UserFacingError("The primary contact can't be removed. Edit the client instead.");
  revalidatePath(`/clients/${row.clientId}`);
});
