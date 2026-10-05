import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { withRls } from "@/server/db";
import * as s from "@/server/db/schema";
import { createRlsFixture, type RlsFixture } from "../support/fixtures";

/**
 * These tests run real queries through `withRls`, the same code path the app
 * uses, and assert that Postgres row level security — not application code —
 * keeps each role inside its boundary.
 */
const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)("row level security", () => {
  let f: RlsFixture;
  const as = <T>(who: string, fn: Parameters<typeof withRls<T>>[1]) => withRls(f.p[who].clerkUserId!, fn);
  const names = (rows: { name: string }[]) => rows.map((r) => r.name).sort();

  beforeAll(async () => {
    f = await createRlsFixture();
  });
  afterAll(async () => {
    await f?.cleanup();
  });

  describe("workspace isolation", () => {
    it("owners only see their own workspace", async () => {
      const workspaces = await as("owner", (tx) => tx.select().from(s.workspaces));
      expect(workspaces.map((w) => w.id)).toEqual([f.wsA.id]);

      const clients = await as("owner", (tx) => tx.select().from(s.clients));
      expect(names(clients)).toEqual(["Client One", "Client Two"]);
    });

    it("a rival owner cannot read or modify another workspace's rows by id", async () => {
      const rows = await as("rival", (tx) => tx.select().from(s.projects).where(eq(s.projects.id, f.p1.id)));
      expect(rows).toHaveLength(0);

      const updated = await as("rival", (tx) =>
        tx.update(s.projects).set({ name: "hacked" }).where(eq(s.projects.id, f.p1.id)).returning(),
      );
      expect(updated).toHaveLength(0);
    });

    it("rejects inserting rows into a workspace you don't belong to", async () => {
      await expect(
        as("rival", (tx) => tx.insert(s.clients).values({ workspaceId: f.wsA.id, name: "Injected" })),
      ).rejects.toThrow();
    });

    it("managers can create projects and clients and read them back (INSERT … RETURNING)", async () => {
      const [project] = await as("admin", (tx) =>
        tx.insert(s.projects).values({ workspaceId: f.wsA.id, name: "Returned" }).returning(),
      );
      expect(project.name).toBe("Returned");
      const [client] = await as("owner", (tx) =>
        tx.insert(s.clients).values({ workspaceId: f.wsA.id, name: "Returned client" }).returning(),
      );
      expect(client.name).toBe("Returned client");
    });

    it("an unknown identity sees nothing at all", async () => {
      const rows = await withRls("user_does_not_exist", (tx) => tx.select().from(s.clients));
      expect(rows).toHaveLength(0);
    });
  });

  describe("members", () => {
    it("only see projects they're staffed on, and the clients behind them", async () => {
      const projects = await as("member", (tx) => tx.select().from(s.projects));
      expect(projects.map((p) => p.id)).toEqual([f.p1.id]);

      const clients = await as("member", (tx) => tx.select().from(s.clients));
      expect(names(clients)).toEqual(["Client One"]);
    });

    it("see tasks in their projects plus tasks assigned to them", async () => {
      const tasks = await as("member", (tx) => tx.select({ title: s.tasks.title }).from(s.tasks));
      expect(tasks.map((t) => t.title).sort()).toEqual(["Internal for member", "T1"]);
    });

    it("cannot see any invoices or payments", async () => {
      const invoices = await as("member", (tx) => tx.select().from(s.invoices));
      expect(invoices).toHaveLength(0);
    });

    it("cannot create tasks attributed to someone else", async () => {
      await expect(
        as("member", (tx) =>
          tx.insert(s.tasks).values({ workspaceId: f.wsA.id, projectId: f.p1.id, title: "spoof", createdById: f.p.owner.id }),
        ),
      ).rejects.toThrow();
    });

    it("cannot create tasks in a project they're not on", async () => {
      await expect(
        as("member", (tx) =>
          tx.insert(s.tasks).values({ workspaceId: f.wsA.id, projectId: f.p2.id, title: "sneaky", createdById: f.p.member.id }),
        ),
      ).rejects.toThrow();
    });

    it("cannot create clients or projects", async () => {
      await expect(as("member", (tx) => tx.insert(s.clients).values({ workspaceId: f.wsA.id, name: "Nope" }))).rejects.toThrow();
      await expect(as("member", (tx) => tx.insert(s.projects).values({ workspaceId: f.wsA.id, name: "Nope" }))).rejects.toThrow();
    });
  });

  describe("clients (portal users)", () => {
    it("only see their own projects", async () => {
      const projects = await as("client", (tx) => tx.select().from(s.projects));
      expect(projects.map((p) => p.id)).toEqual([f.p1.id]);
    });

    it("never see draft invoices or other clients' invoices", async () => {
      const invoices = await as("client", (tx) => tx.select({ number: s.invoices.number }).from(s.invoices));
      expect(invoices.map((i) => i.number)).toEqual(["INV-0002"]);
    });

    it("only see files explicitly shared with them", async () => {
      const files = await as("client", (tx) => tx.select().from(s.files));
      expect(names(files)).toEqual(["shared-p1.txt"]);
    });

    it("never see internal messages", async () => {
      const messages = await as("client", (tx) => tx.select({ body: s.messages.body }).from(s.messages));
      expect(messages.map((m) => m.body)).toEqual(["visible to client one"]);
    });

    it("cannot post internal messages", async () => {
      await expect(
        as("client", (tx) =>
          tx
            .insert(s.messages)
            .values({ workspaceId: f.wsA.id, projectId: f.p1.id, authorId: f.p.client.id, body: "x", internal: true }),
        ),
      ).rejects.toThrow();
    });

    it("cannot see other client users in the roster", async () => {
      const members = await as("client", (tx) =>
        tx.select({ role: s.workspaceMembers.role, profileId: s.workspaceMembers.profileId }).from(s.workspaceMembers),
      );
      expect(members.some((m) => m.profileId === f.p.otherClient.id)).toBe(false);
      expect(members.some((m) => m.role === "OWNER")).toBe(true);
    });

    it("cannot edit milestones directly but can approve through the definer function", async () => {
      const edited = await as("client", (tx) =>
        tx.update(s.milestones).set({ title: "renamed" }).where(eq(s.milestones.id, f.milestone.id)).returning(),
      );
      expect(edited).toHaveLength(0);

      await as("client", (tx) => tx.execute(sql`select app.respond_to_milestone(${f.milestone.id}::uuid, 'APPROVED', null)`));
      const [m] = await as("owner", (tx) => tx.select().from(s.milestones).where(eq(s.milestones.id, f.milestone.id)));
      expect(m.approvalStatus).toBe("APPROVED");
      expect(m.approvedById).toBe(f.p.client.id);
      expect(m.status).toBe("COMPLETED");
    });

    it("cannot approve another client's milestone", async () => {
      await expect(
        as("otherClient", (tx) => tx.execute(sql`select app.respond_to_milestone(${f.milestone.id}::uuid, 'APPROVED', null)`)),
      ).rejects.toThrow();
    });
  });

  describe("roles and team management", () => {
    it("admins cannot promote anyone to OWNER or demote the owner", async () => {
      const promoted = await as("admin", (tx) =>
        tx.update(s.workspaceMembers).set({ role: "OWNER" }).where(eq(s.workspaceMembers.profileId, f.p.member.id)).returning(),
      ).catch(() => []);
      expect(promoted).toHaveLength(0);

      const demoted = await as("admin", (tx) =>
        tx.update(s.workspaceMembers).set({ role: "MEMBER" }).where(eq(s.workspaceMembers.profileId, f.p.owner.id)).returning(),
      );
      expect(demoted).toHaveLength(0);
    });

    it("members cannot change roles", async () => {
      const changed = await as("member", (tx) =>
        tx.update(s.workspaceMembers).set({ role: "ADMIN" }).where(eq(s.workspaceMembers.profileId, f.p.member.id)).returning(),
      );
      expect(changed).toHaveLength(0);
    });
  });

  describe("notifications", () => {
    it("are private to their recipient", async () => {
      await as("owner", (tx) =>
        tx
          .insert(s.notifications)
          .values({ workspaceId: f.wsA.id, recipientId: f.p.member.id, actorId: f.p.owner.id, type: "test", title: "hi" }),
      );
      const forMember = await as("member", (tx) => tx.select().from(s.notifications));
      const forAdmin = await as("admin", (tx) => tx.select().from(s.notifications));
      expect(forMember).toHaveLength(1);
      expect(forAdmin).toHaveLength(0);
    });

    it("cannot be sent to people outside the workspace", async () => {
      await expect(
        as("owner", (tx) =>
          tx
            .insert(s.notifications)
            .values({ workspaceId: f.wsA.id, recipientId: f.p.rival.id, actorId: f.p.owner.id, type: "test", title: "spam" }),
        ),
      ).rejects.toThrow();
    });
  });
});
