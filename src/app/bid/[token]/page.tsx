import { BrandLogo } from "@/components/brand-logo";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isDemoMode } from "@/lib/supabase/env";
import { Suspense } from "react";
import { asSystem } from "@/lib/db";
import { money } from "@/lib/format";
import type { Currency } from "@/lib/format";
import type { ScopeItem } from "@/lib/types";
import { ChevronLeft, CircleCheck, CircleX, Clock, EyeOff, Lock, MapPin, MessageSquareQuote, PartyPopper } from "lucide-react";
import { declineInvite, respondToAward, updateTaskStatus } from "@/lib/actions/bid";
import { Callout, Empty } from "@/components/ui";
import { BidForm } from "./bid-form";
import { SubmitButton } from "@/components/submit-button";

export default function BidPage({ params }: PageProps<"/bid/[token]">) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-12 pb-6 sm:px-8 sm:py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <BrandLogo />
        <Suspense fallback={null}>
          <DemoInboxLink params={params} />
        </Suspense>
      </div>
      <Suspense fallback={<div className="card h-96 animate-pulse" />}>
        <Bid params={params} />
      </Suspense>
    </main>
  );
}

type InviteView = {
  id: string;
  status: string;
  expired: boolean;
  message: string | null;
  sub_notes: string | null;
  scope_item_ids: string[] | null;
  sub_name: string;
  job_id: string;
  job_title: string;
  job_description: string | null;
  site_address: string | null;
  currency: Currency;
  job_status: string;
  contractor: string;
};

