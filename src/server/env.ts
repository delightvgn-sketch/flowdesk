import "server-only";

/**
 * Centralised access to server-side configuration. Values are read lazily so a
 * missing optional integration (AI, storage) degrades that feature instead of
 * crashing the whole app at import time.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}. See .env.example.`);
  }
  return value;
}

export const env = {
  databaseUrl: () => required("DATABASE_URL"),
  supabaseUrl: () => process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseServiceRoleKey: () => process.env.SUPABASE_SERVICE_ROLE_KEY,
  appUrl: () =>
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000"),
  aiModel: () => process.env.AI_MODEL ?? "anthropic/claude-sonnet-5.5",
  cronSecret: () => process.env.CRON_SECRET,
  demoEnabled: () => process.env.DEMO_MODE !== "false",
};

export const features = {
  storage: () => Boolean(env.supabaseUrl() && env.supabaseServiceRoleKey()),
  /** AI Gateway authenticates with an API key locally or an OIDC token on Vercel. */
  ai: () => Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN),
};
