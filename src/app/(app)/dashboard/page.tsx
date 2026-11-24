import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, CircleCheck, Inbox, MessageSquareWarning, Plus, Receipt, Scale, type LucideIcon } from "lucide-react";
import { withProfile } from "@/lib/auth";
import { money, type Currency } from "@/lib/format";
import type { JobStatus } from "@/lib/types";
import { IconTile, PageHeader } from "@/components/ui";
import { StatCards } from "@/components/dashboard/stat-cards";
import { ProjectsTable } from "@/components/dashboard/projects-table";
import type { BidRow, ProjectRow, QuoteRow } from "@/components/dashboard/types";

import { getSettings } from "@/lib/settings";
export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
  const data = await withProfile(async (q, me) => {
    // RLS decides what each role can see: owners get no bid rows and only sent quotes.
    const projects = await q<{
      id: string;
      title: string;
      site_address: string | null;
      status: JobStatus;
      currency: Currency;
      updated_at: string;
      client: string | null;
      items: number;
      bids_in: number;
      bids_out: number;
      quote_status: string | null;
      quote_total: number | null;
    }>(
      `select j.id, j.title, j.site_address, j.status, j.currency, j.updated_at,
              coalesce(p.company_name, p.full_name, case when j.owner_id = $1 then j.contractor_email else j.owner_email end) as client,
              (select count(*)::int from scope_items s where s.job_id = j.id) as items,
              (select count(*)::int from bid_invites i where i.job_id = j.id and i.status = 'submitted') as bids_in,
              (select count(*)::int from bid_invites i where i.job_id = j.id) as bids_out,
              lq.status::text as quote_status,
              (select sum(total)::float8 from owner_quote_lines l where l.quote_id = lq.id) as quote_total
         from jobs j
         left join profiles p on p.id = case when j.owner_id = $1 then j.contractor_id else j.owner_id end
         left join lateral (select id, status from owner_quotes oq where oq.job_id = j.id order by version desc limit 1) lq on true
        order by j.updated_at desc`,
      [me.id],
    );
    const bids = await q<{
      id: string;
      job_id: string;
      project: string;
      sub: string;
      company: string | null;
      submitted_at: string | null;
      currency: Currency;
      total: number | null;
      priced: number;
      invited: number;
    }>(
      `select i.id, i.job_id, j.title as project, s.name as sub, s.company_name as company, i.submitted_at, j.currency,
              (select sum(r.unit_rate * si.quantity)::float8 from bid_rates r join scope_items si on si.id = r.scope_item_id where r.invite_id = i.id) as total,
              (select count(*)::int from bid_rates r where r.invite_id = i.id) as priced,
              coalesce(nullif(cardinality(i.scope_item_ids), 0), (select count(*)::int from scope_items si where si.job_id = j.id)) as invited
         from bid_invites i
         join subcontractors s on s.id = i.subcontractor_id
         join jobs j on j.id = i.job_id
        where i.status = 'submitted'
        order by i.submitted_at desc nulls last`,
    );
    const quotes = await q<{
      id: string;
      job_id: string;
      project: string;
      client: string | null;
      version: number;
      status: string;
      sent_at: string | null;
      responded_at: string | null;
      currency: Currency;
      total: number | null;
    }>(
      `select distinct on (oq.job_id) oq.id, oq.job_id, j.title as project,
              coalesce(p.company_name, p.full_name, j.owner_email) as client,
              oq.version, oq.status::text as status, oq.sent_at, oq.responded_at, j.currency,
              (select sum(total)::float8 from owner_quote_lines l where l.quote_id = oq.id) as total
         from owner_quotes oq
         join jobs j on j.id = oq.job_id
         left join profiles p on p.id = case when j.owner_id = $1 then j.contractor_id else j.owner_id end
        where oq.status <> 'draft'
        order by oq.job_id, oq.version desc`,
      [me.id],
    );
    return { me, projects, bids, quotes };
  });

  const { me } = data;
  const role = me.role === "contractor" ? "contractor" : "owner";
  const iso = (v: string | null) => (v ? new Date(v).toISOString() : null);
  const projects: ProjectRow[] = data.projects.map((p) => ({
    id: p.id,
    title: p.title,
    address: p.site_address,
    client: p.client,
    status: p.status,
    items: p.items,
    bidsIn: p.bids_in,
    bidsOut: p.bids_out,
    quoteStatus: p.quote_status,
    quoteTotal: p.quote_total,
    currency: p.currency,
    updatedAt: iso(p.updated_at)!,
  }));
  const bids: BidRow[] = data.bids.map((b) => ({
    id: b.id,
    jobId: b.job_id,
    project: b.project,
    sub: b.sub,
    company: b.company,
    total: b.total ?? 0,
    priced: b.priced,
    invited: b.invited,
    submittedAt: iso(b.submitted_at),
    currency: b.currency,
  }));
  const quotes: QuoteRow[] = data.quotes
    .map((x) => ({
      id: x.id,
      jobId: x.job_id,
      project: x.project,
      client: x.client,
      version: x.version,
      total: x.total ?? 0,
      status: x.status,
      sentAt: iso(x.sent_at),
      respondedAt: iso(x.responded_at),
      currency: x.currency,
    }))
    .sort((a, b) => (b.sentAt ?? "").localeCompare(a.sentAt ?? ""));

  const first = (me.full_name || "there").split(" ")[0];
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={<span className="eyebrow">{today}</span>}
        title={`Good to see you, ${first}`}
        description={
          role === "contractor"
            ? "Here's where every project stands. Click any card for the full list."
            : `Track your projects and review quotes from ${(await getSettings()).company_name}.`
        }
        actions={
          <Link href="/jobs/new" className="btn-primary">
            <Plus /> New project
          </Link>
        }
      />

      <StatCards role={role} projects={projects} bids={bids} quotes={quotes} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Attention projects={projects} role={role} />
        <Pipeline projects={projects} quotes={quotes} />
      </div>

      <ProjectsTable projects={projects} bids={bids} role={role} />
    </div>
  );
}

