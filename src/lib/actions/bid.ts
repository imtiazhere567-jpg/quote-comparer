"use server";

import { refresh } from "next/cache";
import { asSystem, type Q } from "@/lib/db";

/**
 * Sub-contractor actions. Subs don't log in, so these run as the system
 * (RLS bypassed) and every query is scoped by the verified invite token.
 */

type InviteRow = { id: string; job_id: string; status: string; expired: boolean; sub_name: string; scope_item_ids: string[] | null };

async function loadInvite(q: Q, token: string) {
  if (!/^[0-9a-f]{48}$/.test(token)) throw new Error("Invalid link");
  const [inv] = await q<InviteRow>(
    `select i.id, i.job_id, i.status, i.expires_at < now() as expired, s.name as sub_name, i.scope_item_ids
       from bid_invites i join subcontractors s on s.id = i.subcontractor_id
      where i.token = $1`,
    [token],
  );
  if (!inv) throw new Error("This link is no longer valid");
  return inv;
}

async function jobOpenForBids(q: Q, jobId: string) {
  const [job] = await q<{ status: string }>(`select status from jobs where id = $1`, [jobId]);
  return job && ["draft", "bidding", "awarding"].includes(job.status);
}

export type BidSubmission = {
  token: string;
  rates: { scopeItemId: string; unitRate: number | null }[];
  notes: string;
};

export async function submitBid(sub: BidSubmission) {
  await asSystem(async (q) => {
    const inv = await loadInvite(q, sub.token);
    if (inv.expired) throw new Error("This bid request has expired");
    if (!(await jobOpenForBids(q, inv.job_id))) throw new Error("This job is no longer taking bids");
    const live = await q(`select 1 from awards where invite_id = $1 and status in ('offered','accepted')`, [inv.id]);
    if (live.length) throw new Error("You've already been offered work on this bid, so it can't be changed");

    const allowed = new Set(
      (await q<{ id: string }>(`select id from scope_items where job_id = $1`, [inv.job_id]))
        .map((r) => r.id)
        .filter((id) => !inv.scope_item_ids?.length || inv.scope_item_ids.includes(id)),
    );

    await q(`delete from bid_rates where invite_id = $1`, [inv.id]);
    let priced = 0;
    for (const r of sub.rates) {
      if (!allowed.has(r.scopeItemId) || r.unitRate === null) continue;
      const rate = Number(r.unitRate);
      if (!Number.isFinite(rate) || rate < 0) continue;
      await q(`insert into bid_rates (invite_id, scope_item_id, unit_rate) values ($1,$2,$3)`, [inv.id, r.scopeItemId, rate]);
      priced++;
    }
    if (!priced) throw new Error("Enter a rate for at least one item");

    await q(`update bid_invites set status = 'submitted', submitted_at = now(), sub_notes = $2 where id = $1`, [
      inv.id,
      sub.notes.trim() || null,
    ]);
    await q(`insert into audit_log (job_id, actor_label, action, details) values ($1,$2,'bid_submitted',$3)`, [
      inv.job_id,
      inv.sub_name,
      { invite_id: inv.id, items_priced: priced },
    ]);
    // notify the contractor: who sent it, and how many are still missing
    const [c] = await q<{ contractor_id: string; title: string; total: number; done: number }>(
      `select j.contractor_id, j.title,
              (select count(*)::int from bid_invites x where x.job_id = j.id and x.status <> 'declined') as total,
              (select count(*)::int from bid_invites x where x.job_id = j.id and x.status = 'submitted') as done
         from jobs j where j.id = $1`,
      [inv.job_id],
    );
    if (c?.contractor_id) {
      const left = c.total - c.done;
      await q(
        `insert into notifications (job_id, profile_id, kind, title, body, link) values ($1,$2,$3,$4,$5,$6)`,
        [
          inv.job_id,
          c.contractor_id,
          left === 0 ? "all_bids_in" : "bid_received",
          left === 0 ? `All bids are in: ${c.title}` : `${inv.sub_name} sent a bid`,
          left === 0
            ? `${c.done} of ${c.total} received. You can compare them now.`
            : `${c.title} · ${c.done} of ${c.total} received, ${left} still to come.`,
          left === 0 ? `/jobs/${inv.job_id}/compare` : `/jobs/${inv.job_id}/bids`,
        ],
      );
    }
  });
  refresh();
}

export async function declineInvite(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  await asSystem(async (q) => {
    const inv = await loadInvite(q, token);
    await q(`update bid_invites set status = 'declined' where id = $1 and status <> 'submitted'`, [inv.id]);
    await q(`insert into audit_log (job_id, actor_label, action) values ($1,$2,'bid_declined')`, [inv.job_id, inv.sub_name]);
  });
  refresh();
}

export async function respondToAward(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const accept = formData.get("decision") === "accept";
  await asSystem(async (q) => {
    const inv = await loadInvite(q, token);
    const rows = await q<{ id: string }>(
      `update awards set status = $2, responded_at = now() where invite_id = $1 and status = 'offered' returning id`,
      [inv.id, accept ? "accepted" : "declined"],
    );
    if (rows.length) {
      await q(`insert into audit_log (job_id, actor_label, action, details) values ($1,$2,$3,$4)`, [
        inv.job_id,
        inv.sub_name,
        accept ? "award_accepted" : "award_declined",
        { awards: rows.length },
      ]);
    }
  });
  refresh();
}

