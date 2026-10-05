import { inArray, sql } from "drizzle-orm";

import { adminDb } from "@/server/db";
import * as s from "@/server/db/schema";

/**
 * Builds two isolated workspaces with one user per role, so tests can assert
 * what each role can and cannot see. Everything is namespaced with a random
 * run id and removed again by `cleanup()`.
 */
export async function createRlsFixture() {
  const run = crypto.randomUUID().slice(0, 8);
  const user = (name: string) => ({ clerkUserId: `user_test_${name}_${run}`, email: `${name}-${run}@rls.test`, fullName: name });

  const profileRows = await adminDb
    .insert(s.profiles)
    .values(["owner", "admin", "member", "otherMember", "client", "otherClient", "rival", "rivalClient"].map(user))
    .returning();
  const p = Object.fromEntries(profileRows.map((r) => [r.fullName, r])) as Record<string, s.Profile>;

  const [wsA, wsB] = await adminDb
    .insert(s.workspaces)
    .values([
      { name: `Studio A ${run}`, slug: `studio-a-${run}` },
      { name: `Studio B ${run}`, slug: `studio-b-${run}` },
    ])
    .returning();

  const [c1, c2, cB] = await adminDb
    .insert(s.clients)
    .values([
      { workspaceId: wsA.id, name: "Client One", company: "One Ltd", status: "ACTIVE" },
      { workspaceId: wsA.id, name: "Client Two", company: "Two Ltd", status: "ACTIVE" },
      { workspaceId: wsB.id, name: "Rival Client", company: "Rival Ltd", status: "ACTIVE" },
    ])
    .returning();

  await adminDb.insert(s.workspaceMembers).values([
    { workspaceId: wsA.id, profileId: p.owner.id, role: "OWNER" },
    { workspaceId: wsA.id, profileId: p.admin.id, role: "ADMIN" },
    { workspaceId: wsA.id, profileId: p.member.id, role: "MEMBER" },
    { workspaceId: wsA.id, profileId: p.otherMember.id, role: "MEMBER" },
    { workspaceId: wsA.id, profileId: p.client.id, role: "CLIENT", clientId: c1.id },
    { workspaceId: wsA.id, profileId: p.otherClient.id, role: "CLIENT", clientId: c2.id },
    { workspaceId: wsB.id, profileId: p.rival.id, role: "OWNER" },
    { workspaceId: wsB.id, profileId: p.rivalClient.id, role: "CLIENT", clientId: cB.id },
  ]);

  const [p1, p2, pB] = await adminDb
    .insert(s.projects)
    .values([
      { workspaceId: wsA.id, clientId: c1.id, name: "P1 (client one, member staffed)" },
      { workspaceId: wsA.id, clientId: c2.id, name: "P2 (client two, member not staffed)" },
      { workspaceId: wsB.id, clientId: cB.id, name: "PB (rival)" },
    ])
    .returning();

  await adminDb.insert(s.projectMembers).values([
    { workspaceId: wsA.id, projectId: p1.id, profileId: p.member.id },
    { workspaceId: wsA.id, projectId: p2.id, profileId: p.otherMember.id },
  ]);

  const [t1, t2, tInternal] = await adminDb
    .insert(s.tasks)
    .values([
      { workspaceId: wsA.id, projectId: p1.id, title: "T1", createdById: p.owner.id },
      { workspaceId: wsA.id, projectId: p2.id, title: "T2", createdById: p.owner.id },
      { workspaceId: wsA.id, projectId: null, title: "Internal for member", assigneeId: p.member.id, createdById: p.owner.id },
      { workspaceId: wsB.id, projectId: pB.id, title: "TB", createdById: p.rival.id },
    ])
    .returning();

  const [invDraft, invSent, invOther] = await adminDb
    .insert(s.invoices)
    .values([
      {
        workspaceId: wsA.id,
        clientId: c1.id,
        number: "INV-0001",
        status: "DRAFT",
        issueDate: "2026-10-01",
        dueDate: "2026-10-15",
        total: 1000,
      },
      {
        workspaceId: wsA.id,
        clientId: c1.id,
        number: "INV-0002",
        status: "SENT",
        issueDate: "2026-10-01",
        dueDate: "2026-10-15",
        total: 2000,
      },
      {
        workspaceId: wsA.id,
        clientId: c2.id,
        number: "INV-0003",
        status: "SENT",
        issueDate: "2026-10-01",
        dueDate: "2026-10-15",
        total: 3000,
      },
      {
        workspaceId: wsB.id,
        clientId: cB.id,
        number: "INV-0001",
        status: "SENT",
        issueDate: "2026-10-01",
        dueDate: "2026-10-15",
        total: 4000,
      },
    ])
    .returning();

  const fileRow = (name: string, extra: Partial<typeof s.files.$inferInsert>) => ({
    workspaceId: wsA.id,
    name,
    storagePath: `${wsA.id}/${run}/${name}`,
    mimeType: "text/plain",
    sizeBytes: 10,
    uploadedById: p.owner.id,
    ...extra,
  });
  await adminDb
    .insert(s.files)
    .values([
      fileRow("shared-p1.txt", { projectId: p1.id, clientId: c1.id, sharedWithClient: true }),
      fileRow("internal-p1.txt", { projectId: p1.id, clientId: c1.id, sharedWithClient: false }),
      fileRow("shared-p2.txt", { projectId: p2.id, clientId: c2.id, sharedWithClient: true }),
    ]);

  await adminDb.insert(s.messages).values([
    { workspaceId: wsA.id, projectId: p1.id, authorId: p.owner.id, body: "visible to client one" },
    { workspaceId: wsA.id, projectId: p1.id, authorId: p.owner.id, body: "internal note", internal: true },
    { workspaceId: wsA.id, projectId: p2.id, authorId: p.owner.id, body: "client two thread" },
  ]);

  const [milestone] = await adminDb
    .insert(s.milestones)
    .values({ workspaceId: wsA.id, projectId: p1.id, title: "Design", approvalStatus: "PENDING", status: "CURRENT" })
    .returning();

  async function cleanup() {
    await adminDb.delete(s.workspaces).where(inArray(s.workspaces.id, [wsA.id, wsB.id]));
    await adminDb.delete(s.profiles).where(sql`${s.profiles.email} like ${`%-${run}@rls.test`}`);
  }

  return { run, p, wsA, wsB, c1, c2, cB, p1, p2, pB, t1, t2, tInternal, invDraft, invSent, invOther, milestone, cleanup };
}

export type RlsFixture = Awaited<ReturnType<typeof createRlsFixture>>;
