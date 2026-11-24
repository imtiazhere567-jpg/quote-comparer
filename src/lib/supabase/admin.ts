import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./env";

/**
 * Service-role client that BYPASSES Row Level Security.
 * Only for sub-contractor magic-link flows, after the invite token has been verified.
 * Never import this into a Client Component.
 */
export function createAdminClient() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("SUPABASE_SECRET_KEY is not set");
  return createClient(supabaseUrl, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
