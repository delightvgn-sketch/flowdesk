import type { Metadata } from "next";

import { FileList } from "@/features/files/components/file-list";
import { FileUploader } from "@/features/files/components/file-uploader";
import { listFiles } from "@/features/files/queries";
import { requireClientContext } from "@/server/auth/session";
import { features } from "@/server/env";

export const metadata: Metadata = { title: "Files" };

export default async function PortalFilesPage() {
  const ctx = await requireClientContext();
  const files = await ctx.db((tx) => listFiles(tx, ctx.workspace.id, {}));
  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Files</h1>
          <p className="text-sm text-muted-foreground">Deliverables shared with you, and files you&apos;ve sent the team.</p>
        </div>
        {features.storage() && <FileUploader links={{ clientId: ctx.clientId }} />}
      </div>
      <FileList
        files={files}
        currentProfileId={ctx.profile.id}
        canOrganize={false}
        canDeleteAny={false}
        emptyTitle="No files yet"
        emptyDescription="When the team shares a file with you, it shows up here."
      />
    </>
  );
}
