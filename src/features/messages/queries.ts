import "server-only";

import { and, asc, desc, eq, isNull, sql, type SQL } from "drizzle-orm";

import type { Tx } from "@/server/db";
import { clients, messages, profiles, projects } from "@/server/db/schema";

export type ThreadKey = { projectId?: string | null; clientId?: string | null };

export type MessageItem = {
  id: string;
  body: string;
  internal: boolean;
  createdAt: string;
  authorId: string | null;
  authorName: string | null;
  authorAvatar: string | null;
  authorIsClient: boolean;
};

export async function listMessages(tx: Tx, workspaceId: string, key: ThreadKey, limit = 100): Promise<MessageItem[]> {
  const where: SQL[] = [eq(messages.workspaceId, workspaceId)];
  if (key.projectId) where.push(eq(messages.projectId, key.projectId));
  else if (key.clientId) where.push(and(eq(messages.clientId, key.clientId), isNull(messages.projectId))!);
  else where.push(and(isNull(messages.projectId), isNull(messages.clientId))!);

  const rows = await tx
    .select({
      id: messages.id,
      body: messages.body,
      internal: messages.internal,
      createdAt: messages.createdAt,
      authorId: messages.authorId,
      authorName: profiles.fullName,
      authorAvatar: profiles.avatarUrl,
      authorIsClient: sql<boolean>`exists (select 1 from workspace_members m where m.profile_id = ${messages.authorId} and m.workspace_id = ${workspaceId} and m.role = 'CLIENT')`,
    })
    .from(messages)
    .leftJoin(profiles, eq(profiles.id, messages.authorId))
    .where(and(...where))
    .orderBy(desc(messages.createdAt))
    .limit(limit);
  return rows.reverse().map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

export type Thread = { key: string; kind: "general" | "project" | "client"; id: string | null; title: string; subtitle: string | null; lastAt: string | null; lastBody: string | null; count: number };

/** Conversations the user can see, most recent first. RLS filters projects/clients. */
export async function listThreads(tx: Tx, workspaceId: string, includeGeneral: boolean): Promise<Thread[]> {
  const last = (filter: SQL) =>
    sql`(select json_build_object('at', m.created_at, 'body', m.body, 'count', count(*) over ()) from messages m where ${filter} order by m.created_at desc limit 1)`;

  const [projectRows, clientRows, general] = await Promise.all([
    tx
      .select({ id: projects.id, name: projects.name, client: clients.company, last: last(sql`m.project_id = "projects"."id"`) })
      .from(projects)
      .leftJoin(clients, eq(clients.id, projects.clientId))
      .where(and(eq(projects.workspaceId, workspaceId), sql`${projects.status} not in ('CANCELLED')`))
      .orderBy(asc(projects.name)),
    tx
      .select({ id: clients.id, name: sql<string>`coalesce(${clients.company}, ${clients.name})`, last: last(sql`m.client_id = "clients"."id" and m.project_id is null`) })
      .from(clients)
      .where(and(eq(clients.workspaceId, workspaceId), sql`${clients.status} <> 'ARCHIVED'`)),
    includeGeneral
      ? tx.execute<{ at: string | null; body: string | null; count: string }>(
          sql`select max(created_at) as at, (array_agg(body order by created_at desc))[1] as body, count(*) as count from messages where workspace_id = ${workspaceId} and project_id is null and client_id is null`,
        )
      : Promise.resolve([]),
  ]);

  type Last = { at: string; body: string; count: number } | null;
  const threads: Thread[] = [];
  if (includeGeneral) {
    const g = general[0];
    threads.push({ key: "general", kind: "general", id: null, title: "General", subtitle: "Team only", lastAt: g?.at ?? null, lastBody: g?.body ?? null, count: Number(g?.count ?? 0) });
  }
  for (const p of projectRows) {
    const l = p.last as Last;
    threads.push({ key: `project:${p.id}`, kind: "project", id: p.id, title: p.name, subtitle: p.client, lastAt: l?.at ?? null, lastBody: l?.body ?? null, count: l?.count ?? 0 });
  }
  for (const c of clientRows) {
    const l = c.last as Last;
    threads.push({ key: `client:${c.id}`, kind: "client", id: c.id, title: c.name, subtitle: "Client conversation", lastAt: l?.at ?? null, lastBody: l?.body ?? null, count: l?.count ?? 0 });
  }
  return threads;
}
