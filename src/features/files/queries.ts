import "server-only";

import { and, asc, desc, eq, ilike, isNull, like, type SQL } from "drizzle-orm";

import type { Tx } from "@/server/db";
import { files, folders, profiles, projects } from "@/server/db/schema";

export type FileRow = {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
  sharedWithClient: boolean;
  folderId: string | null;
  projectId: string | null;
  projectName: string | null;
  uploadedById: string | null;
  uploadedByName: string | null;
};

const escape = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export async function listFiles(
  tx: Tx,
  workspaceId: string,
  f: { folderId?: string | null; projectId?: string; clientId?: string; q?: string; type?: string; limit?: number },
): Promise<FileRow[]> {
  const where: SQL[] = [eq(files.workspaceId, workspaceId)];
  if (f.q) where.push(ilike(files.name, escape(f.q)));
  if (f.projectId) where.push(eq(files.projectId, f.projectId));
  if (f.clientId) where.push(eq(files.clientId, f.clientId));
  if (f.type === "image") where.push(like(files.mimeType, "image/%"));
  else if (f.type === "pdf") where.push(eq(files.mimeType, "application/pdf"));
  else if (f.type === "document") where.push(like(files.mimeType, "application/%"));
  else if (f.type === "text") where.push(like(files.mimeType, "text/%"));
  // Folder browsing only applies when not searching/filtering by link.
  if (f.folderId !== undefined && !f.q && !f.projectId && !f.clientId) {
    where.push(f.folderId ? eq(files.folderId, f.folderId) : isNull(files.folderId));
  }

  return tx
    .select({
      id: files.id,
      name: files.name,
      mimeType: files.mimeType,
      sizeBytes: files.sizeBytes,
      createdAt: files.createdAt,
      sharedWithClient: files.sharedWithClient,
      folderId: files.folderId,
      projectId: files.projectId,
      projectName: projects.name,
      uploadedById: files.uploadedById,
      uploadedByName: profiles.fullName,
    })
    .from(files)
    .leftJoin(projects, eq(projects.id, files.projectId))
    .leftJoin(profiles, eq(profiles.id, files.uploadedById))
    .where(and(...where))
    .orderBy(desc(files.createdAt))
    .limit(f.limit ?? 200);
}

export async function listFolders(tx: Tx, workspaceId: string, parentId: string | null) {
  return tx
    .select({ id: folders.id, name: folders.name, createdAt: folders.createdAt })
    .from(folders)
    .where(and(eq(folders.workspaceId, workspaceId), parentId ? eq(folders.parentId, parentId) : isNull(folders.parentId)))
    .orderBy(asc(folders.name));
}

export async function allFolders(tx: Tx, workspaceId: string) {
  return tx
    .select({ id: folders.id, name: folders.name, parentId: folders.parentId })
    .from(folders)
    .where(eq(folders.workspaceId, workspaceId))
    .orderBy(asc(folders.name));
}

/** Breadcrumb trail from the root to `folderId`. */
export function folderTrail(all: { id: string; name: string; parentId: string | null }[], folderId: string | null) {
  const trail: { id: string; name: string }[] = [];
  let current = all.find((f) => f.id === folderId);
  while (current && trail.length < 20) {
    trail.unshift({ id: current.id, name: current.name });
    current = all.find((f) => f.id === current!.parentId);
  }
  return trail;
}
