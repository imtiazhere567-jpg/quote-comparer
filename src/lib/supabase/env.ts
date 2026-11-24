export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

/**
 * Supabase mode needs the API keys (for auth) AND a DATABASE_URL (for queries).
 * Otherwise the app runs in demo mode on a local database with demo log-ins.
 */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey && process.env.DATABASE_URL);
export const isDemoMode = !isSupabaseConfigured;

export const DEMO_COOKIE = "demo_uid";

/** Demo: the homeowner phone app has its own log-in, so it never clashes with the contractor's web log-in. */
export const OWNER_COOKIE = "demo_owner_uid";
