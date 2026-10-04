import { sql } from "drizzle-orm";

import { adminDb } from "@/server/db";
import { features } from "@/server/env";

export const dynamic = "force-dynamic";

/** Liveness + configuration check used after deploys. Exposes no secrets. */
export async function GET() {
  let database = false;
  try {
    await adminDb.execute(sql`select 1`);
    database = true;
  } catch {
    database = false;
  }
  return Response.json(
    { ok: database, database, storage: features.storage(), ai: features.ai() },
    { status: database ? 200 : 503 },
  );
}
