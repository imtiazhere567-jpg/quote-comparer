import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  BedDouble,
  DoorOpen,
  CalendarClock,
  ChevronLeft,
  CircleCheck,
  HardHat,
  Layers,
  MapPin,
  Ruler,
  Sparkles,
  Wallet,
  Bath,
  type LucideIcon,
} from "lucide-react";
import { withOwner } from "@/lib/mobile-auth";
import { getSettings } from "@/lib/settings";
import { getJob, getParty, getQuoteLines, getQuotes, getScope } from "@/lib/queries";
import { money, qty, shortDate } from "@/lib/format";
import { OWNER_STEPS, ownerStatus, ownerStep } from "@/lib/owner-status";
import { FINISHES, PROJECT_TYPES } from "@/lib/project-wizard";
import { payClientInvoice } from "@/lib/actions/invoices";
import { QuoteResponse } from "@/components/mobile/quote-response";
import { FeedbackForm } from "@/components/mobile/feedback-form";
import { ConfirmSubmit } from "@/components/confirm-dialog";
import { OwnerMiniProgress } from "@/components/mobile/owner-progress";
import { TabBar } from "@/components/mobile/tab-bar";
import { isDemoMode } from "@/lib/supabase/env";

export default function ProjectPage({ params, searchParams }: PageProps<"/m/projects/[id]">) {
  return (
    <>
      <Suspense fallback={<div className="h-96 flex-1 animate-pulse bg-surface" />}>
        <Project params={params} searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<div className="h-20 border-t border-border bg-surface" />}>
        <TabBar />
      </Suspense>
    </>
  );
}

type Details = {
  type?: string;
  area?: number;
  area_unit?: string;
  floors?: number;
  bedrooms?: number;
  bathrooms?: number;
  garage?: string;
  finish?: string;
  start?: string;
  budget?: string;
  custom_items?: string[];
  extra_rooms?: { name: string; count: number }[];
};

