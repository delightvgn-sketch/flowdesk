"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fileUploadSchema, folderSchema, idSchema } from "@/lib/validation";
import { createAction } from "@/server/actions/safe-action";
import type { AppContext } from "@/server/auth/session";
import type { Tx } from "@/server/db";
import { clients, files, folders, projectMembers, projects, tasks } from "@/server/db/schema";
import { NotFoundError, UserFacingError } from "@/server/errors";
import { features } from "@/server/env";
import { logActivity, managerIds, notify } from "@/server/services/activity";
import { removeObjects, requireStorage, STORAGE_BUCKET } from "@/server/storage";

function safeFileName(name: string) {
  return name.normalize("NFKD").replace(/[^\w.\- ]+/g, "").replace(/\s+/g, "-").slice(-120) || "file";
}

function revalidateFileViews(projectId?: string | null, clientId?: string | null) {
  revalidatePath("/files");
  if (projectId) revalidatePath(`/projects/${projectId}`);
  if (clientId) revalidatePath(`/clients/${clientId}`);
  revalidatePath("/portal", "layout");
}

/**
 * Resolve and authorise the links a file will have. Everything is re-read
 * under RLS, so a user can only attach files to things they can see.
 */
async function resolveLinks(tx: Tx, ctx: AppContext, input: { projectId: string | null; clientId: string | null; taskId: string | null; folderId: string | null }) {
  let { projectId, clientId } = input;
  if (input.taskId) {
    const task = await tx.query.tasks.findFirst({ where: and(eq(tasks.id, input.taskId), eq(tasks.workspaceId, ctx.workspace.id)) });
    if (!task) throw new NotFoundError("Task");
    projectId = task.projectId;
  }
  if (projectId) {
    const project = await tx.query.projects.findFirst({ where: and(eq(projects.id, projectId), eq(projects.workspaceId, ctx.workspace.id)) });
    if (!project) throw new NotFoundError("Project");
    clientId = project.clientId;
  } else if (clientId) {
    const client = await tx.query.clients.findFirst({ where: and(eq(clients.id, clientId), eq(clients.workspaceId, ctx.workspace.id)) });
    if (!client) throw new NotFoundError("Client");
  }
  if (input.folderId) {
    if (ctx.role === "CLIENT") throw new UserFacingError("Clients can't upload into folders.");
    const folder = await tx.query.folders.findFirst({ where: and(eq(folders.id, input.folderId), eq(folders.workspaceId, ctx.workspace.id)) });
    if (!folder) throw new NotFoundError("Folder");
  }
  if (ctx.role === "CLIENT") {
    if (!projectId && clientId !== ctx.clientId) clientId = ctx.clientId;
  }
  return { projectId, clientId, taskId: input.taskId, folderId: input.folderId };
}

