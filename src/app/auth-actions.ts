"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { DEMO_COOKIE, isDemoMode } from "@/lib/supabase/env";

export type AuthState = { error?: string; message?: string } | undefined;

function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  // Link any jobs someone invited this email to.
  await supabase.rpc("claim_job_invites");
  redirect(safeNext(formData.get("next")));
}

export async function signup(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const companyName = String(formData.get("company_name") ?? "").trim();
  const role = "owner"; // one contractor only (Northline Builders); new sign-ups are homeowners

  if (!fullName) return { error: "Enter your name." };
  if (!email) return { error: "Enter your email." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { role, full_name: fullName, company_name: companyName },
      emailRedirectTo: `${siteUrl}/auth/callback`,
    },
  });
  if (error) return { error: error.message };

  // Email confirmation is on: no session yet.
  if (!data.session) {
    return { message: "Check your email to confirm your account, then log in." };
  }

  await supabase.rpc("claim_job_invites");
  redirect("/dashboard");
}

export async function signOut() {
  if (isDemoMode) {
    (await cookies()).delete(DEMO_COOKIE);
    redirect("/login");
  }
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