/* ---------------------------------------------------------------- needs attention */

type Task = { id: string; icon: LucideIcon; tone: "brand" | "info" | "warning" | "success"; title: string; sub: string; href: string; cta: string };

function Attention({ projects, role }: { projects: ProjectRow[]; role: "owner" | "contractor" }) {
  const tasks: Task[] = [];
  for (const p of projects) {
    if (role === "owner") {
      if (p.quoteStatus === "sent")
        tasks.push({ id: p.id, icon: Receipt, tone: "brand", title: "Your quote is ready", sub: p.title, href: `/jobs/${p.id}/quote`, cta: "Review" });
      continue;
    }
    if (p.quoteStatus === "changes_requested")
      tasks.push({ id: p.id, icon: MessageSquareWarning, tone: "warning", title: "Client asked for changes", sub: `${p.title}${p.client ? ` · ${p.client}` : ""}`, href: `/jobs/${p.id}/quote`, cta: "Update quote" });
    else if (p.status === "bidding" && p.bidsIn > 0)
      tasks.push({ id: p.id, icon: Scale, tone: "info", title: `${p.bidsIn} of ${p.bidsOut} bids in`, sub: p.title, href: `/jobs/${p.id}/compare`, cta: "Compare" });
    else if (p.status === "awarding")
      tasks.push({ id: p.id, icon: Receipt, tone: "brand", title: "Ready to quote the client", sub: p.title, href: `/jobs/${p.id}/quote`, cta: "Build quote" });
    else if (p.status === "draft" && p.bidsOut === 0)
      tasks.push({ id: p.id, icon: Inbox, tone: "brand", title: `New project${p.client ? ` from ${p.client}` : ""}`, sub: `${p.title} · ${p.items} items`, href: `/jobs/${p.id}/bids`, cta: "Request bids" });
  }
  const shown = tasks.slice(0, 5);

  return (
    <section className="card overflow-hidden">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-base font-semibold tracking-tight">Needs your attention</h2>
        <p className="text-[13px] text-muted">{tasks.length ? `${tasks.length} things to do` : "You're all caught up"}</p>
      </div>
      {shown.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-12 text-center">
          <CircleCheck className="size-8 text-success" />
          <p className="mt-3 font-semibold">Nothing waiting on you</p>
          <p className="mt-1 text-sm text-muted">New bids and client replies will show up here.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {shown.map((t) => (
            <li key={`${t.id}-${t.title}`}>
              <Link href={t.href} className="group flex items-center gap-3.5 px-5 py-3.5 transition hover:bg-surface-2">
                <IconTile icon={t.icon} tone={t.tone} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{t.title}</p>
                  <p className="truncate text-[13px] text-muted">{t.sub}</p>
                </div>
                <span className="btn-secondary btn-sm shrink-0 group-hover:border-select">
                  {t.cta} <ArrowRight />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {tasks.length > shown.length && (
        <p className="border-t border-border bg-surface-2 px-5 py-2.5 text-[13px] text-muted">+ {tasks.length - shown.length} more in the projects table below</p>
      )}
    </section>
  );
}

/* ---------------------------------------------------------------- pipeline */

function Pipeline({ projects, quotes }: { projects: ProjectRow[]; quotes: QuoteRow[] }) {
  const stages: { label: string; match: (s: JobStatus) => boolean; color: string }[] = [
    { label: "Draft", match: (s) => s === "draft", color: "bg-border-strong" },
    { label: "Collecting bids", match: (s) => s === "bidding", color: "bg-info" },
    { label: "Comparing", match: (s) => s === "awarding", color: "bg-brand" },
    { label: "Quote sent", match: (s) => s === "quoted", color: "bg-warning" },
    { label: "Accepted", match: (s) => s === "accepted" || s === "in_progress" || s === "completed", color: "bg-success" },
  ];
  const counts = stages.map((s) => projects.filter((p) => s.match(p.status)).length);
  const max = Math.max(1, ...counts);
  const cur = projects[0]?.currency ?? "USD";
  const won = quotes.filter((q) => q.status === "accepted").reduce((s, q) => s + q.total, 0);
  const open = quotes.filter((q) => q.status === "sent" || q.status === "changes_requested").reduce((s, q) => s + q.total, 0);

  return (
    <section className="card flex flex-col overflow-hidden">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-base font-semibold tracking-tight">Pipeline</h2>
        <p className="text-[13px] text-muted">Projects at each stage</p>
      </div>
      <ul className="flex-1 space-y-3.5 px-5 py-4">
        {stages.map((s, i) => (
          <li key={s.label} className="grid grid-cols-[110px_1fr_28px] items-center gap-3 text-[13px]">
            <span className="text-muted">{s.label}</span>
            <span className="h-2.5 overflow-hidden rounded-full bg-surface-2 ring-1 ring-border ring-inset">
              <span className={`block h-full rounded-full ${s.color}`} style={{ width: `${(counts[i] / max) * 100}%` }} />
            </span>
            <span className="num text-right font-semibold">{counts[i]}</span>
          </li>
        ))}
      </ul>
      <div className="hero-panel grid grid-cols-2 gap-4 px-5 py-4">
        <div>
          <p className="text-xs opacity-75">Open quotes</p>
          <p className="num text-lg font-bold text-hero-num">{money(open, cur)}</p>
        </div>
        <div>
          <p className="text-xs opacity-75">Won</p>
          <p className="num text-lg font-bold text-hero-num">{money(won, cur)}</p>
        </div>
      </div>
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-7" aria-busy="true">
      <div className="h-16 w-96 animate-pulse rounded-lg bg-surface" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card h-44 animate-pulse" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="card h-72 animate-pulse" />
        <div className="card h-72 animate-pulse" />
      </div>
      <div className="card h-96 animate-pulse" />
    </div>
  );
}
