"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { asSystem, asUser } from "@/lib/db";
import { DEMO_COOKIE, isDemoMode } from "@/lib/supabase/env";
import type { AuthState } from "./auth-actions";

const cookieOpts = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24 * 30 };

export async function demoLogin(formData: FormData) {
  if (!isDemoMode) throw new Error("Demo login is disabled");
  const id = String(formData.get("user_id") ?? "");
  const exists = await asSystem((q) => q(`select 1 from profiles where id = $1`, [id]));
  if (!exists.length) redirect("/login");

  (await cookies()).set(DEMO_COOKIE, id, cookieOpts);
  await asUser(id, (q) => q(`select claim_job_invites()`));
  redirect("/dashboard");
}

export async function demoSignup(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (!isDemoMode) return { error: "Demo sign-up is disabled" };
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const companyName = String(formData.get("company_name") ?? "").trim();
  const role = "owner"; // one contractor only (Northline Builders); new sign-ups are homeowners
  if (!fullName) return { error: "Enter your name." };
  if (!email.includes("@")) return { error: "Enter a valid email." };

  let id: string;
  try {
    id = await asSystem(async (q) => {
      const rows = await q<{ id: string }>(
        `insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`,
        [email, { role, full_name: fullName, company_name: companyName }],
      );
      return rows[0].id;
    });
  } catch {
    return { error: "That email already has an account. Pick it on the log-in page." };
  }

  (await cookies()).set(DEMO_COOKIE, id, cookieOpts);
  await asUser(id, (q) => q(`select claim_job_invites()`));
  redirect("/dashboard");
}

export async function demoSignOut() {
  (await cookies()).delete(DEMO_COOKIE);
  redirect("/login");
}
