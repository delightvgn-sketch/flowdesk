import type { Metadata } from "next";
import Link from "next/link";
import { FolderKanban } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { ProgressBar } from "@/components/shared/misc";
import { StatusBadge } from "@/components/shared/status-badge";
import { portalProjects } from "@/features/portal/queries";
import { formatDate } from "@/lib/dates";
import { requireClientContext } from "@/server/auth/session";

export const metadata: Metadata = { title: "Projects" };

export default async function PortalProjectsPage() {
  const ctx = await requireClientContext();
  const projects = await ctx.db((tx) => portalProjects(tx, ctx.workspace.id));
  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Projects</h1>
      {projects.length === 0 ? (
        <EmptyState icon={FolderKanban} title="No projects yet" />
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-xs">
          {projects.map((p) => (
            <li key={p.id}>
              <Link
                href={`/portal/projects/${p.id}`}
                className="flex flex-col gap-2 px-5 py-4 hover:bg-muted/40 sm:flex-row sm:items-center sm:gap-6"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{p.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {p.dueDate ? `Target ${formatDate(p.dueDate)}` : "No target date"}
                  </span>
                </span>
                <span className="flex w-full items-center gap-2 sm:w-48">
                  <ProgressBar value={p.progress} label={`${p.name} progress`} />
                  <span className="tabular text-xs">{p.progress}%</span>
                </span>
                <StatusBadge kind="project" value={p.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
