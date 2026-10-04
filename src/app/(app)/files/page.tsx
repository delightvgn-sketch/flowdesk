import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, HardDrive } from "lucide-react";

import { ClearFilters, FilterSelect, SearchInput, Toolbar } from "@/components/shared/list-toolbar";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { param } from "@/components/shared/pagination";
import { FileList } from "@/features/files/components/file-list";
import { FileUploader } from "@/features/files/components/file-uploader";
import { FolderCard, NewFolderButton } from "@/features/files/components/folder-controls";
import { allFolders, folderTrail, listFiles, listFolders } from "@/features/files/queries";
import { projectOptions } from "@/features/projects/queries";
import { isManagerRole } from "@/lib/permissions";
import { requireStaffContext } from "@/server/auth/session";
import { features } from "@/server/env";

export const metadata: Metadata = { title: "Files" };

const TYPES = [
  { value: "document", label: "Documents" },
  { value: "pdf", label: "PDFs" },
  { value: "image", label: "Images" },
  { value: "text", label: "Text & CSV" },
];

export default async function FilesPage({ searchParams }: PageProps<"/files">) {
  const ctx = await requireStaffContext();
  const sp = await searchParams;
  const folderId = param(sp.folder) ?? null;
  const q = param(sp.q);
  const projectId = param(sp.project);
  const type = param(sp.type);
  const searching = !!(q || projectId || type);

  const [files, folders, everyFolder, projects] = await ctx.db((tx) =>
    Promise.all([
      listFiles(tx, ctx.workspace.id, { folderId, q, projectId, type }),
      searching ? Promise.resolve([]) : listFolders(tx, ctx.workspace.id, folderId),
      allFolders(tx, ctx.workspace.id),
      projectOptions(tx, ctx.workspace.id),
    ]),
  );
  const trail = folderTrail(everyFolder, folderId);
  const storageReady = features.storage();

  return (
    <>
      <PageHeader
        title="Files"
        description="Briefs, designs, contracts and deliverables — linked to the clients and projects they belong to."
        actions={
          storageReady && (
            <>
              <NewFolderButton parentId={folderId} />
              <FileUploader links={{ folderId }} />
            </>
          )
        }
      />

      {!storageReady && (
        <div className="mb-6 rounded-lg border border-warning/30 bg-warning-soft/60 px-4 py-3 text-sm">
          File storage isn&apos;t configured. Set <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code className="font-mono text-xs">SUPABASE_SERVICE_ROLE_KEY</code> to enable uploads.
        </div>
      )}

      <Toolbar>
        <SearchInput placeholder="Search all files…" />
        <FilterSelect param="project" label="Project" options={projects.map((p) => ({ value: p.id, label: p.label }))} />
        <FilterSelect param="type" label="Type" options={TYPES} />
        <ClearFilters keys={["q", "project", "type"]} />
      </Toolbar>

      {!searching && (
        <nav aria-label="Folder" className="mb-4 flex flex-wrap items-center gap-1 text-sm">
          <Link href="/files" className={trail.length ? "text-muted-foreground hover:text-foreground" : "font-medium"}>
            All files
          </Link>
          {trail.map((f, i) => (
            <span key={f.id} className="flex items-center gap-1">
              <ChevronRight className="size-3.5 text-subtle-foreground" aria-hidden />
              {i === trail.length - 1 ? (
                <span className="font-medium" aria-current="page">{f.name}</span>
              ) : (
                <Link href={`/files?folder=${f.id}`} className="text-muted-foreground hover:text-foreground">{f.name}</Link>
              )}
            </span>
          ))}
        </nav>
      )}

      {folders.length > 0 && (
        <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {folders.map((f) => (
            <FolderCard key={f.id} folder={f} canManage />
          ))}
        </div>
      )}

      {files.length === 0 && folders.length === 0 ? (
        <EmptyState
          icon={HardDrive}
          title={searching ? "No files match" : folderId ? "This folder is empty" : "No files yet"}
          description={searching ? "Try a different search or filter." : "Upload briefs, designs, contracts and deliverables to keep everything in one place."}
          action={!searching && storageReady && <FileUploader links={{ folderId }} />}
        />
      ) : (
        files.length > 0 && (
          <FileList
            files={files}
            currentProfileId={ctx.profile.id}
            canOrganize
            canDeleteAny={isManagerRole(ctx.role)}
            folders={everyFolder.map((f) => ({ id: f.id, name: f.name }))}
            highlightId={param(sp.highlight)}
          />
        )
      )}
    </>
  );
}
