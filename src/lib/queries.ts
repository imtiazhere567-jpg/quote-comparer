import "server-only";
import type { Q } from "@/lib/db";
import type {
  Award,
  BidInvite,
  BidRate,
  Job,
  OwnerQuote,
  OwnerQuoteLine,
  Profile,
  ScopeItem,
  Subcontractor,
} from "@/lib/types";

// numeric columns are cast to float8 so every driver returns JS numbers.

export async function getJob(q: Q, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const rows = await q<Job>(`select * from jobs where id = $1`, [id]);
  return rows[0] ?? null;
}

export async function getParty(q: Q, id: string | null) {
  if (!id) return null;
  const rows = await q<Profile>(`select id, role, full_name, company_name, email, phone from profiles where id = $1`, [id]);
  return rows[0] ?? null;
}

export function getScope(q: Q, jobId: string) {
  return q<ScopeItem>(
    `select id, job_id, stage, trade, description, quantity::float8 as quantity, unit, notes, sort_order
       from scope_items where job_id = $1 order by sort_order, created_at`,
    [jobId],
  );
}

export function getSubcontractors(q: Q, contractorId: string) {
  return q<Subcontractor>(`select * from subcontractors where contractor_id = $1 order by name`, [contractorId]);
}

export function getInvites(q: Q, jobId: string) {
  return q<BidInvite & { sub_name: string; sub_company: string | null; sub_email: string | null }>(
    `select i.*, s.name as sub_name, s.company_name as sub_company, s.email as sub_email
       from bid_invites i join subcontractors s on s.id = i.subcontractor_id
      where i.job_id = $1 order by s.name`,
    [jobId],
  );
}

export function getRates(q: Q, jobId: string) {
  return q<BidRate>(
    `select r.invite_id, r.scope_item_id, r.unit_rate::float8 as unit_rate, r.note
       from bid_rates r join bid_invites i on i.id = r.invite_id
      where i.job_id = $1`,
    [jobId],
  );
}

export function getAwards(q: Q, jobId: string) {
  return q<Award>(
    `select id, job_id, scope_item_id, invite_id, unit_rate::float8 as unit_rate, amount::float8 as amount, status, created_at
       from awards where job_id = $1 order by created_at`,
    [jobId],
  );
}

export async function getQuotes(q: Q, jobId: string) {
  return q<OwnerQuote>(
    `select id, job_id, version, markup_percent::float8 as markup_percent, status, message, owner_response, sent_at, responded_at
       from owner_quotes where job_id = $1 order by version desc`,
    [jobId],
  );
}

export function getQuoteLines(q: Q, quoteId: string) {
  return q<OwnerQuoteLine>(
    `select id, quote_id, scope_item_id, stage, description, quantity::float8 as quantity, unit,
            unit_price::float8 as unit_price, total::float8 as total, sort_order
       from owner_quote_lines where quote_id = $1 order by sort_order`,
    [quoteId],
  );
}
