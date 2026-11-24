import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowRight, Clock, Inbox, MessageSquareQuote, Send, X } from "lucide-react";
import { withProfile } from "@/lib/auth";
import { getInvites, getJob, getRates, getScope, getSubcontractors } from "@/lib/queries";
import { money, shortDate } from "@/lib/format";
import { INVITE_STATUS_LABEL } from "@/lib/types";
import { createInvites, removeInvite } from "@/lib/actions/jobs";
import { SubmitButton } from "@/components/submit-button";
import { CopyLink } from "@/components/copy-link";
import { SubcontractorForm } from "@/components/subcontractor-form";
import { RequestBidsAction } from "@/components/request-bids-action";
import { Avatar, Empty, StatusPill } from "@/components/ui";

export default function BidsPage({ params }: PageProps<"/jobs/[id]/bids">) {
  return (
    <Suspense fallback={<div className="card h-96 animate-pulse" />}>
      <Bids params={params} />
    </Suspense>
  );
}

async function Bids({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await withProfile(async (q, me) => {
    const job = await getJob(q, id);
    if (!job || job.contractor_id !== me.id) return null;
    const [scope, subs, invites, rates] = await Promise.all([
      getScope(q, id),
      getSubcontractors(q, me.id),
      getInvites(q, id),
      getRates(q, id),
    ]);
    return { job, scope, subs, invites, rates };
  });
  if (!data) notFound();
  const { job, scope, subs, invites, rates } = data;

  const open = ["draft", "bidding", "awarding"].includes(job.status);
  const invitedIds = new Set(invites.map((i) => i.subcontractor_id));
  const stages = [...new Set(scope.map((s) => s.stage))];
  const submitted = invites.filter((i) => i.status === "submitted").length;

  const totalFor = (inviteId: string) =>
    rates
      .filter((r) => r.invite_id === inviteId)
      .reduce((sum, r) => sum + r.unit_rate * (scope.find((s) => s.id === r.scope_item_id)?.quantity ?? 0), 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      {open && invites.length === 0 && subs.length > 0 && scope.length > 0 && <RequestBidsAction jobId={job.id} />}
      <section className="min-w-0 space-y-4">
        {invites.length === 0 ? (
          <Empty icon={Inbox} title="No bid requests yet">
            Pick sub-contractors on the right. Each one gets a private link to price your work list.
          </Empty>
        ) : (
          <div className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5">
              <div>
                <h2 className="font-semibold tracking-tight">Bid requests</h2>
                <p className="text-xs text-muted">
                  <span className="font-semibold text-foreground">
                    {submitted} of {invites.length}
                  </span>{" "}
                  bids received
                  {invites.length - submitted > 0 ? ` · ${invites.length - submitted} remaining` : " · all in"}
                </p>
                <div className="mt-2 flex w-56 gap-1" aria-hidden>
                  {invites.map((i) => (
                    <span
                      key={i.id}
                      className={`h-1.5 flex-1 rounded-full ${i.status === "submitted" ? "bg-success" : i.status === "declined" ? "bg-danger/50" : "bg-border-strong"}`}
                    />
                  ))}
                </div>
              </div>
              {submitted > 0 && (
                <Link href={`/jobs/${job.id}/compare`} className={submitted === invites.length ? "btn-primary" : "btn-secondary btn-sm"}>
                  {submitted === invites.length ? "All in: compare now" : "Compare so far"} <ArrowRight />
                </Link>
              )}
            </div>
            <ul className="divide-y divide-border">
              {invites.map((inv) => {
                const priced = rates.filter((r) => r.invite_id === inv.id).length;
                const of = inv.scope_item_ids?.length ?? scope.length;
                const pct = of ? Math.round((priced / of) * 100) : 0;
                const isIn = inv.status === "submitted";
                return (
                  <li key={inv.id} className="px-5 py-4">
                    <div className="flex items-start gap-3">
                      <Avatar name={inv.sub_name} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="truncate font-medium">
                            {inv.sub_name}
                            {inv.sub_company && <span className="font-normal text-muted"> · {inv.sub_company}</span>}
                          </p>
                          <div className="flex items-center gap-2">
                            <StatusPill status={inv.status}>{INVITE_STATUS_LABEL[inv.status]}</StatusPill>
                            {open && !isIn && (
                              <form action={removeInvite}>
                                <input type="hidden" name="invite_id" value={inv.id} />
                                <button
                                  className="rounded-md p-1 text-subtle transition hover:bg-danger-soft hover:text-danger"
                                  aria-label={`Remove ${inv.sub_name}`}
                                  title="Remove request"
                                >
                                  <X className="size-4" />
                                </button>
                              </form>
                            )}
                          </div>
                        </div>
                        <p className="mt-0.5 text-xs text-muted">
                          {inv.scope_item_ids?.length ? `${of} of ${scope.length} items` : "Whole job"}
                          {!isIn && (
                            <span className="ml-2 inline-flex items-center gap-1">
                              <Clock className="size-3" /> expires {shortDate(inv.expires_at)}
                            </span>
                          )}
                        </p>

                        {isIn && (
                          <div className="mt-3 flex items-center gap-4">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2 ring-1 ring-border">
                              <div className={`h-full rounded-full ${pct === 100 ? "bg-success" : "bg-warning"}`} style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-muted">
                              {priced}/{of} priced
                            </span>
                            <span className="num font-semibold">{money(totalFor(inv.id), job.currency)}</span>
                          </div>
                        )}
                        {inv.sub_notes && (
                          <p className="mt-3 flex gap-2 rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">
                            <MessageSquareQuote className="size-3.5 shrink-0" /> {inv.sub_notes}
                          </p>
                        )}
                        <div className="mt-2.5">
                          <CopyLink path={`/bid/${inv.token}`} />
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        {open && (
          <div className="card p-5">
            <h2 className="mb-1 flex items-center gap-2 font-semibold tracking-tight">
              <span className="flex size-7 items-center justify-center rounded-md bg-brand-soft text-brand-soft-fg">
                <Send className="size-4" />
              </span>
              Request bids
            </h2>
            <p className="mb-4 text-xs text-muted">Each sub gets a private link. Send it by email, text or WhatsApp.</p>
            {subs.length === 0 ? (
              <p className="rounded-lg bg-surface-2 px-3 py-3 text-sm text-muted">Your sub-contractor list is empty. Add one below.</p>
            ) : scope.length === 0 ? (
              <p className="rounded-lg bg-surface-2 px-3 py-3 text-sm text-muted">
                Add work items first. <Link href={`/jobs/${job.id}`} className="link">Go to the work list</Link>
              </p>
            ) : (
              <form id="request-bids-form" action={createInvites} className="space-y-5" data-step-target>
                <input type="hidden" name="job_id" value={job.id} />
                <fieldset>
                  <legend className="label">Sub-contractors</legend>
                  <div className="max-h-72 space-y-1.5 overflow-y-auto">
                    {subs.map((s) => (
                      <label
                        key={s.id}
                        className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-2.5 transition hover:bg-surface-2 has-[:checked]:border-select has-[:checked]:bg-select-bg"
                      >
                        <input type="checkbox" name="sub_ids" value={s.id} className="size-4 accent-[var(--select-dot)]" />
                        <Avatar name={s.name} size="sm" />
                        <span className="min-w-0 text-sm">
                          <span className="block truncate font-medium">
                            {s.name}
                            {invitedIds.has(s.id) && <span className="ml-1 text-xs font-normal text-muted">· invited</span>}
                          </span>
                          <span className="block truncate text-xs text-muted">{s.trades.join(", ") || s.company_name}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <fieldset>
                  <legend className="label">What should they price?</legend>
                  <p className="mb-2 text-xs text-muted">Leave all unselected for the whole job, or pick stages for a specialist.</p>
                  <div className="flex flex-wrap gap-1.5">
                    {stages.map((st) => (
                      <label
                        key={st}
                        className="cursor-pointer rounded-full border border-border-strong bg-surface px-3 py-1 text-xs font-medium text-muted transition hover:text-foreground has-[:checked]:border-hero has-[:checked]:bg-hero has-[:checked]:text-hero-num"
                      >
                        <input type="checkbox" name="stages" value={st} className="sr-only" />
                        {st}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div>
                  <label htmlFor="message" className="label">
                    Message <span className="font-normal text-subtle">· optional</span>
                  </label>
                  <textarea id="message" name="message" rows={2} placeholder="Start date, site access, bid deadline…" className="textarea" />
                </div>
                <SubmitButton className="w-full" pendingText="Creating links…">
                  <Send /> Send bid requests
                </SubmitButton>
              </form>
            )}
          </div>
        )}
        <SubcontractorForm open={subs.length === 0} />
      </aside>
    </div>
  );
}
