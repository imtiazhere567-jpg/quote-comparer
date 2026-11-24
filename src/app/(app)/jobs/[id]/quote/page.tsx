import Link from "next/link";
import { notFound } from "next/navigation";
import { getSettings } from "@/lib/settings";
import { Suspense } from "react";
import { EyeOff, MessageSquareReply, Receipt, Scale } from "lucide-react";
import { withProfile } from "@/lib/auth";
import { getAwards, getInvites, getJob, getParty, getQuoteLines, getQuotes, getRates, getScope } from "@/lib/queries";
import { awardedInviteByItem } from "@/lib/compare";
import { money, qty, shortDate, type Currency } from "@/lib/format";
import { QUOTE_STATUS_LABEL, type Job, type OwnerQuote, type OwnerQuoteLine, type Profile } from "@/lib/types";
import { respondToQuote } from "@/lib/actions/jobs";
import { SubmitButton } from "@/components/submit-button";
import { Callout, Empty, LogoMark, StatusPill } from "@/components/ui";
import { QuoteBuilder } from "./quote-builder";
import { OwnerQuoteAction } from "@/components/owner-quote-action";

export default function QuotePage({ params }: PageProps<"/jobs/[id]/quote">) {
  return (
    <Suspense fallback={<div className="card h-96 animate-pulse" />}>
      <Quote params={params} />
    </Suspense>
  );
}

async function Quote({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await withProfile(async (q, me) => {
    const job = await getJob(q, id);
    if (!job) return null;
    const isContractor = job.contractor_id === me.id;
    const quotes = await getQuotes(q, id); // RLS: owners only get sent quotes
    const latest = quotes[0] ?? null;
    const lines = latest ? await getQuoteLines(q, latest.id) : [];
    const [contractor, owner] = await Promise.all([getParty(q, job.contractor_id), getParty(q, job.owner_id)]);
    const parties = { contractor, owner };
    if (!isContractor) return { isContractor, job, latest, lines, parties };

    const [scope, invites, rates, awards] = await Promise.all([getScope(q, id), getInvites(q, id), getRates(q, id), getAwards(q, id)]);
    return { isContractor, job, latest, lines, parties, scope, invites, rates, awards };
  });
  if (!data) notFound();
  const { job, latest, lines, parties } = data;

  if (!data.isContractor) return <OwnerView job={job} quote={latest} lines={lines} parties={parties} />;

  const { scope, invites, rates, awards } = data as Required<typeof data>;
  const locked = latest && (latest.status === "sent" || latest.status === "accepted");

  if (locked) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Callout tone="info">
          <span className="inline-flex items-center gap-1.5">
            <EyeOff className="size-3.5" /> This is exactly what your client sees. Sub-contractor names and rates are never included.
          </span>
        </Callout>
        <QuoteDocument job={job} quote={latest} lines={lines} parties={parties} />
      </div>
    );
  }

  const awardedBy = awardedInviteByItem(scope, awards);
  const draftLine = (itemId: string) => (latest?.status === "draft" ? lines.find((l) => l.scope_item_id === itemId) : undefined);
  const settings = await getSettings();
  const prevMarkup = latest?.markup_percent ?? settings.default_markup;

  const items = scope.map((item) => {
    const award = awardedBy.get(item.id);
    let cost: number | null = null;
    let source: string | null = null;
    if (award) {
      const rate = award.scope_item_id
        ? award.unit_rate
        : rates.find((r) => r.invite_id === award.invite_id && r.scope_item_id === item.id)?.unit_rate;
      if (rate != null) {
        cost = Math.round(rate * item.quantity * 100) / 100;
        source = invites.find((i) => i.id === award.invite_id)?.sub_name ?? null;
      }
    }
    const dl = draftLine(item.id);
    if (dl) cost = Math.round((dl.total / (1 + prevMarkup / 100)) * 100) / 100;
    return { id: item.id, stage: item.stage, description: item.description, quantity: item.quantity, unit: item.unit, cost, source };
  });

  return (
    <div className="space-y-4">
      {latest?.status === "changes_requested" && (
        <Callout tone="warning" title={`Your client asked for changes to version ${latest.version}`}>
          {latest.owner_response || "No note given."}
        </Callout>
      )}
      {latest?.status === "rejected" && (
        <Callout tone="danger" title={`Your client rejected version ${latest.version}`}>
          {latest.owner_response || "No note given."}
        </Callout>
      )}
      {awardedBy.size === 0 && (
        <Callout tone="info">
          Nothing is awarded yet, so costs are empty.{" "}
          <Link href={`/jobs/${job.id}/compare`} className="link inline-flex items-center gap-1">
            <Scale className="size-3.5" /> Award work first
          </Link>
          , or type your own cost for each line.
        </Callout>
      )}
      <QuoteBuilder
        jobId={job.id}
        currency={job.currency}
        items={items}
        initialMarkup={prevMarkup}
        initialMessage={latest?.message ?? settings.quote_message ?? ""}
        ownerReady={Boolean(job.owner_id || job.owner_email)}
      />
    </div>
  );
}