async function Project({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const data = await withOwner(async (q, me) => {
    const job = await getJob(q, id);
    if (!job || job.owner_id !== me.id) return null;
    const [scope, quotes, contractor, details] = await Promise.all([
      getScope(q, id),
      getQuotes(q, id),
      getParty(q, job.contractor_id),
      q<{ details: Details }>(`select details from jobs where id = $1`, [id]),
    ]);
    const quote = quotes[0] ?? null;
    const tasks = await q<{ stage: string; description: string; status: "not_started" | "in_progress" | "done" }>(
      `select stage, description, status from work_tasks where job_id = $1 order by sort_order`,
      [id],
    );
    const [invoice] = await q<{ id: string; number: string; amount: number; status: "sent" | "paid"; note: string | null; issued_at: string; paid_at: string | null }>(
      `select id, number, amount::float8 as amount, status::text as status, note, issued_at, paid_at from invoices where job_id = $1 and kind = 'client'`,
      [id],
    );
    const invoiceLines = invoice
      ? await q<{ description: string; quantity: number; unit: string; total: number }>(
          `select description, quantity::float8 as quantity, unit, total::float8 as total from invoice_lines where invoice_id = $1 order by sort_order`,
          [invoice.id],
        )
      : [];
    // feedback: one part per sub-contractor, shown only by trade
    const parts = await q<{ invite_id: string; label: string; tasks: string[] }>(
      `select invite_id, string_agg(distinct stage, ', ') as label, array_agg(description order by sort_order) as tasks
         from work_tasks where job_id = $1 group by invite_id order by min(sort_order)`,
      [id],
    );
    const ratings = await q<{ invite_id: string; work_label: string; stars: number; reason: string | null }>(
      `select invite_id, work_label, stars, reason from work_ratings where job_id = $1 order by created_at`,
      [id],
    );
    const [feedback] = await q<{ comment: string | null }>(`select comment from project_feedback where job_id = $1`, [id]);
    return {
      job,
      scope,
      quote,
      lines: quote ? await getQuoteLines(q, quote.id) : [],
      contractor,
      details: details[0]?.details ?? {},
      tasks,
      invoice: invoice ?? null,
      invoiceLines,
      parts,
      ratings,
      feedback: feedback ?? null,
    };
  });
  if (!data) notFound();
  const { job, scope, quote, lines, details: d, tasks, invoice, invoiceLines, parts, ratings, feedback } = data;
  const settings = await getSettings();
  const status = ownerStatus({ ...job, details: d }, quote?.status ?? null, settings.company_name);
  const step = ownerStep(job, quote?.status ?? null);
  const created = sp.created === "1";
  const stages = [...new Set(scope.map((s) => s.stage))];
  const total = lines.reduce((s, l) => s + l.total, 0);
  const typeLabel = PROJECT_TYPES.find((t) => t.id === d.type)?.label;

  const facts: { icon: LucideIcon; label: string; value: string }[] = [
    d.area ? { icon: Ruler, label: "Size", value: `${qty(d.area)} ${d.area_unit ?? ""}` } : null,
    d.bedrooms && (d.type === "new_home" || d.type === "renovation") ? { icon: BedDouble, label: "Bedrooms", value: String(d.bedrooms) } : null,
    d.bathrooms ? { icon: Bath, label: "Bathrooms", value: String(d.bathrooms) } : null,
    d.floors && d.type !== "kitchen" && d.type !== "bathroom" ? { icon: Layers, label: "Floors", value: String(d.floors) } : null,
    d.extra_rooms?.some((r) => r.count > 0)
      ? {
          icon: DoorOpen,
          label: "Other rooms",
          value: d.extra_rooms
            .filter((r) => r.count > 0)
            .map((r) => (r.count > 1 ? `${r.count}× ${r.name}` : r.name))
            .join(", "),
        }
      : null,
    d.finish ? { icon: Sparkles, label: "Finish", value: FINISHES.find((f) => f.id === d.finish)?.label ?? d.finish } : null,
    d.start ? { icon: CalendarClock, label: "Start", value: d.start } : null,
    d.budget ? { icon: Wallet, label: "Budget", value: d.budget } : null,
  ].filter(Boolean) as { icon: LucideIcon; label: string; value: string }[];

  return (
    <main className="flex-1 pb-8">
      {/* Header */}
      <div className="hero-panel relative overflow-hidden px-5 pt-11 pb-6">
        <div className="blueprint pointer-events-none absolute inset-0" />
        <div className="relative">
          <Link href="/m" className="inline-flex size-10 items-center justify-center rounded-full bg-white/10" aria-label="Back">
            <ChevronLeft className="size-5" />
          </Link>
          {typeLabel && <p className="mt-5 text-[13px] font-semibold tracking-wide text-hero-num uppercase">{typeLabel}</p>}
          <h1 className="mt-1 text-[26px] leading-tight font-bold tracking-tight text-white">{job.title}</h1>
          {job.site_address && (
            <p className="mt-1.5 flex items-center gap-1.5 text-sm opacity-80">
              <MapPin className="size-4 shrink-0" /> {job.site_address}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-5 px-5 pt-5">
        {created && (
          <div className="animate-step-in flex gap-3 rounded-2xl border border-success-line bg-success-soft p-4 text-success">
            <CircleCheck className="mt-0.5 size-5 shrink-0" />
            <div className="text-sm">
              <p className="font-semibold">Project created</p>
              <p className="mt-0.5 opacity-90">
                We made a work list with {scope.length} items.{" "}
                {settings.company_name} will prepare your quote. You&apos;ll get a notification when it&apos;s ready.
              </p>
            </div>
          </div>
        )}

        {isDemoMode && !["accepted", "in_progress", "completed", "cancelled"].includes(job.status) && quote?.status !== "sent" && (
          <div className="rounded-2xl border border-dashed border-border-strong bg-surface-2 p-4 text-sm">
            <p>
              <span className="font-semibold">Demo:</span> {settings.company_name} reviews this next, sends it to sub-contractors and
              prepares your quote.
            </p>
            <a href={`/demo/switch?as=contractor&job=${job.id}&tab=`} target="_top" className="btn-primary mt-3 w-full justify-center">
              Continue as {settings.company_name}
            </a>
          </div>
        )}

        {/* Status */}
        <section className="card p-4">
          <div className="flex items-center justify-between">
            <p className="eyebrow">Status</p>
            <OwnerMiniProgress step={step} />
          </div>
          <p className={`mt-2 text-[17px] font-semibold ${status.highlight ? "text-brand-soft-fg" : ""}`}>{status.text}</p>
          <ol className="mt-4 space-y-3">
            {OWNER_STEPS.map((label, n) => {
              const done = n < step;
              const current = n === step;
              return (
                <li key={label} className="flex items-center gap-3 text-sm">
                  <span
                    className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                      done ? "bg-success text-white" : current ? "bg-hero text-hero-num" : "bg-surface-2 text-subtle ring-1 ring-border"
                    }`}
                  >
                    {done ? "✓" : n + 1}
                  </span>
                  <span className={current ? "font-semibold" : done ? "text-muted" : "text-subtle"}>{label}</span>
                </li>
              );
            })}
          </ol>
        </section>

        {/* Feedback (after paying) */}
        {invoice?.status === "paid" && !feedback && parts.length > 0 && (
          <FeedbackForm threshold={settings.rating_threshold} company={settings.company_name} jobId={job.id} parts={parts.map((p) => ({ inviteId: p.invite_id, label: p.label, tasks: p.tasks }))} />
        )}
        {feedback && (
          <section className="card p-4">
            <p className="flex items-center gap-2 font-semibold text-success">
              <CircleCheck className="size-5" /> Thanks for your feedback
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              {ratings.map((r) => (
                <li key={r.invite_id} className="flex items-start justify-between gap-3">
                  <span>
                    {r.work_label}
                    {r.reason && <span className="block text-xs text-muted">“{r.reason}”</span>}
                  </span>
                  <span className="shrink-0 text-warning" aria-label={`${r.stars} stars`}>
                    {"★".repeat(r.stars)}
                    <span className="text-border-strong">{"★".repeat(5 - r.stars)}</span>
                  </span>
                </li>
              ))}
            </ul>
            {feedback.comment && <p className="mt-3 rounded-xl bg-surface-2 px-3 py-2 text-[13px]">“{feedback.comment}”</p>}
          </section>
        )}

        {/* Invoice (after the work is done) */}
        {invoice && (
          <section className={`card overflow-hidden ${invoice.status === "sent" ? "ring-2 ring-brand" : ""}`}>
            <div className="flex items-start justify-between gap-3 px-4 pt-4">
              <div>
                <p className="eyebrow">Invoice {invoice.number}</p>
                <p className="num mt-1 text-[30px] leading-none font-bold">{money(invoice.amount, job.currency, 2)}</p>
                <p className="mt-1.5 text-xs text-muted">Issued {shortDate(invoice.issued_at)} by {settings.company_name}</p>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  invoice.status === "paid" ? "bg-success-soft text-success" : "bg-warning-soft text-warning-text"
                }`}
              >
                {invoice.status === "paid" ? "Paid" : "To pay"}
              </span>
            </div>
            {invoice.note && <p className="mx-4 mt-3 rounded-xl bg-surface-2 px-3 py-2 text-[13px] whitespace-pre-line">{invoice.note}</p>}
            <details className="group mt-3 border-y border-border">
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold">
                {invoiceLines.length} lines <span className="text-muted group-open:rotate-180">⌄</span>
              </summary>
              <ul className="px-4 pb-3 text-[13px]">
                {invoiceLines.map((l, i) => (
                  <li key={i} className="flex justify-between gap-3 border-t border-border py-2">
                    <span>
                      {l.description}
                      <span className="block text-xs text-subtle">
                        {qty(l.quantity)} {l.unit}
                      </span>
                    </span>
                    <span className="num shrink-0 font-semibold">{money(l.total, job.currency, 2)}</span>
                  </li>
                ))}
              </ul>
            </details>
            {invoice.status === "sent" ? (
              <form action={payClientInvoice} className="p-4">
                <input type="hidden" name="invoice_id" value={invoice.id} />
                <ConfirmSubmit
                  className="btn-primary h-12 w-full justify-center rounded-2xl text-[15px]"
                  confirm={{
                    title: `Pay invoice ${invoice.number}?`,
                    amount: money(invoice.amount, job.currency, 2),
                    body: "Demo payment: no card is charged.",
                    confirmLabel: "Pay now",
                    tone: "success",
                  }}
                >
                  Pay {money(invoice.amount, job.currency, 2)}
                </ConfirmSubmit>
              </form>
            ) : (
              <p className="flex items-center gap-2 p-4 text-sm font-semibold text-success">
                <CircleCheck className="size-4" /> Paid {invoice.paid_at ? shortDate(invoice.paid_at) : ""}. Thank you!
              </p>
            )}
          </section>
        )}

        {/* Work progress (after the quote is accepted) */}
        {tasks.length > 0 && (
          <section className="card overflow-hidden">
            <div className="px-4 pt-4 pb-3">
              <div className="flex items-baseline justify-between">
                <p className="eyebrow">Work progress</p>
                <p className="num text-sm font-bold">
                  {tasks.filter((t) => t.status === "done").length} of {tasks.length} done
                </p>
              </div>
              <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-surface-2 ring-1 ring-border ring-inset">
                <div className="h-full rounded-full bg-success" style={{ width: `${(tasks.filter((t) => t.status === "done").length / tasks.length) * 100}%` }} />
              </div>
            </div>
            <ul className="border-t border-border px-4 py-1">
              {tasks.map((t, i) => (
                <li key={i} className="flex items-center gap-3 py-2 text-[13px]">
                  <span className={`size-2.5 shrink-0 rounded-full ${t.status === "done" ? "bg-success" : t.status === "in_progress" ? "bg-info" : "bg-border-strong"}`} />
                  <span className={`flex-1 ${t.status === "done" ? "text-muted line-through" : ""}`}>{t.description}</span>
                  <span className="shrink-0 text-xs text-subtle">{t.status === "done" ? "Done" : t.status === "in_progress" ? "In progress" : "Not started"}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Quote */}
        {quote && (
          <section className="card overflow-hidden">
            <div className="hero-panel px-4 py-4">
              <p className="text-xs opacity-75">Quote from {settings.company_name}</p>
              <p className="num mt-0.5 text-[30px] leading-tight font-bold text-hero-num">{money(total, job.currency)}</p>
              <p className="text-xs opacity-75">Version {quote.version} · {lines.length} line items</p>
            </div>
            {quote.message && <p className="border-b border-border px-4 py-3 text-sm whitespace-pre-line">{quote.message}</p>}
            <details className="group border-b border-border">
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold">
                See all prices <span className="text-muted group-open:rotate-180">⌄</span>
              </summary>
              <ul className="px-4 pb-3 text-[13px]">
                {lines.map((l) => (
                  <li key={l.id} className="flex justify-between gap-3 border-t border-border py-2">
                    <span>
                      {l.description}
                      <span className="block text-xs text-subtle">
                        {qty(l.quantity)} {l.unit}
                      </span>
                    </span>
                    <span className="num shrink-0 font-semibold">{money(l.total, job.currency, 2)}</span>
                  </li>
                ))}
              </ul>
            </details>
            {quote.status === "sent" ? (
              <QuoteResponse company={settings.company_name} quoteId={quote.id} total={money(total, job.currency)} />
            ) : (
              <p className="p-4 text-sm text-muted">
                {quote.status === "accepted" ? "✓ You accepted this quote." : quote.status === "changes_requested" ? "You asked for changes. We'll send you an updated quote." : "You rejected this quote."}
                {quote.owner_response && quote.status !== "accepted" && (
                  <span className="mt-2 block rounded-xl bg-surface-2 px-3 py-2 text-foreground">“{quote.owner_response}”</span>
                )}
              </p>
            )}
          </section>
        )}

        {/* Contractor */}
        <section className="card flex items-center gap-3 p-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-hero text-hero-num">
            <HardHat className="size-5" />
          </span>
          <div className="min-w-0 text-sm">
            <p className="text-xs text-muted">Your builder</p>
            <p className="truncate font-semibold">{settings.company_name}</p>
            {(settings.contact_phone || settings.contact_email) && (
              <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs">
                {settings.contact_phone && (
                  <a href={`tel:${settings.contact_phone.replace(/[^\d+]/g, "")}`} className="font-medium text-brand-soft-fg">
                    {settings.contact_phone}
                  </a>
                )}
                {settings.contact_email && (
                  <a href={`mailto:${settings.contact_email}`} className="font-medium text-brand-soft-fg">
                    {settings.contact_email}
                  </a>
                )}
              </p>
            )}
          </div>
        </section>

        {/* Details */}
        {facts.length > 0 && (
          <section>
            <h2 className="mb-2.5 text-[15px] font-bold">Details</h2>
            <div className="grid grid-cols-2 gap-2.5">
              {facts.map((f) => (
                <div key={f.label} className="card p-3.5">
                  <f.icon className="size-4 text-subtle" />
                  <p className="mt-2 text-xs text-muted">{f.label}</p>
                  <p className="text-sm font-semibold">{f.value}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Work list */}
        <section>
          <div className="mb-2.5 flex items-baseline justify-between">
            <h2 className="text-[15px] font-bold">Work list</h2>
            <span className="text-[13px] text-muted">{scope.length} items</span>
          </div>
          <div className="card overflow-hidden">
            {stages.map((st) => (
              <details key={st} className="group border-b border-border last:border-b-0">
                <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3.5">
                  <span className="text-sm font-semibold">{st}</span>
                  <span className="flex items-center gap-2 text-xs text-muted">
                    {scope.filter((s) => s.stage === st).length}
                    <span className="transition group-open:rotate-180">⌄</span>
                  </span>
                </summary>
                <ul className="px-4 pb-3">
                  {scope
                    .filter((s) => s.stage === st)
                    .map((s) => (
                      <li key={s.id} className="flex justify-between gap-3 border-t border-border py-2.5 text-[13px]">
                        <span>
                          {s.description}
                          {s.notes && <span className="block text-xs text-subtle">{s.notes}</span>}
                        </span>
                        <span className="num shrink-0 font-semibold">
                          {qty(s.quantity)} <span className="font-normal text-muted">{s.unit}</span>
                        </span>
                      </li>
                    ))}
                </ul>
              </details>
            ))}
          </div>
          <p className="mt-2 text-center text-xs text-subtle">Quantities are estimates. Your contractor checks them before getting prices.</p>
        </section>
      </div>
    </main>
  );
}
