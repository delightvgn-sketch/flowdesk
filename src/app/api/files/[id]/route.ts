import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getAppContext, NoWorkspaceError, UnauthorizedError } from "@/server/auth/session";
import { files } from "@/server/db/schema";
import { signedDownloadUrl } from "@/server/storage";

/**
 * Authorised download. The file row is read under RLS — if the caller can't see
 * it, it doesn't exist — and then a 60-second signed Storage URL is issued.
 */
export async function GET(request: Request, { params }: RouteContext<"/api/files/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const ctx = await getAppContext();
    const file = await ctx.db((tx) =>
      tx.query.files.findFirst({ where: and(eq(files.id, id), eq(files.workspaceId, ctx.workspace.id)) }),
    );
    if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const inline = new URL(request.url).searchParams.get("inline") === "1";
    const url = await signedDownloadUrl(file.storagePath, inline ? "" : file.name);
    return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof UnauthorizedError || error instanceof NoWorkspaceError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[flowdesk] download failed", error);
    return NextResponse.json({ error: "Download failed" }, { status: 500 });
  }
}