type Parties = { contractor: Profile | null; owner: Profile | null };

function OwnerView({ job, quote, lines, parties }: { job: Job; quote: OwnerQuote | null; lines: OwnerQuoteLine[]; parties: Parties }) {
  if (!quote) {
    return (
      <Empty icon={Receipt} title="Your quote isn't ready yet">
        Your contractor is collecting prices from their trades. You&apos;ll see the full quote here as soon as they send it.
      </Empty>
    );
  }
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {quote.status === "sent" && (
        <OwnerQuoteAction jobId={job.id} quoteId={quote.id} label={`Accept quote · ${money(lines.reduce((t, l) => t + l.total, 0), job.currency)}`} />
      )}
      <QuoteDocument job={job} quote={quote} lines={lines} parties={parties} />
      {quote.status === "sent" && (
        <form action={respondToQuote} className="card p-5">
          <input type="hidden" name="quote_id" value={quote.id} />
          <h2 className="mb-1 flex items-center gap-2 font-semibold tracking-tight">
            <MessageSquareReply className="size-4 text-brand-soft-fg" /> Your decision
          </h2>
          <p className="mb-4 text-sm text-muted">Accept to go ahead, or tell your contractor what you&apos;d like changed.</p>
          <label htmlFor="response" className="label">
            Message <span className="font-normal text-subtle">· optional</span>
          </label>
          <textarea id="response" name="response" rows={3} placeholder="Questions, or what you'd like changed" className="textarea" />
          <div className="mt-4 flex flex-wrap gap-2">
            <SubmitButton name="status" value="accepted" variant="success" pendingText="Accepting…">
              Accept quote
            </SubmitButton>
            <SubmitButton name="status" value="changes_requested" variant="ghost" pendingText="Sending…">
              Request changes
            </SubmitButton>
            <SubmitButton name="status" value="rejected" variant="danger" pendingText="Sending…" className="sm:ml-auto">
              Reject
            </SubmitButton>
          </div>
        </form>
      )}
    </div>
  );
}

