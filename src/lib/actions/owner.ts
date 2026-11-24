"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { withOwner } from "@/lib/mobile-auth";
import { asSystem, asUser } from "@/lib/db";
import { OWNER_COOKIE, isDemoMode } from "@/lib/supabase/env";
import { getHouseContractor } from "@/lib/house-contractor";
import { getSettings } from "@/lib/settings";
import { budgetLabel, checkServiceArea, generateWorkList, normalizeAnswers, STEP_KEYS, stepValid, type ServiceArea, type WizardAnswers } from "@/lib/project-wizard";

/** Creates the homeowner's project from the questionnaire, with an auto-generated work list. */
export async function createOwnerProject(input: WizardAnswers): Promise<{ id: string }> {
  const a = normalizeAnswers(input);
  for (const step of STEP_KEYS) {
    if (!stepValid(step, a)) throw new Error("Some answers are missing. Go back and check each step.");
  }
  const areas = await asSystem((q) => q<ServiceArea>(`select country, city, region, zip_prefixes from service_areas where active`));
  const inArea = checkServiceArea(a, areas);
  if (!inArea.ok) throw new Error(inArea.message);
  const items = generateWorkList(a);
  const metric = a.country === "UK";
  // Every project goes to the one contractor in the system (Northline Builders).
  const contractorEmail = (await getHouseContractor())?.email.toLowerCase() ?? null;

  const id = await withOwner(async (q, me) => {
    if (me.role !== "owner") throw new Error("Only homeowners can create projects here.");
    const address = [a.address.trim(), a.city.trim(), a.postcode.trim()].filter(Boolean).join(", ");
    const details = {
      type: a.type,
      country: a.country,
      floors: a.floors,
      area: a.area,
      area_unit: metric ? "m²" : "sq ft",
      bedrooms: a.bedrooms,
      bathrooms: a.bathrooms,
      garage: a.garage,
      extra_rooms: a.extraRooms,
      finish: a.finish,
      start: a.start,
      budget: budgetLabel(a),
      custom_items: a.customItems,
      stages: a.stages,
      notes: a.notes.trim() || null,
      // finishing the app questionnaire counts as sending the list to the contractor
      submitted_at: new Date().toISOString(),
    };
    const [job] = await q<{ id: string }>(
      `insert into jobs (title, description, site_address, currency, units, created_by, owner_id, contractor_email, details)
       values ($1,$2,$3,$4,$5,$6,$6,$7,$8) returning id`,
      [
        a.title.trim().slice(0, 120),
        a.notes.trim() || null,
        address,
        metric ? "GBP" : "USD",
        metric ? "metric" : "imperial",
        me.id,
        contractorEmail,
        details,
      ],
    );
    for (const [i, it] of items.entries()) {
      await q(
        `insert into scope_items (job_id, stage, trade, description, quantity, unit, notes, sort_order) values ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [job.id, it.stage, it.trade, it.description, it.quantity, it.unit, it.notes, i],
      );
    }
    await q(`insert into audit_log (job_id, actor_id, action, details) values ($1,$2,'project_created',$3)`, [
      job.id,
      me.id,
      { source: "owner_app", items: items.length },
    ]);
    if (contractorEmail) await q(`select link_job_parties($1)`, [job.id]);
    const [linked] = await q<{ contractor_id: string | null }>(`select contractor_id from jobs where id = $1`, [job.id]);
    if (linked?.contractor_id)
      await q(
        `insert into notifications (job_id, profile_id, kind, title, body, link) values ($1,$2,'new_project',$3,$4,$5)`,
        [job.id, linked.contractor_id, `New project from ${me.full_name || me.email}`, `${a.title.trim()} · ${items.length} work items`, `/jobs/${job.id}`],
      );
    return job.id;
  });
  return { id };
}

/* ---------------------------------------------------------------- mobile sign-in (demo) */

const cookieOpts = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24 * 30 };

export async function mobileDemoLogin(formData: FormData) {
  if (!isDemoMode) redirect("/login?next=/m");
  const id = String(formData.get("user_id") ?? "");
  const rows = await asSystem((q) => q<{ role: string }>(`select role from profiles where id = $1`, [id]));
  if (rows[0]?.role !== "owner") redirect("/m/login");
  (await cookies()).set(OWNER_COOKIE, id, cookieOpts);
  await asUser(id, (q) => q(`select claim_job_invites()`));
  redirect("/m");
}

export async function mobileSignOut() {
  if (isDemoMode) {
    (await cookies()).delete(OWNER_COOKIE);
    redirect("/m/welcome");
  }
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/m/welcome");
}

/** Owner sends the finished work list to the contractor; the list is locked for the owner after this. */
export async function submitToContractor(formData: FormData) {
  const jobId = String(formData.get("job_id") ?? "");
  await withOwner(async (q, me) => {
    const [job] = await q<{ items: number }>(
      `select (select count(*)::int from scope_items s where s.job_id = j.id) as items
         from jobs j where j.id = $1 and j.owner_id = $2 and j.status = 'draft'`,
      [jobId, me.id],
    );
    if (!job) throw new Error("This project can't be sent right now.");
    if (!job.items) throw new Error("Add at least one work item first.");
    await q(
      `update jobs set details = coalesce(details, '{}'::jsonb) || jsonb_build_object('submitted_at', now()) where id = $1`,
      [jobId],
    );
    await q(`insert into audit_log (job_id, actor_id, action) values ($1, $2, 'work_list_sent_to_contractor')`, [jobId, me.id]);
    await q(
      `insert into notifications (job_id, profile_id, kind, title, body, link)
       select j.id, j.contractor_id, 'new_project', 'New project from ' || $2, j.title || ' · ' || $3 || ' work items', '/jobs/' || j.id
         from jobs j where j.id = $1 and j.contractor_id is not null`,
      [jobId, me.full_name || me.email, job.items],
    );
  });
  refresh();
}

/* ---------------------------------------------------------------- mobile log in / sign up */

export type MobileAuthState = { error?: string; message?: string } | undefined;

export async function mobileLogin(_prev: MobileAuthState, formData: FormData): Promise<MobileAuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email) return { error: "Enter your email." };

  if (isDemoMode) {
    const rows = await asSystem((q) => q<{ id: string; role: string }>(`select id, role from profiles where lower(email) = $1`, [email]));
    if (!rows[0]) return { error: "No account with that email. Create one below." };
    if (rows[0].role !== "owner") return { error: "That's a contractor account. Use the web app instead." };
    (await cookies()).set(OWNER_COOKIE, rows[0].id, cookieOpts);
    await asUser(rows[0].id, (q) => q(`select claim_job_invites()`));
    redirect("/m");
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  if (data.user?.user_metadata?.role === "contractor") {
    await supabase.auth.signOut();
    return { error: "That's a contractor account. Use the web app instead." };
  }
  await supabase.rpc("claim_job_invites");
  redirect("/m");
}

export async function mobileSignup(_prev: MobileAuthState, formData: FormData): Promise<MobileAuthState> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!fullName) return { error: "Enter your name." };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Enter a valid email." };

  if (isDemoMode) {
    let id: string;
    try {
      id = await asSystem(async (q) => {
        const rows = await q<{ id: string }>(`insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`, [
          email,
          { role: "owner", full_name: fullName },
        ]);
        return rows[0].id;
      });
    } catch {
      return { error: "That email already has an account. Log in instead." };
    }
    (await cookies()).set(OWNER_COOKIE, id, cookieOpts);
    await asUser(id, (q) => q(`select claim_job_invites()`));
    redirect("/m");
  }

  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { role: "owner", full_name: fullName }, emailRedirectTo: `${siteUrl}/auth/callback` },
  });
  if (error) return { error: error.message };
  if (!data.session) return { message: "Check your email to confirm your account, then log in." };
  await supabase.rpc("claim_job_invites");
  redirect("/m");
}

/** Homeowner opened their notifications: mark them all read. */
export async function markOwnerNotificationsRead() {
  await withOwner((q, me) => q(`update notifications set read_at = now() where profile_id = $1 and read_at is null`, [me.id]));
}

/* ---------------------------------------------------------------- feedback after paying */

export type FeedbackInput = {
  jobId: string;
  ratings: { inviteId: string; stars: number; reason: string }[];
  comment: string;
};

/** Homeowner rates each part of the work. Below 4 stars needs a reason. */
export async function submitFeedback(input: FeedbackInput): Promise<{ error?: string }> {
  const ratings = input.ratings.filter((r) => r.stars >= 1);
  if (!ratings.length) return { error: "Tap the stars for at least one part of the work." };
  const threshold = (await getSettings()).rating_threshold;
  for (const r of ratings) {
    if (!Number.isInteger(r.stars) || r.stars < 1 || r.stars > 5) return { error: "Ratings are 1 to 5 stars." };
    if (r.stars < threshold && !r.reason.trim()) return { error: `Please tell us why for any part rated below ${threshold} stars.` };
  }
  try {
    await withOwner((q) =>
      q(`select submit_project_feedback($1, $2::jsonb, $3)`, [
        input.jobId,
        JSON.stringify(ratings.map((r) => ({ invite_id: r.inviteId, stars: r.stars, reason: r.reason.trim() }))),
        input.comment,
      ]),
    );
  } catch (e) {
    return { error: e instanceof Error ? e.message.replace(/^.*?ERROR:\s*/, "") : "Could not send feedback." };
  }
  refresh();
  return {};
}
