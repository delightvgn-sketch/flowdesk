import "server-only";

import { and, count, eq, sql } from "drizzle-orm";

import type { Tx } from "@/server/db";
import { projects, tasks } from "@/server/db/schema";

/**
 * Keep `projects.progress` in step with its tasks (done / total). Projects
 * without tasks keep their manually set progress.
 */
export async function recomputeProjectProgress(tx: Tx, projectId: string | null | undefined) {
  if (!projectId) return;
  const [row] = await tx
    .select({ total: count(), done: sql<number>`count(*) filter (where ${tasks.status} = 'DONE')`.mapWith(Number) })
    .from(tasks)
    .where(eq(tasks.projectId, projectId));
  if (!row || row.total === 0) return;
  await tx
    .update(projects)
    .set({ progress: Math.round((row.done / row.total) * 100) })
    .where(and(eq(projects.id, projectId)));
}
