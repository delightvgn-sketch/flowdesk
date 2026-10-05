import "server-only";

import { and, asc, count, desc, eq, ilike, inArray, ne, or, sql, type SQL } from "drizzle-orm";

import { ACTIVE_PROJECT_STATUSES, PAGE_SIZE } from "@/lib/constants";
import type { Tx } from "@/server/db";
import { clientContacts, clients, invoices, projects, type ClientStatus } from "@/server/db/schema";

export type ClientListFilters = {
  q?: string;
  status?: ClientStatus;
  tag?: string;
  sort?: "newest" | "oldest" | "name" | "revenue";
  page: number;
};

const like = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export async function listClients(tx: Tx, workspaceId: string, f: ClientListFilters) {
  const where: SQL[] = [eq(clients.workspaceId, workspaceId)];
  if (f.q) {
    const p = like(f.q);
    where.push(or(ilike(clients.name, p), ilike(clients.company, p), ilike(clients.email, p))!);
  }
  // Archived clients are hidden unless explicitly requested.
  if (f.status) where.push(eq(clients.status, f.status));
  else where.push(ne(clients.status, "ARCHIVED"));
  if (f.tag) where.push(sql`${f.tag} = any(${clients.tags})`);

  // Drizzle renders columns unqualified in single-table selects, so correlated
  // subqueries reference the outer row explicitly.
  const outerId = sql`"clients"."id"`;
  const revenue = sql<number>`coalesce((
    select sum(i.amount_paid) from invoices i where i.client_id = ${outerId}
  ), 0)`.mapWith(Number);
  const activeProjects = sql<number>`(
    select count(*) from projects p where p.client_id = ${outerId}
      and p.status in ('PLANNING', 'IN_PROGRESS', 'REVIEW')
  )`.mapWith(Number);

  const order =
    f.sort === "name"
      ? [asc(sql`coalesce(${clients.company}, ${clients.name})`)]
      : f.sort === "oldest"
        ? [asc(clients.createdAt)]
        : f.sort === "revenue"
          ? [desc(revenue)]
          : [desc(clients.createdAt)];

  const [rows, [{ total }]] = await Promise.all([
    tx
      .select({
        id: clients.id,
        name: clients.name,
        company: clients.company,
        email: clients.email,
        phone: clients.phone,
        status: clients.status,
        tags: clients.tags,
        createdAt: clients.createdAt,
        revenue,
        activeProjects,
      })
      .from(clients)
      .where(and(...where))
      .orderBy(...order)
      .limit(PAGE_SIZE)
      .offset((f.page - 1) * PAGE_SIZE),
    tx
      .select({ total: count() })
      .from(clients)
      .where(and(...where)),
  ]);

  return { rows, total };
}

export async function listClientTags(tx: Tx, workspaceId: string): Promise<string[]> {
  const rows = await tx.execute<{ tag: string }>(
    sql`select distinct unnest(tags) as tag from clients where workspace_id = ${workspaceId} order by 1`,
  );
  return rows.map((r) => r.tag);
}

/** Lightweight list for <select> inputs. */
export async function clientOptions(tx: Tx, workspaceId: string) {
  return tx
    .select({ id: clients.id, label: sql<string>`coalesce(${clients.company}, ${clients.name})` })
    .from(clients)
    .where(and(eq(clients.workspaceId, workspaceId), ne(clients.status, "ARCHIVED")))
    .orderBy(asc(sql`coalesce(${clients.company}, ${clients.name})`));
}

export async function getClient(tx: Tx, workspaceId: string, id: string) {
  const client = await tx.query.clients.findFirst({
    where: and(eq(clients.id, id), eq(clients.workspaceId, workspaceId)),
  });
  if (!client) return null;

  const [contacts, [stats], [projectCount]] = await Promise.all([
    tx
      .select()
      .from(clientContacts)
      .where(eq(clientContacts.clientId, id))
      .orderBy(desc(clientContacts.isPrimary), asc(clientContacts.name)),
    tx
      .select({
        revenue: sql<number>`coalesce(sum(${invoices.amountPaid}), 0)`.mapWith(Number),
        outstanding:
          sql<number>`coalesce(sum(case when ${invoices.status} in ('SENT', 'OVERDUE') then ${invoices.total} - ${invoices.amountPaid} else 0 end), 0)`.mapWith(
            Number,
          ),
        overdue:
          sql<number>`coalesce(sum(case when ${invoices.status} in ('SENT', 'OVERDUE') and ${invoices.dueDate} < current_date then ${invoices.total} - ${invoices.amountPaid} else 0 end), 0)`.mapWith(
            Number,
          ),
        invoiceCount: count(),
      })
      .from(invoices)
      .where(eq(invoices.clientId, id)),
    tx
      .select({ active: count() })
      .from(projects)
      .where(and(eq(projects.clientId, id), inArray(projects.status, ACTIVE_PROJECT_STATUSES))),
  ]);

  return { client, contacts, stats: { ...stats, activeProjects: projectCount.active } };
}
