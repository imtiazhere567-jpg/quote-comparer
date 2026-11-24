import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getUserId } from "@/lib/auth";
import { isDemoMode, OWNER_COOKIE } from "@/lib/supabase/env";
import { asUser, type Q } from "@/lib/db";
import type { Profile } from "@/lib/types";

/** The homeowner app is for owners only. Anyone else is sent to the app's own sign-in screen. */
export const requireOwner = cache(async function requireOwner(): Promise<Profile> {
  const userId = await getOwnerUserId();
  if (!userId) redirect("/m/welcome");
  const rows = await asUser(userId, (q) =>
    q<Profile>(`select id, role, full_name, company_name, email, phone from profiles where id = $1`, [userId]),
  ).catch(() => []);
  if (rows[0]?.role !== "owner") redirect("/m/login");
  return rows[0];
});

export async function withOwner<T>(fn: (q: Q, me: Profile) => Promise<T>) {
  const me = await requireOwner();
  return asUser(me.id, (q) => fn(q, me));
}

/** The homeowner signed in to the phone app. */
export async function getOwnerUserId(): Promise<string | null> {
  if (isDemoMode) return (await cookies()).get(OWNER_COOKIE)?.value ?? null;
  return getUserId();
}
