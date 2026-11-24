"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { withProfile } from "@/lib/auth";
import { withOwner } from "@/lib/mobile-auth";
import type { Q } from "@/lib/db";
import { compareBids } from "@/lib/compare";
import { getInvites, getJob, getRates, getScope } from "@/lib/queries";
import { templateItems, type UnitSystem } from "@/lib/scope-templates";
import type { Profile } from "@/lib/types";
import { getHouseContractor } from "@/lib/house-contractor";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const optional = (f: FormData, k: string) => str(f, k) || null;

async function log(q: Q, jobId: string, actor: Profile, action: string, details: Record<string, unknown> = {}) {
  await q(`insert into audit_log (job_id, actor_id, action, details) values ($1,$2,$3,$4)`, [jobId, actor.id, action, details]);
}

async function requireContractorJob(q: Q, profile: Profile, jobId: string) {
  const job = await getJob(q, jobId);
  if (!job || job.contractor_id !== profile.id) throw new Error("Only this job's contractor can do that.");
  return job;
}

// ---------------------------------------------------------------- jobs

export async function createJob(formData: FormData) {
  const title = str(formData, "title");
  if (!title) throw new Error("Title is required");
  const units = (str(formData, "units") === "metric" ? "metric" : "imperial") as UnitSystem;
  const currency = str(formData, "currency") === "GBP" ? "GBP" : "USD";
  const typedEmail = optional(formData, "other_email")?.toLowerCase() ?? null;
  const useTemplate = formData.get("template") === "on";
  const house = await getHouseContractor();

  const jobId = await withProfile(async (q, me) => {
    if (me.role !== "owner" && me.role !== "contractor") throw new Error("Not allowed");
    const isOwner = me.role === "owner";
    // Owners don't pick a contractor: every project goes to Northline Builders.
    const otherEmail = isOwner ? (house?.email.toLowerCase() ?? null) : typedEmail;
    const [job] = await q<{ id: string }>(
      `insert into jobs (title, description, site_address, currency, units, created_by, owner_id, contractor_id, owner_email, contractor_email)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id`,
      [
        title,
        optional(formData, "description"),
        optional(formData, "site_address"),
        currency,
        units,
        me.id,
        isOwner ? me.id : null,
        isOwner ? null : me.id,
        isOwner ? null : otherEmail,
        isOwner ? otherEmail : null,
      ],
    );
    if (useTemplate) {
      for (const it of templateItems(units)) {
        await q(
          `insert into scope_items (job_id, stage, trade, description, quantity, unit, sort_order) values ($1,$2,$3,$4,$5,$6,$7)`,
          [job.id, it.stage, it.trade, it.description, it.quantity, it.unit, it.sort_order],
        );
      }
    }
    await log(q, job.id, me, "job_created", { title });
    if (otherEmail) await q(`select link_job_parties($1)`, [job.id]);
    return job.id;
  });
  redirect(`/jobs/${jobId}`);
}

export async function updateJobDetails(formData: FormData) {
  const jobId = str(formData, "job_id");
  await withProfile(async (q, me) => {
    const job = await getJob(q, jobId);
    if (!job) throw new Error("Job not found");
    const otherEmail = optional(formData, "other_email")?.toLowerCase() ?? null;
    await q(
      `update jobs set title = $2, description = $3, site_address = $4,
              contractor_email = case when contractor_id is null and $5 then $6 else contractor_email end,
              owner_email      = case when owner_id is null and $7 then $6 else owner_email end
        where id = $1`,
      [
        jobId,
        str(formData, "title") || job.title,
        optional(formData, "description"),
        optional(formData, "site_address"),
        me.role === "owner",
        otherEmail,
        me.role === "contractor",
      ],
    );
    await q(`select link_job_parties($1)`, [jobId]);
  });
  refresh();
}

// ---------------------------------------------------------------- scope

function itemFields(formData: FormData) {
  const quantity = Number(str(formData, "quantity"));
  if (!Number.isFinite(quantity) || quantity < 0) throw new Error("Quantity must be a positive number");
  const description = str(formData, "description");
  if (!description) throw new Error("Description is required");
  return {
    stage: str(formData, "stage") || "General",
    trade: optional(formData, "trade"),
    description,
    quantity,
    unit: str(formData, "unit") || "each",
    notes: optional(formData, "notes"),
  };
}