/** Sub-contractor marks one of their tasks as started or done (from their bid link). */
export async function updateTaskStatus(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const taskId = String(formData.get("task_id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!["not_started", "in_progress", "done"].includes(status)) throw new Error("Invalid status");
  await asSystem(async (q) => {
    const inv = await loadInvite(q, token);
    const rows = await q<{ description: string }>(
      `update work_tasks
          set status = $3::task_status,
              started_at = case when $3 = 'not_started' then null else coalesce(started_at, now()) end,
              done_at = case when $3 = 'done' then now() else null end
        where id = $1 and invite_id = $2
        returning description`,
      [taskId, inv.id, status],
    );
    if (!rows.length) throw new Error("Task not found");

    // move the whole job along
    const [p] = await q<{ total: number; done: number; started: number; contractor_id: string; title: string }>(
      `select (select count(*)::int from work_tasks t where t.job_id = j.id) as total,
              (select count(*)::int from work_tasks t where t.job_id = j.id and t.status = 'done') as done,
              (select count(*)::int from work_tasks t where t.job_id = j.id and t.status <> 'not_started') as started,
              j.contractor_id, j.title
         from jobs j where j.id = $1`,
      [inv.job_id],
    );
    const next = p.total > 0 && p.done === p.total ? "completed" : p.started > 0 ? "in_progress" : "accepted";
    await q(`update jobs set status = $2::job_status, updated_at = now() where id = $1 and status in ('accepted','in_progress','completed')`, [inv.job_id, next]);

    if (status !== "not_started")
      await q(
        `insert into notifications (job_id, profile_id, kind, title, body, link) values ($1,$2,'task_update',$3,$4,$5)`,
        [
          inv.job_id,
          p.contractor_id,
          `${inv.sub_name} ${status === "done" ? "finished" : "started"}: ${rows[0].description}`,
          `${p.title} · ${p.done} of ${p.total} tasks done`,
          `/jobs/${inv.job_id}/progress`,
        ],
      );
    await syncSubInvoice(q, inv.id, inv.job_id, inv.sub_name, p.contractor_id, p.title);
    await q(`insert into audit_log (job_id, actor_label, action, details) values ($1,$2,'task_' || $3,$4)`, [
      inv.job_id,
      inv.sub_name,
      status,
      { task_id: taskId },
    ]);
  });
  refresh();
}

/**
 * When a sub-contractor has finished ALL their tasks on a project, their invoice is created
 * automatically (their bid rate x quantity per task) and sent to Northline.
 * If they undo a task before being paid, the unpaid invoice is withdrawn.
 */
async function syncSubInvoice(q: Q, inviteId: string, jobId: string, subName: string, contractorId: string, title: string) {
  const [t] = await q<{ total: number; done: number }>(
    `select count(*)::int as total, count(*) filter (where status = 'done')::int as done from work_tasks where invite_id = $1`,
    [inviteId],
  );
  const [existing] = await q<{ id: string; status: string }>(`select id, status from invoices where invite_id = $1 and kind = 'sub'`, [inviteId]);
  if (t.total === 0 || t.done < t.total) {
    if (existing && existing.status === "sent") await q(`delete from invoices where id = $1`, [existing.id]);
    return;
  }
  if (existing) return;
  const [created] = await q<{ id: string; number: string; amount: string }>(
    `with lines as (
       select t.description, t.quantity, t.unit, coalesce(r.unit_rate, 0) as unit_price,
              round(t.quantity * coalesce(r.unit_rate, 0), 2) as total, t.sort_order
         from work_tasks t
         left join bid_rates r on r.invite_id = t.invite_id and r.scope_item_id = t.scope_item_id
        where t.invite_id = $1
     ), inv as (
       insert into invoices (number, job_id, kind, invite_id, amount)
       select next_invoice_number('sub'), $2, 'sub', $1, coalesce(sum(total), 0) from lines
       returning id, number, amount
     ), ins as (
       insert into invoice_lines (invoice_id, description, quantity, unit, unit_price, total, sort_order)
       select inv.id, l.description, l.quantity, l.unit, l.unit_price, l.total, l.sort_order from inv, lines l
     )
     select id, number, amount::text from inv`,
    [inviteId, jobId],
  );
  await q(
    `insert into notifications (job_id, profile_id, kind, title, body, link) values ($1,$2,'sub_invoice',$3,$4,'/invoices')`,
    [jobId, contractorId, `Invoice ${created.number} from ${subName}`, `${title}: all their work is done. Amount ${Number(created.amount).toFixed(2)}`],
  );
  const [sub] = await q<{ subcontractor_id: string }>(`select subcontractor_id from bid_invites where id = $1`, [inviteId]);
  await q(
    `insert into notifications (job_id, subcontractor_id, kind, title, body, link, read_at) values ($1,$2,'invoice_created',$3,$4,null, now())`,
    [jobId, sub.subcontractor_id, `Invoice ${created.number} sent to ${(await q<{ c: string }>(`select company() as c`))[0].c}`, `${title}: you finished all your tasks, so your invoice was created and sent automatically. You'll be paid when the client pays.`],
  );
}
