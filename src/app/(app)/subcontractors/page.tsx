import { notFound } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { Star, Users } from "lucide-react";
import { withProfile } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { money } from "@/lib/format";
import type { Subcontractor } from "@/lib/types";
import { SubcontractorForm } from "@/components/subcontractor-form";
import { Avatar, Badge, Empty, PageHeader } from "@/components/ui";
import { FilteredList, FilteredTable } from "@/components/filtered";
import { SubDetailButton, type SubDetail } from "./sub-detail";

export default function SubcontractorsPage() {
  return (
    <Suspense fallback={<div className="card h-96 animate-pulse" />}>
      <Subcontractors />
    </Suspense>
  );
}

type Row = Subcontractor & {
  invites: number;
  bids: number;
  won: number;
  won_value: number | null;
  avg_stars: number | null;
  ratings: number;
  low: number;
};
type Rating = {
  id: string;
  sub: string;
  title: string;
  job_id: string;
  work_label: string;
  stars: number;
  reason: string | null;
  approved: boolean;
  created_at: string;
};

async function Subcontractors() {
  const data = await withProfile(async (q, me) => {
    if (me.role !== "contractor") return null;
    const subs = await q<Row>(
      `select s.*,
              (select count(*)::int from bid_invites i where i.subcontractor_id = s.id) as invites,
              (select count(*)::int from bid_invites i where i.subcontractor_id = s.id and i.status = 'submitted') as bids,
              (select count(*)::int from awards a join bid_invites i on i.id = a.invite_id
                where i.subcontractor_id = s.id and a.status = 'accepted') as won,
              (select sum(a.amount)::float8 from awards a join bid_invites i on i.id = a.invite_id
                where i.subcontractor_id = s.id and a.status = 'accepted') as won_value,
              (select round(avg(stars), 1)::float8 from work_ratings r where r.subcontractor_id = s.id) as avg_stars,
              (select count(*)::int from work_ratings r where r.subcontractor_id = s.id) as ratings,
              (select count(*)::int from work_ratings r where r.subcontractor_id = s.id and not r.approved) as low
         from subcontractors s
        where s.contractor_id = $1
        order by s.name`,
      [me.id],
    );
    const ratings = await q<Rating>(
      `select r.id, s.name as sub, j.title, j.id as job_id, r.work_label, r.stars, r.reason, r.approved, r.created_at
         from work_ratings r join subcontractors s on s.id = r.subcontractor_id join jobs j on j.id = r.job_id
        where s.contractor_id = $1
        order by r.approved, r.created_at desc`,
      [me.id],
    );
    const projects = await q<SubDetail["projects"][number] & { subcontractor_id: string }>(
      `select i.subcontractor_id, j.id as job_id, j.title, i.status::text as invite,
              (select sum(r.unit_rate * si.quantity)::float8 from bid_rates r join scope_items si on si.id = r.scope_item_id where r.invite_id = i.id) as bid_total,
              case when exists (select 1 from awards a where a.invite_id = i.id and a.status = 'accepted') then 'won'
                   when i.status = 'declined' then 'declined'
                   when i.status <> 'submitted' then 'waiting'
                   when j.status in ('accepted', 'in_progress', 'completed') then 'lost'
                   else 'pending' end as outcome,
              (select count(*)::int from work_tasks t where t.invite_id = i.id) as tasks,
              (select count(*)::int from work_tasks t where t.invite_id = i.id and t.status = 'done') as done
         from bid_invites i join jobs j on j.id = i.job_id
        where j.contractor_id = $1
        order by i.created_at desc`,
      [me.id],
    );
    const invoices = await q<SubDetail["invoices"][number] & { subcontractor_id: string }>(
      `select i.subcontractor_id, v.id, v.number, j.title, v.amount::float8 as amount, v.status::text as status, v.issued_at
         from invoices v join bid_invites i on i.id = v.invite_id join jobs j on j.id = v.job_id
        where j.contractor_id = $1 and v.kind = 'sub'
        order by v.issued_at desc`,
      [me.id],
    );
    const ratingRows = await q<SubDetail["ratings"][number] & { subcontractor_id: string }>(
      `select r.subcontractor_id, r.id, j.title, r.work_label, r.stars, r.reason, r.approved, r.created_at
         from work_ratings r join jobs j on j.id = r.job_id
        where j.contractor_id = $1
        order by r.created_at desc`,
      [me.id],
    );
    return { subs, ratings, projects, invoices, ratingRows };
  });
  if (!data) notFound();
  const { subs, ratings, projects, invoices, ratingRows } = data;
  const details = new Map<string, SubDetail>(
    subs.map((s) => [
      s.id,
      {
        id: s.id,
        name: s.name,
        company_name: s.company_name,
        email: s.email,
        phone: s.phone,
        trades: s.trades,
        notes: (s as { notes?: string | null }).notes ?? null,
        projects: projects.filter((p) => p.subcontractor_id === s.id),
        ratings: ratingRows.filter((r) => r.subcontractor_id === s.id),
        invoices: invoices.filter((v) => v.subcontractor_id === s.id),
      },
    ]),
  );
  const { rating_threshold: t } = await getSettings();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sub-contractors"
        description="Your private list of trades. Only you can see it."
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        {subs.length === 0 ? (
          <Empty icon={Users} title="No sub-contractors yet">
            Add the trades you work with. You&apos;ll pick from this list when
            you request bids.
          </Empty>
        ) : (
          <FilteredTable
            noun="sub-contractors"
            search="Search name, company or email"
            minWidth={760}
            filters={[
              {
                key: "trade",
                label: "Trade",
                options: [...new Set(subs.flatMap((s) => s.trades))]
                  .sort()
                  .map((t) => ({ value: t, label: t })),
              },
              {
                key: "rating",
                label: "Rating",
                options: [
                  { value: "good", label: `${t}★ and up` },
                  { value: "low", label: "Has low ratings" },
                  { value: "none", label: "Not rated yet" },
                ],
              },
            ]}
            head={
              <tr className="text-left text-xs text-muted">
                <th className="border-b border-border bg-surface-2 px-5 py-3 font-medium">
                  Name
                </th>
                <th className="border-b border-border bg-surface-2 px-3 py-3 font-medium">
                  Trades
                </th>
                <th className="border-b border-border bg-surface-2 px-3 py-3 font-medium">
                  Client rating
                </th>
                <th className="border-b border-border bg-surface-2 px-3 py-3 text-right font-medium">
                  Bids
                </th>
                <th className="border-b border-border bg-surface-2 px-5 py-3 text-right font-medium">
                  Work won
                </th>
              </tr>
            }
            items={subs.flatMap((s) => {
              const node = (
                <tr key={s.id} className="hover:bg-surface-2/60">
                  <td className="border-b border-border px-5 py-3.5">
                    <SubDetailButton sub={details.get(s.id)!} />
                  </td>
                  <td className="border-b border-border px-3 py-3.5">
                    <div className="flex flex-wrap gap-1">
                      {s.trades.length ? (
                        s.trades.map((t) => (
                          <span
                            key={t}
                            className="rounded-md bg-surface-2 px-2 py-0.5 text-xs ring-1 ring-border"
                          >
                            {t}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-subtle">—</span>
                      )}
                    </div>
                  </td>
                  <td className="border-b border-border px-3 py-3.5">
                    {s.ratings ? (
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                        <Star className="size-4 fill-warning text-warning" />
                        <span className="num font-semibold">
                          {s.avg_stars?.toFixed(1)}
                        </span>
                        <span className="text-xs text-subtle">
                          ({s.ratings})
                        </span>
                        {s.low > 0 && <Badge tone="danger">{s.low} low</Badge>}
                      </span>
                    ) : (
                      <span className="text-xs text-subtle">
                        No ratings yet
                      </span>
                    )}
                  </td>
                  <td className="num border-b border-border px-3 py-3.5 text-right">
                    {s.bids}
                    <span className="text-subtle">/{s.invites}</span>
                  </td>
                  <td className="num border-b border-border px-5 py-3.5 text-right font-semibold">
                    {s.won ? (
                      money(s.won_value ?? 0, "USD")
                    ) : (
                      <span className="font-normal text-subtle">—</span>
                    )}
                  </td>
                </tr>
              );
              const rating = !s.ratings ? "none" : s.low > 0 ? "low" : "good";
              const text = `${s.name} ${s.company_name ?? ""} ${s.email ?? ""} ${s.trades.join(" ")}`;
              // one entry per trade so the Trade filter matches any of them (React keys stay unique per shown list)
              return (s.trades.length ? s.trades : [""]).map((t, i) => ({
                text,
                tags: { trade: t, rating, sub: s.id, dup: String(i) },
                node,
              }));
            })}
            dedupeBy="sub"
          />
        )}
        <SubcontractorForm open />
      </div>

      <section className="space-y-3">
        <h2 className="text-[15px] font-semibold">
          Client feedback{" "}
          <span className="num ml-1 text-muted">{ratings.length}</span>
        </h2>
        <p className="-mt-2 text-[13px] text-muted">
          After paying, clients rate each part of the work. {t}★ or more is
          approved automatically; below {t}★ the client must say why.
        </p>
        {ratings.length === 0 ? (
          <Empty icon={Star} title="No feedback yet">
            Clients are asked to rate the work as soon as they pay the final
            invoice.
          </Empty>
        ) : (
          <FilteredList
            noun="ratings"
            search="Search sub-contractor, project or reason"
            filters={[
              {
                key: "result",
                label: "Result",
                options: [
                  { value: "approved", label: "Approved (4★+)" },
                  { value: "attention", label: "Needs attention" },
                ],
              },
              {
                key: "stars",
                label: "Stars",
                options: [5, 4, 3, 2, 1].map((n) => ({
                  value: String(n),
                  label: `${n}★`,
                })),
              },
              {
                key: "sub",
                label: "Sub-contractor",
                options: [...new Set(ratings.map((r) => r.sub))]
                  .sort()
                  .map((n) => ({ value: n, label: n })),
              },
            ]}
            items={ratings.map((r) => ({
              text: `${r.sub} ${r.title} ${r.work_label} ${r.reason ?? ""}`,
              tags: {
                result: r.approved ? "approved" : "attention",
                stars: String(r.stars),
                sub: r.sub,
              },
              node: (
                <li
                  key={r.id}
                  className="flex items-start gap-4 px-5 py-3.5 text-sm"
                >
                  <Avatar name={r.sub} />
                  <div className="min-w-0 flex-1">
                    <p>
                      <span className="font-semibold">{r.sub}</span>{" "}
                      <span className="text-muted">
                        · {r.work_label} ·{" "}
                        <Link
                          href={`/jobs/${r.job_id}/progress`}
                          className="hover:underline"
                        >
                          {r.title}
                        </Link>
                      </span>
                    </p>
                    {r.reason && (
                      <p className="mt-1 rounded-lg bg-danger-soft px-3 py-1.5 text-[13px] text-danger">
                        “{r.reason}”
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-warning" aria-label={`${r.stars} stars`}>
                      {"★".repeat(r.stars)}
                      <span className="text-border-strong">
                        {"★".repeat(5 - r.stars)}
                      </span>
                    </p>
                    <div className="mt-1">
                      {r.approved ? (
                        <Badge tone="success">Approved</Badge>
                      ) : (
                        <Badge tone="danger">Needs attention</Badge>
                      )}
                    </div>
                  </div>
                </li>
              ),
            }))}
          />
        )}
      </section>
    </div>
  );
}