export async function addScopeItem(formData: FormData) {
  const jobId = str(formData, "job_id");
  const f = itemFields(formData);
  await withProfile(async (q) => {
    const [{ next }] = await q<{ next: number }>(
      `select coalesce(max(sort_order), -1) + 1 as next from scope_items where job_id = $1`,
      [jobId],
    );
    const rows = await q(
      `insert into scope_items (job_id, stage, trade, description, quantity, unit, notes, sort_order)
       values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
      [jobId, f.stage, f.trade, f.description, f.quantity, f.unit, f.notes, next],
    );
    if (!rows.length) throw new Error("You can't edit this scope right now.");
  });
  refresh();
}

export async function updateScopeItem(formData: FormData) {
  const id = str(formData, "item_id");
  const f = itemFields(formData);
  await withProfile(async (q) => {
    const rows = await q(
      `update scope_items set stage=$2, trade=$3, description=$4, quantity=$5, unit=$6, notes=$7 where id=$1 returning id`,
      [id, f.stage, f.trade, f.description, f.quantity, f.unit, f.notes],
    );
    if (!rows.length) throw new Error("You can't edit this scope right now.");
  });
  refresh();
}

export async function deleteScopeItem(formData: FormData) {
  const id = str(formData, "item_id");
  await withProfile(async (q) => {
    await q(`delete from scope_items where id = $1`, [id]);
  });
  refresh();
}

export async function addTemplateItems(formData: FormData) {
  const jobId = str(formData, "job_id");
  await withProfile(async (q) => {
    const job = await getJob(q, jobId);
    if (!job) throw new Error("Job not found");
    const [{ next }] = await q<{ next: number }>(
      `select coalesce(max(sort_order), -1) + 1 as next from scope_items where job_id = $1`,
      [jobId],
    );
    for (const it of templateItems(job.units)) {
      await q(
        `insert into scope_items (job_id, stage, trade, description, quantity, unit, sort_order) values ($1,$2,$3,$4,$5,$6,$7)`,
        [jobId, it.stage, it.trade, it.description, it.quantity, it.unit, next + it.sort_order],
      );
    }
  });
  refresh();
}

// ---------------------------------------------------------------- sub-contractors & invites

export async function addSubcontractor(formData: FormData) {
  const name = str(formData, "name");
  if (!name) throw new Error("Name is required");
  const trades = str(formData, "trades").split(",").map((t) => t.trim()).filter(Boolean);
  await withProfile(async (q, me) => {
    if (me.role !== "contractor") throw new Error("Only contractors have sub-contractors");
    await q(
      `insert into subcontractors (contractor_id, name, company_name, trades, email, phone) values ($1,$2,$3,$4,$5,$6)`,
      [me.id, name, optional(formData, "company_name"), trades, optional(formData, "email"), optional(formData, "phone")],
    );
  });
  refresh();
}

export async function createInvites(formData: FormData) {
  const jobId = str(formData, "job_id");
  const subIds = formData.getAll("sub_ids").map(String).filter(Boolean);
  const stages = formData.getAll("stages").map(String).filter(Boolean);
  const message = optional(formData, "message");
  if (!subIds.length) throw new Error("Pick at least one sub-contractor");

  await withProfile(async (q, me) => {
    const job = await requireContractorJob(q, me, jobId);
    const scope = await getScope(q, jobId);
    if (!scope.length) throw new Error("Add work items before inviting bids");
    const itemIds = stages.length ? scope.filter((s) => stages.includes(s.stage)).map((s) => s.id) : null;

    for (const subId of subIds) {
      await q(
        `insert into bid_invites (job_id, subcontractor_id, scope_item_ids, message)
         values ($1,$2,$3,$4)
         on conflict (job_id, subcontractor_id)
         do update set scope_item_ids = excluded.scope_item_ids, message = excluded.message,
                       expires_at = now() + interval '14 days',
                       status = case when bid_invites.status in ('declined','expired') then 'sent' else bid_invites.status end`,
        [jobId, subId, itemIds, message],
      );
    }
    if (job.status === "draft") await q(`update jobs set status = 'bidding' where id = $1`, [jobId]);
    await log(q, jobId, me, "bids_requested", { subcontractors: subIds.length, stages });
    // simulated email with the private link
    const company = me.company_name ?? me.full_name;
    await q(
      `insert into notifications (job_id, subcontractor_id, kind, title, body, link)
       select $1, i.subcontractor_id, 'bid_request', $2, $3, '/bid/' || i.token
         from bid_invites i where i.job_id = $1 and i.subcontractor_id = any($4::uuid[])`,
      [
        jobId,
        `Bid request from ${company}: ${job.title}`,
        `${company} would like your prices for ${job.title}${job.site_address ? ` (${job.site_address})` : ""}. Open the link, enter a rate for each item and send it back.`,
        subIds,
      ],
    );
  });
  refresh();
}

export async function removeInvite(formData: FormData) {
  const inviteId = str(formData, "invite_id");
  await withProfile(async (q) => {
    await q(`delete from bid_invites where id = $1 and not exists (select 1 from awards a where a.invite_id = $1 and a.status in ('planned','offered','accepted'))`, [inviteId]);
  });
  refresh();
}

// ---------------------------------------------------------------- awards

export type AwardPlan = {
  jobId: string;
  /** "single": the whole job to one complete bidder. "items": one bidder per item. */
  mode: "single" | "items";
  inviteId?: string;
  /** itemId -> inviteId (mode "items") */
  choices?: Record<string, string>;
};

/**
 * Replaces all open offers with the given plan in one go.
 * Work a sub-contractor has already ACCEPTED is kept as it is.
 */
export async function sendAwardPlan(plan: AwardPlan) {
  await withProfile(async (q, me) => {
    await requireContractorJob(q, me, plan.jobId);
    const scope = await getScope(q, plan.jobId);
    const cmp = compareBids(scope, await getInvites(q, plan.jobId), await getRates(q, plan.jobId));
    const accepted = await q<{ scope_item_id: string | null }>(
      `select scope_item_id from awards where job_id = $1 and status = 'accepted'`,
      [plan.jobId],
    );
    const lockedWhole = accepted.some((a) => a.scope_item_id === null);
    const lockedItems = new Set(accepted.map((a) => a.scope_item_id).filter(Boolean) as string[]);
    if (lockedWhole) throw new Error("A sub-contractor has already accepted the whole job. Reset the awards to change it.");

    await q(`update awards set status = 'withdrawn' where job_id = $1 and status in ('planned','offered')`, [plan.jobId]);

    if (plan.mode === "single") {
      if (lockedItems.size) throw new Error("Some items are already accepted, so award the rest item by item.");
      const bidder = cmp.bidders.find((b) => b.inviteId === plan.inviteId);
      if (!bidder?.complete) throw new Error("That bid doesn't cover the whole job");
      await q(`insert into awards (job_id, invite_id, amount, status) values ($1,$2,$3,'planned')`, [plan.jobId, bidder.inviteId, bidder.total]);
      await log(q, plan.jobId, me, "awarded_whole_job", { invite_id: bidder.inviteId, amount: bidder.total });
    } else {
      let n = 0;
      for (const c of cmp.items) {
        if (lockedItems.has(c.item.id)) continue;
        const inviteId = plan.choices?.[c.item.id];
        if (!inviteId) continue;
        const rate = c.rates.get(inviteId);
        if (rate === undefined) throw new Error(`No bid for “${c.item.description}” from that sub-contractor`);
        await q(`insert into awards (job_id, scope_item_id, invite_id, unit_rate, amount, status) values ($1,$2,$3,$4,$5,'planned')`, [
          plan.jobId,
          c.item.id,
          inviteId,
          rate,
          rate * c.item.quantity,
        ]);
        n++;
      }
      if (!n && !lockedItems.size) throw new Error("Choose at least one price to award");
      await log(q, plan.jobId, me, "awarded_items", { items: n });
    }
    await q(`update jobs set status = 'awarding' where id = $1 and status in ('draft','bidding')`, [plan.jobId]);
  });
  refresh();
}

export async function withdrawAllAwards(formData: FormData) {
  const jobId = str(formData, "job_id");
  await withProfile(async (q, me) => {
    await requireContractorJob(q, me, jobId);
    await q(`update awards set status = 'withdrawn' where job_id = $1 and status in ('planned','offered','accepted')`, [jobId]);
    await log(q, jobId, me, "awards_withdrawn");
  });
  refresh();
}

// ---------------------------------------------------------------- owner quote

export type QuoteDraft = {
  jobId: string;
  markupPercent: number;
  message: string;
  lines: { scopeItemId: string; cost: number }[];
  send: boolean;
};

export async function saveOwnerQuote(draft: QuoteDraft) {
  const markup = Math.max(0, Math.min(500, Number(draft.markupPercent) || 0));
  await withProfile(async (q, me) => {
    const job = await requireContractorJob(q, me, draft.jobId);
    const scope = await getScope(q, draft.jobId);
    const costs = new Map(draft.lines.map((l) => [l.scopeItemId, Number(l.cost)]));
    const hasCost = (id: string) => Number.isFinite(costs.get(id)) && costs.get(id)! >= 0;
    if (draft.send && scope.some((s) => !hasCost(s.id))) {
      throw new Error("Every line needs a cost before sending");
    }

    const [latest] = await q<{ id: string; version: number; status: string }>(
      `select id, version, status from owner_quotes where job_id = $1 order by version desc limit 1`,
      [draft.jobId],
    );
    if (latest && (latest.status === "sent" || latest.status === "accepted")) {
      throw new Error("This quote has already been sent.");
    }

    let quoteId: string;
    if (latest?.status === "draft") {
      quoteId = latest.id;
      await q(`update owner_quotes set markup_percent = $2, message = $3 where id = $1`, [quoteId, markup, draft.message || null]);
      await q(`delete from owner_quote_lines where quote_id = $1`, [quoteId]);
    } else {
      const [row] = await q<{ id: string }>(
        `insert into owner_quotes (job_id, version, markup_percent, message) values ($1,$2,$3,$4) returning id`,
        [draft.jobId, (latest?.version ?? 0) + 1, markup, draft.message || null],
      );
      quoteId = row.id;
    }

    for (const [i, item] of scope.entries()) {
      if (!hasCost(item.id)) continue; // drafts may be incomplete
      const unitCost = costs.get(item.id)! / (item.quantity || 1);
      const unitPrice = Math.round(unitCost * (1 + markup / 100) * 100) / 100;
      const total = Math.round(costs.get(item.id)! * (1 + markup / 100) * 100) / 100;
      await q(
        `insert into owner_quote_lines (quote_id, scope_item_id, stage, description, quantity, unit, unit_price, total, sort_order)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [quoteId, item.id, item.stage, item.description, item.quantity, item.unit, unitPrice, total, i],
      );
    }

    if (draft.send) {
      await q(`update owner_quotes set status = 'sent', sent_at = now() where id = $1`, [quoteId]);
      if (job.owner_id)
        await q(
          `insert into notifications (job_id, profile_id, kind, title, body, link) values ($1,$2,'quote_sent',$3,$4,$5)`,
          [job.id, job.owner_id, "Your quote is ready", `${me.company_name ?? me.full_name} sent you a quote for ${job.title}.`, `/m/projects/${job.id}`],
        );
      await q(`update jobs set status = 'quoted' where id = $1`, [job.id]);
      await log(q, job.id, me, "owner_quote_sent", { quote_id: quoteId, markup });
    }
  });
  refresh();
}

export async function respondToQuote(formData: FormData) {
  const quoteId = str(formData, "quote_id");
  const status = str(formData, "status");
  if (status !== "accepted" && !optional(formData, "response")) throw new Error("Tell us what you'd like changed.");
  await withOwner(async (q) => {
    await q(`select respond_to_owner_quote($1, $2::quote_status, $3)`, [quoteId, status, optional(formData, "response")]);
  });
  refresh();
}
