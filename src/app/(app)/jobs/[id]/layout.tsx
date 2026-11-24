import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CalendarDays, ChevronRight, MapPin, UserRound } from "lucide-react";
import { withProfile } from "@/lib/auth";
import { getJob, getParty } from "@/lib/queries";
import { shortDate } from "@/lib/format";
import { JOB_STATUS_LABEL } from "@/lib/types";
import { Progress, StatusPill, stepIndex } from "@/components/ui";
import { NextStep, type DemoShortcut } from "@/components/next-step";
import { isDemoMode } from "@/lib/supabase/env";
import { contractorNextAction, ownerNextAction } from "@/lib/next-action";
import { JobTabs } from "@/components/job-tabs";

export default function JobLayout({ children, params }: LayoutProps<"/jobs/[id]">) {
  return (
    <div className="space-y-6">
      <Suspense fallback={<div className="h-56 animate-pulse rounded-[14px] bg-surface" />}>
        <JobHeader params={params} />
      </Suspense>
      {children}
    </div>
  );
}

async function JobHeader({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await withProfile(async (q, me) => {
    const job = await getJob(q, id);
    if (!job) return null;
    const otherId = me.id === job.owner_id ? job.contractor_id : job.owner_id;
    const [counts] = await q<{ invoice: string | null; items: number; bids: number; invites: number; quote: string | null; offered: number; accepted: number; declined: number }>(
      `select (select count(*)::int from scope_items where job_id = $1) as items,
              (select status::text from invoices where job_id = $1 and kind = 'client') as invoice,
              (select count(*)::int from bid_invites where job_id = $1 and status = 'submitted') as bids,
              (select count(*)::int from bid_invites where job_id = $1) as invites,
              (select status::text from owner_quotes where job_id = $1 order by version desc limit 1) as quote,
              (select count(*)::int from awards where job_id = $1 and status = 'offered') as offered,
              (select count(*)::int from awards where job_id = $1 and status = 'accepted') as accepted,
              (select count(*)::int from awards d where d.job_id = $1 and d.status = 'declined'
                  and not exists (select 1 from awards l where l.job_id = $1 and l.status in ('offered','accepted')
                                   and l.scope_item_id is not distinct from d.scope_item_id)) as declined`,
      [id],
    );
    return { me, job, other: await getParty(q, otherId), counts };
  });
  if (!data) notFound();
  const { me, job, other, counts } = data;
  const isContractor = me.id === job.contractor_id;
  const pendingEmail = isContractor ? job.owner_email : job.contractor_email;
  const otherName = other ? (other.company_name ?? other.full_name) : null;

  const hints = isContractor
    ? [
        `${counts.items} items`,
        counts.invites ? `${counts.bids} of ${counts.invites} received` : "Request prices",
        "Choose who does what",
        counts.quote && counts.quote !== "draft" ? "Sent to client" : "Add your markup",
        "Ready to start",
      ]
    : [`${counts.items} items`, "Contractor gets prices", "Contractor picks trades", counts.quote ? "Ready for you" : "Coming soon", "Ready to start"];

  return (
    <div>
      <nav className="flex items-center gap-1.5 text-[13px] font-medium text-subtle" aria-label="Breadcrumb">
        <Link href="/dashboard" className="text-muted hover:text-foreground">
          Projects
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="truncate">{job.title}</span>
      </nav>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight sm:text-[30px] sm:leading-tight">{job.title}</h1>
        <StatusPill status={job.status}>{JOB_STATUS_LABEL[job.status]}</StatusPill>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted">
        {job.site_address && (
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-4 text-subtle" /> {job.site_address}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <UserRound className="size-4 text-subtle" />
          {isContractor ? "Client" : "Contractor"}: {otherName ?? (pendingEmail ? `${pendingEmail} (invited)` : "not added yet")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays className="size-4 text-subtle" /> Updated {shortDate(job.updated_at)}
        </span>
      </div>

      <div className="mt-6">
        <Progress status={job.status} hints={hints} />
      </div>

      <NextStep
        demo={isDemoMode ? demoShortcut(job.id, job.status, isContractor, counts) : null}
        jobId={job.id}
        step={stepIndex(job.status) + 1}
        of={5}
        action={
          isContractor
            ? contractorNextAction({
                jobId: job.id,
                status: job.status,
                items: counts.items,
                invites: counts.invites,
                bidsIn: counts.bids,
                quoteStatus: counts.quote,
                offered: counts.offered,
                accepted: counts.accepted,
                declined: counts.declined,
                invoice: counts.invoice,
              })
            : ownerNextAction({
                jobId: job.id,
                status: job.status,
                items: counts.items,
                submitted: Boolean(job.details?.submitted_at),
                quoteStatus: counts.quote,
              })
        }
      />

      <JobTabs
        jobId={job.id}
        role={isContractor ? "contractor" : "owner"}
        counts={{ items: counts.items, bids: counts.invites }}
        showProgress={["accepted", "in_progress", "completed"].includes(job.status)}
      />
    </div>
  );
}

/** Demo mode: one click to play the next person in the flow, so the demo never "stops". */
function demoShortcut(
  jobId: string,
  status: string,
  isContractor: boolean,
  c: { items: number; bids: number; invites: number; quote: string | null; invoice: string | null },
): DemoShortcut | null {
  if (!isContractor) return null;
  if (status === "completed" && c.invoice === "sent")
    return { hint: "the invoice is on the homeowner's phone. Play their side to pay it.", label: "Open the homeowner's phone", href: `/demo/switch?as=owner&job=${jobId}&tab=` };
  const owner = (tab = "") => `/demo/switch?as=owner&job=${jobId}&tab=${encodeURIComponent(tab)}`;
  if (["accepted", "in_progress"].includes(status))
    return { hint: "sub-contractors mark tasks Start / Done from their phones.", label: "Open sub-contractor phones", href: "/simulator/sub" };
  if (c.quote === "sent" || status === "quoted")
    return { hint: "the quote is on the homeowner's phone. Play their side to accept it or ask for changes.", label: "Open the homeowner's phone", href: owner() };
  if (status === "bidding" && c.bids < c.invites)
    return { hint: "bid requests are in the sub-contractors' inboxes. Open their phones to send prices.", label: "Open sub-contractor phones", href: "/simulator/sub" };
  return null;
}
