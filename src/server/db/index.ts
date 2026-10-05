import "server-only";

import { sql } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "@/server/env";
import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;
/** A transaction handle — what every data-access function receives. */
export type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

const globalForDb = globalThis as unknown as { pgClient?: ReturnType<typeof postgres>; db?: Database };

/**
 * The connection is created lazily on first use, so importing this module
 * (e.g. while `next build` collects route config) never needs DATABASE_URL.
 */
function getDb(): Database {
  if (globalForDb.db) return globalForDb.db;
  const client =
    globalForDb.pgClient ??
    postgres(env.databaseUrl(), {
      // Supabase's transaction pooler (port 6543) does not support prepared statements.
      prepare: false,
      max: process.env.NODE_ENV === "production" ? 5 : 10,
      idle_timeout: 20,
    });
  const db = drizzle(client, { schema });
  if (process.env.NODE_ENV !== "production") globalForDb.pgClient = client;
  globalForDb.db = db;
  return db;
}

/**
 * Privileged connection. It bypasses row level security, so it is only used for
 * the handful of operations that cannot be expressed as the signed-in user:
 * linking a Clerk identity to a profile, creating a workspace, accepting an
 * invitation, rendering a public share link, the daily cron and seeding demo data.
 */
export const adminDb: Database = new Proxy({} as Database, {
  get(_target, prop) {
    const db = getDb();
    const value = Reflect.get(db, prop, db);
    return typeof value === "function" ? value.bind(db) : value;
  },
});

/**
 * Run `fn` inside a transaction that Postgres treats as the given Clerk user.
 * Every policy in drizzle/0001_rls_policies.sql then applies, so a bug in
 * application code cannot leak another workspace's rows.
 */
export async function withRls<T>(clerkUserId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return adminDb.transaction(async (tx) => {
    const claims = JSON.stringify({ sub: clerkUserId, role: "authenticated" });
    await tx.execute(sql`select set_config('request.jwt.claims', ${claims}, true), set_config('role', 'authenticated', true)`);
    return fn(tx);
  });
}
