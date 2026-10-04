/**
 * Reset and seed the demo workspace.
 *   npm run db:seed
 */
import { config } from "dotenv";
config({ path: [".env.local", ".env"], quiet: true });

import { createClient } from "@supabase/supabase-js";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "../src/server/db/schema";
import { seedDemo } from "../src/server/seed/seed-demo";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const client = postgres(url, { prepare: false, max: 1 });
  const db = drizzle(client, { schema });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const storage = supabaseUrl && serviceKey ? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } }) : null;

  console.log("Seeding demo workspace…");
  const started = Date.now();
  await seedDemo(db, { storage, log: (m) => console.log(`  ${m}`) });
  console.log(`Seeded in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
