import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEMO_COOKIE, isDemoMode } from "@/lib/supabase/env";
import { asUser } from "@/lib/db";
import type { Profile } from "@/lib/types";

/** The signed-in user's id, from the demo cookie or the Supabase session. */
export async function getUserId(): Promise<string | null> {
  if (isDemoMode) {
    return (await cookies()).get(DEMO_COOKIE)?.value ?? null;
  }
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return (data?.claims?.sub as string | undefined) ?? null;
}

/**
 * Data access layer entry point: redirects to /login when signed out.
 * Call inside a <Suspense> boundary.
 */
export const requireProfile = cache(async function requireProfile(): Promise<Profile> {
  const userId = await getUserId();
  if (!userId) redirect("/login");

  const rows = await asUser(userId, (q) =>
    q<Profile>(`select id, role, full_name, company_name, email, phone from profiles where id = $1`, [userId]),
  ).catch((e) => {
    // Next.js stops background pre-renders early; that is expected, not a failure.
    if (!String(e?.message ?? e).includes("During prerendering")) console.error("[auth] could not load profile:", e);
    return [];
  });

  if (!rows[0]) redirect("/login");
  // Homeowners use the phone app only; the web dashboard is for Northline Builders.
  if (rows[0].role === "owner") redirect(isDemoMode ? "/simulator" : "/m");
  return rows[0];
});

/** Run queries as the signed-in user (RLS applies). */
export async function withProfile<T>(fn: (q: Parameters<Parameters<typeof asUser>[1]>[0], profile: Profile) => Promise<T>) {
  const profile = await requireProfile();
  return asUser(profile.id, (q) => fn(q, profile));
}
