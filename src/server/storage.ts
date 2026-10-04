import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { env } from "@/server/env";
import { STORAGE_BUCKET } from "@/server/seed/seed-demo";

export { STORAGE_BUCKET };

let client: SupabaseClient | null | undefined;

/**
 * Service-role Supabase client used exclusively for Storage, on the server.
 * The browser never receives this key: uploads use short-lived signed upload
 * URLs and downloads use short-lived signed download URLs, both issued only
 * after the request has been authorised (see features/files/actions.ts).
 */
export function storageAdmin(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = env.supabaseUrl();
  const key = env.supabaseServiceRoleKey();
  client = url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
  return client;
}

export function requireStorage(): SupabaseClient {
  const storage = storageAdmin();
  if (!storage) throw new Error("File storage is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  return storage;
}

/** `fileName` forces a download with that name; an empty string serves inline. */
export async function signedDownloadUrl(path: string, fileName: string, expiresIn = 60) {
  const { data, error } = await requireStorage()
    .storage.from(STORAGE_BUCKET)
    .createSignedUrl(path, expiresIn, fileName ? { download: fileName } : undefined);
  if (error || !data) throw error ?? new Error("Could not sign URL");
  return data.signedUrl;
}

export async function removeObjects(paths: string[]) {
  if (paths.length === 0) return;
  const storage = storageAdmin();
  if (!storage) return;
  await storage.storage.from(STORAGE_BUCKET).remove(paths);
}