async function Bid({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[0-9a-f]{48}$/.test(token)) notFound();

  const data = await asSystem(async (q) => {
    const [inv] = await q<InviteView>(
      `select i.id, i.status, i.expires_at < now() as expired, i.message, i.sub_notes, i.scope_item_ids,
              s.name as sub_name, j.id as job_id, j.title as job_title, j.description as job_description,
              j.site_address, j.currency, j.status as job_status,
              coalesce(p.company_name, p.full_name) as contractor
         from bid_invites i
         join subcontractors s on s.id = i.subcontractor_id
         join jobs j on j.id = i.job_id
         join profiles p on p.id = j.contractor_id
        where i.token = $1`,
      [token],
    );
    if (!inv) return null;
    // only write the first time (writes make every open screen refresh)
    if (inv.status === "sent") await q(`update bid_invites set status = 'viewed' where id = $1 and status = 'sent'`, [inv.id]);

    const items = await q<ScopeItem>(
      `select id, job_id, stage, trade, description, quantity::float8 as quantity, unit, notes, sort_order
         from scope_items where job_id = $1 and ($2::uuid[] is null or cardinality($2::uuid[]) = 0 or id = any($2::uuid[]))
        order by sort_order, created_at`,
      [inv.job_id, inv.scope_item_ids],
    );
    const rates = await q<{ scope_item_id: string; unit_rate: number }>(
      `select scope_item_id, unit_rate::float8 as unit_rate from bid_rates where invite_id = $1`,
      [inv.id],
    );
    const awards = await q<{ id: string; scope_item_id: string | null; amount: number; status: string; description: string | null }>(
      `select a.id, a.scope_item_id, a.amount::float8 as amount, a.status, si.description
         from awards a left join scope_items si on si.id = a.scope_item_id
        where a.invite_id = $1 and a.status in ('offered','accepted')
        order by si.sort_order nulls first`,
      [inv.id],
    );
    const tasks = await q<{ id: string; stage: string; description: string; quantity: number; unit: string; status: "not_started" | "in_progress" | "done" }>(
      `select id, stage, description, quantity::float8 as quantity, unit, status from work_tasks where invite_id = $1 order by sort_order`,
      [inv.id],
    );
    const [invoice] = await q<{ number: string; amount: number; status: string }>(
      `select number, amount::float8 as amount, status::text as status from invoices where invite_id = $1 and kind = 'sub'`,
      [inv.id],
    );
    return { inv, items, rates, awards, tasks, invoice: invoice ?? null };
  });
  if (!data) notFound();
  const { inv, items, rates, awards, tasks, invoice } = data;

  const offered = awards.filter((a) => a.status === "offered");
  const accepted = awards.filter((a) => a.status === "accepted");
  const awardTotal = awards.reduce((s, a) => s + a.amount, 0);
  const closed = inv.expired || !["draft", "bidding", "awarding"].includes(inv.job_status);
  const locked = awards.length > 0;

  return (
    <div className="space-y-6">
      <header className="card overflow-hidden">
        <div className="hero-panel flex flex-wrap items-center justify-between gap-3 px-6 py-4">
          <p className="text-sm">
            {tasks.length > 0 ? "Job from" : "Bid request from"} <span className="font-semibold text-hero-num">{inv.contractor}</span>
          </p>
          <span className="inline-flex items-center gap-1.5 text-xs opacity-80">
            <Lock className="size-3.5" /> Private link for {inv.sub_name}
          </span>
        </div>
        <div className="px-6 py-5">
          <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">{inv.job_title}</h1>
          {inv.site_address && (
            <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-muted">
              <MapPin className="size-4 text-subtle" /> {inv.site_address}
            </p>
          )}
          {inv.job_description && <p className="mt-3 max-w-3xl text-sm">{inv.job_description}</p>}
          {inv.message && (
            <div className="mt-4 flex gap-2.5 rounded-[10px] border border-brand-soft-line bg-brand-soft px-3.5 py-3 text-[13px] text-brand-soft-fg">
              <MessageSquareQuote className="mt-0.5 size-4 shrink-0" />
              <p>
                <span className="font-semibold">Note from {inv.contractor}:</span> {inv.message}
              </p>
            </div>
          )}
        </div>
      </header>

      {tasks.length > 0 && (
        <section className="card overflow-hidden">
          <div className="hero-panel relative px-5 py-5">
            <span className="absolute inset-y-0 left-0 w-1 bg-hero-num" />
            <p className="flex items-center gap-2 text-lg font-semibold text-hero-num">
              <PartyPopper className="size-5" /> You got this job. Start when you&apos;re ready.
            </p>
            <p className="mt-1 text-sm opacity-85">
              {tasks.filter((t) => t.status === "done").length} of {tasks.length} tasks done. Mark each one as you go, so {inv.contractor} can follow your progress.
            </p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-hero-num" style={{ width: `${(tasks.filter((t) => t.status === "done").length / tasks.length) * 100}%` }} />
            </div>
          </div>
          {invoice && (
            <div className={`flex items-center justify-between gap-3 border-b border-border px-5 py-3 text-sm ${invoice.status === "paid" ? "bg-success-soft text-success" : "bg-warning-soft"}`}>
              <span>
                <span className="font-semibold">Invoice {invoice.number}</span>{" "}
                {invoice.status === "paid" ? "· paid. Thank you!" : `· sent to ${inv.contractor} automatically. You'll be paid when the client pays.`}
              </span>
              <span className="num shrink-0 font-bold">{money(invoice.amount, inv.currency, 2)}</span>
            </div>
          )}
          <ul className="divide-y divide-border">
            {tasks.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <span className={`size-2.5 shrink-0 rounded-full ${t.status === "done" ? "bg-success" : t.status === "in_progress" ? "bg-info" : "bg-border-strong"}`} />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold ${t.status === "done" ? "text-muted line-through" : ""}`}>{t.description}</p>
                  <p className="text-xs text-subtle">
                    {t.stage} · {t.quantity} {t.unit} · {t.status === "done" ? "Done" : t.status === "in_progress" ? "In progress" : "Not started"}
                  </p>
                </div>
                <form action={updateTaskStatus} className="flex gap-2">
                  <input type="hidden" name="token" value={token} />
                  <input type="hidden" name="task_id" value={t.id} />
                  {t.status === "not_started" && (
                    <SubmitButton name="status" value="in_progress" variant="ghost" className="btn-sm" pendingText="…">
                      Start
                    </SubmitButton>
                  )}
                  {t.status !== "done" && (
                    <SubmitButton name="status" value="done" className="btn-sm" pendingText="…">
                      <CircleCheck /> Mark done
                    </SubmitButton>
                  )}
                  {t.status === "done" && (
                    <SubmitButton name="status" value="in_progress" variant="quiet" className="btn-sm" pendingText="…">
                      Undo
                    </SubmitButton>
                  )}
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      {offered.length > 0 && (
        <section className="hero-panel relative overflow-hidden rounded-[14px] p-6">
          <span className="absolute inset-y-0 left-0 w-1 bg-hero-num" />
          <p className="flex items-center gap-2 text-lg font-semibold text-hero-num">
            <PartyPopper className="size-5" /> You&apos;ve been offered this work
          </p>
          <p className="mt-1 text-sm opacity-85">
            {offered.some((a) => a.scope_item_id === null)
              ? "The whole job"
              : `${offered.length} item${offered.length > 1 ? "s" : ""}: ${offered.map((a) => a.description).join(", ")}`}{" "}
            for <span className="num font-semibold">{money(offered.reduce((s, a) => s + a.amount, 0), inv.currency)}</span>, at the rates
            you bid.
          </p>
          <div className="mt-5 flex flex-wrap gap-2.5">
            <form action={respondToAward}>
              <input type="hidden" name="token" value={token} />
              <SubmitButton name="decision" value="accept" pendingText="Accepting…">
                <CircleCheck /> Accept work
              </SubmitButton>
            </form>
            <form action={respondToAward}>
              <input type="hidden" name="token" value={token} />
              <SubmitButton name="decision" value="decline" variant="ghost" pendingText="Declining…">
                Decline
              </SubmitButton>
            </form>
          </div>
        </section>
      )}

      {accepted.length > 0 && offered.length === 0 && tasks.length === 0 && (
        <Callout tone="success" title={`You accepted this work · ${money(awardTotal, inv.currency)}`}>
          {inv.contractor} will be in touch about the start date and site access.
        </Callout>
      )}

      {inv.status === "declined" ? (
        <Empty icon={CircleX} title="You declined this bid request">
          Thanks for letting {inv.contractor} know.
        </Empty>
      ) : closed && !locked ? (
        <Empty icon={Clock} title={inv.expired ? "This bid request has expired" : "This job is no longer taking bids"}>
          Contact {inv.contractor} if you still want to price it.
        </Empty>
      ) : tasks.length > 0 ? null : (
        <>
          <BidForm
            token={token}
            currency={inv.currency}
            items={items}
            initialRates={Object.fromEntries(rates.map((r) => [r.scope_item_id, r.unit_rate]))}
            initialNotes={inv.sub_notes ?? ""}
            submitted={inv.status === "submitted"}
            locked={locked || closed}
          />
          {inv.status !== "submitted" && !locked && (
            <form action={declineInvite} className="text-center">
              <input type="hidden" name="token" value={token} />
              <button className="btn-quiet btn-sm hover:text-danger">I can&apos;t take this job</button>
            </form>
          )}
        </>
      )}

      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-subtle">
        <EyeOff className="size-3.5" /> Your rates are only shared with {inv.contractor}. Other bidders and the property owner never see them.
      </p>
    </div>
  );
}

/** Demo only: way back to the sub-contractor's simulated inbox. */
async function DemoInboxLink({ params }: { params: Promise<{ token: string }> }) {
  if (!isDemoMode) return null;
  const { token } = await params;
  if (!/^[0-9a-f]{48}$/.test(token)) return null;
  const [row] = await asSystem((q) => q<{ subcontractor_id: string }>(`select subcontractor_id from bid_invites where token = $1`, [token]));
  if (!row) return null;
  return (
    <Link href={`/s/${row.subcontractor_id}`} className="btn-secondary btn-sm">
      <ChevronLeft /> Inbox
    </Link>
  );
}