function QuoteDocument({ job, quote, lines, parties }: { job: Job; quote: OwnerQuote; lines: OwnerQuoteLine[]; parties: Parties }) {
  const cur: Currency = job.currency;
  const stages = [...new Set(lines.map((l) => l.stage))];
  const total = lines.reduce((s, l) => s + l.total, 0);
  const from = parties.contractor;
  const to = parties.owner;
  const ref = `Q-${job.id.slice(0, 6).toUpperCase()}-${quote.version}`;

  return (
    <article className="card overflow-hidden shadow-card">
      {/* Letterhead */}
      <header className="relative overflow-hidden bg-ink px-6 py-6 text-ink-fg sm:px-8">
        <div className="blueprint pointer-events-none absolute inset-0 opacity-60" />
        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div className="flex items-center gap-3">
            <LogoMark className="size-10" />
            <div>
              <p className="text-lg font-semibold text-white">{from?.company_name ?? from?.full_name ?? "Your contractor"}</p>
              <p className="text-sm text-ink-muted">{from?.email}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold tracking-tight text-white">Quote</p>
            <p className="num text-sm text-ink-muted">{ref}</p>
          </div>
        </div>
      </header>

      <div className="grid gap-6 border-b border-border px-6 py-5 sm:grid-cols-4 sm:px-8">
        <Meta label="Prepared for">{to ? (to.company_name ?? to.full_name) : (job.owner_email ?? "—")}</Meta>
        <Meta label="Project">
          {job.title}
          {job.site_address && <span className="block text-muted">{job.site_address}</span>}
        </Meta>
        <Meta label="Date">{quote.sent_at ? shortDate(quote.sent_at) : "Draft"}</Meta>
        <Meta label="Status">
          <StatusPill status={quote.status}>{QUOTE_STATUS_LABEL[quote.status]}</StatusPill>
        </Meta>
      </div>

      {quote.message && (
        <div className="border-b border-border px-6 py-5 sm:px-8">
          <p className="eyebrow mb-1.5">Message</p>
          <p className="text-sm whitespace-pre-line">{quote.message}</p>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-xs text-muted">
              <th className="border-b border-border px-6 py-3 text-left font-medium sm:px-8">Description</th>
              <th className="border-b border-border px-3 py-3 text-right font-medium">Qty</th>
              <th className="border-b border-border px-3 py-3 text-right font-medium">Unit price</th>
              <th className="border-b border-border px-6 py-3 text-right font-medium sm:px-8">Amount</th>
            </tr>
          </thead>
          {stages.map((stage) => {
            const sl = lines.filter((l) => l.stage === stage);
            return (
              <tbody key={stage}>
                <tr>
                  <td colSpan={3} className="bg-surface-2 px-6 py-2 sm:px-8">
                    <span className="eyebrow">{stage}</span>
                  </td>
                  <td className="num bg-surface-2 px-6 py-2 text-right text-xs font-medium text-muted sm:px-8">
                    {money(sl.reduce((s, l) => s + l.total, 0), cur)}
                  </td>
                </tr>
                {sl.map((l) => (
                  <tr key={l.id}>
                    <td className="border-b border-border px-6 py-3 sm:px-8">{l.description}</td>
                    <td className="num border-b border-border px-3 py-3 text-right whitespace-nowrap">
                      {qty(l.quantity)} <span className="text-muted">{l.unit}</span>
                    </td>
                    <td className="num border-b border-border px-3 py-3 text-right">{money(l.unit_price, cur, 2)}</td>
                    <td className="num border-b border-border px-6 py-3 text-right font-medium sm:px-8">{money(l.total, cur, 2)}</td>
                  </tr>
                ))}
              </tbody>
            );
          })}
        </table>
      </div>

      <div className="flex justify-end px-6 py-6 sm:px-8">
        <dl className="w-full max-w-xs space-y-2 text-sm">
          <div className="flex justify-between text-muted">
            <dt>{lines.length} line items</dt>
            <dd className="num">{money(total, cur, 2)}</dd>
          </div>
          <div className="flex items-baseline justify-between border-t-2 border-foreground pt-3">
            <dt className="font-semibold">Total</dt>
            <dd className="num text-2xl font-semibold">{money(total, cur, 2)}</dd>
          </div>
        </dl>
      </div>

      {quote.owner_response && quote.status !== "sent" && (
        <div className="border-t border-border bg-surface-2 px-6 py-4 text-sm sm:px-8">
          <span className="font-medium">Client&apos;s reply:</span> {quote.owner_response}
        </div>
      )}
    </article>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 text-sm">
      <p className="eyebrow mb-1">{label}</p>
      <div className="font-medium">{children}</div>
    </div>
  );
}