/** Step 1: authorise and hand out a short-lived signed upload URL for a server-chosen path. */
export const prepareUpload = createAction({ schema: fileUploadSchema, permission: "file:upload" }, async (input, ctx) => {
  if (!features.storage()) throw new UserFacingError("File storage isn't configured on this deployment.");
  await ctx.db((tx) => resolveLinks(tx, ctx, input));

  const path = `${ctx.workspace.id}/${crypto.randomUUID()}/${safeFileName(input.name)}`;
  const { data, error } = await requireStorage().storage.from(STORAGE_BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new UserFacingError("Couldn't start the upload. Please try again.");
  return { path, signedUrl: data.signedUrl };
});

/** Step 2: verify the uploaded object really exists and matches, then record it. */
export const confirmUpload = createAction(
  { schema: fileUploadSchema.extend({ path: z.string().min(1).max(400) }), permission: "file:upload" },
  async ({ path, ...input }, ctx) => {
    if (!path.startsWith(`${ctx.workspace.id}/`) || path.includes("..")) throw new UserFacingError("Invalid upload.");

    const storage = requireStorage().storage.from(STORAGE_BUCKET);
    const folder = path.split("/").slice(0, -1).join("/");
    const { data: listing } = await storage.list(folder);
    const object = listing?.find((o) => `${folder}/${o.name}` === path);
    const size = Number(object?.metadata?.size ?? 0);
    if (!object || size <= 0 || size !== input.sizeBytes) {
      await removeObjects([path]);
      throw new UserFacingError("The upload didn't complete. Please try again.");
    }

    const file = await ctx.db(async (tx) => {
      const links = await resolveLinks(tx, ctx, input);
      const [row] = await tx
        .insert(files)
        .values({
          workspaceId: ctx.workspace.id,
          name: input.name,
          storagePath: path,
          mimeType: input.mimeType,
          sizeBytes: size,
          sharedWithClient: ctx.role === "CLIENT" ? true : input.sharedWithClient,
          uploadedById: ctx.profile.id,
          ...links,
        })
        .returning();
      await logActivity(tx, ctx, { action: "file.uploaded", entityType: "file", entityId: row.id, entityLabel: row.name, projectId: row.projectId, clientId: row.clientId });

      const team = row.projectId
        ? (await tx.select({ id: projectMembers.profileId }).from(projectMembers).where(eq(projectMembers.projectId, row.projectId))).map((m) => m.id)
        : [];
      await notify(tx, ctx, {
        recipientIds: ctx.role === "CLIENT" ? [...team, ...(await managerIds(tx, ctx))] : team,
        category: "files",
        type: "file.uploaded",
        title: `${ctx.profile.fullName} uploaded ${row.name}`,
        href: row.projectId ? `/projects/${row.projectId}?tab=files` : "/files",
      });
      return row;
    }).catch(async (error) => {
      await removeObjects([path]);
      throw error;
    });

    revalidateFileViews(file.projectId, file.clientId);
    return { id: file.id };
  },
);

export const deleteFile = createAction({ schema: idSchema, permission: "file:upload" }, async ({ id }, ctx) => {
  const row = await ctx.db(async (tx) => {
    const [deleted] = await tx.delete(files).where(and(eq(files.id, id), eq(files.workspaceId, ctx.workspace.id))).returning();
    if (!deleted) throw new UserFacingError("You can only delete files you uploaded.");
    await logActivity(tx, ctx, { action: "file.deleted", entityType: "file", entityLabel: deleted.name, projectId: deleted.projectId, clientId: deleted.clientId });
    return deleted;
  });
  await removeObjects([row.storagePath]);
  revalidateFileViews(row.projectId, row.clientId);
});

export const updateFile = createAction(
  {
    schema: idSchema.extend({
      sharedWithClient: z.boolean().optional(),
      folderId: z.uuid().nullable().optional(),
      name: z.string().trim().min(1).max(200).optional(),
    }),
    permission: "file:organize",
  },
  async ({ id, ...changes }, ctx) => {
    const row = await ctx.db(async (tx) => {
      if (changes.folderId) {
        const folder = await tx.query.folders.findFirst({ where: and(eq(folders.id, changes.folderId), eq(folders.workspaceId, ctx.workspace.id)) });
        if (!folder) throw new NotFoundError("Folder");
      }
      const [updated] = await tx.update(files).set(changes).where(and(eq(files.id, id), eq(files.workspaceId, ctx.workspace.id))).returning();
      if (!updated) throw new NotFoundError("File");
      return updated;
    });
    revalidateFileViews(row.projectId, row.clientId);
  },
);

export const createFolder = createAction({ schema: folderSchema, permission: "file:organize" }, async (input, ctx) => {
  const [row] = await ctx.db((tx) =>
    tx.insert(folders).values({ ...input, workspaceId: ctx.workspace.id, createdById: ctx.profile.id }).returning(),
  );
  revalidatePath("/files");
  return { id: row.id };
});

export const renameFolder = createAction({ schema: idSchema.extend({ name: folderSchema.shape.name }), permission: "file:organize" }, async ({ id, name }, ctx) => {
  const [row] = await ctx.db((tx) => tx.update(folders).set({ name }).where(and(eq(folders.id, id), eq(folders.workspaceId, ctx.workspace.id))).returning());
  if (!row) throw new NotFoundError("Folder");
  revalidatePath("/files");
});

/** Deleting a folder keeps its files: they move up to the parent folder. */
export const deleteFolder = createAction({ schema: idSchema, permission: "file:organize" }, async ({ id }, ctx) => {
  await ctx.db(async (tx) => {
    const folder = await tx.query.folders.findFirst({ where: and(eq(folders.id, id), eq(folders.workspaceId, ctx.workspace.id)) });
    if (!folder) throw new NotFoundError("Folder");
    await tx.update(files).set({ folderId: folder.parentId }).where(eq(files.folderId, id));
    await tx.update(folders).set({ parentId: folder.parentId }).where(eq(folders.parentId, id));
    const deleted = await tx.delete(folders).where(eq(folders.id, id)).returning();
    if (deleted.length === 0) throw new UserFacingError("Only managers or the folder's creator can delete it.");
  });
  revalidatePath("/files");
});

