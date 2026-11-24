import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Hourglass,
  PiggyBank,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { withProfile } from "@/lib/auth";
import { money, shortDate, type Currency } from "@/lib/format";
import { Empty, IconTile, PageHeader } from "@/components/ui";
import { FilteredList, FilteredTable } from "@/components/filtered";

export default function RevenuePage() {
  return (
    <Suspense fallback={<div className="card h-96 animate-pulse" />}>
      <Revenue />
    </Suspense>
  );
}

type ProjectRow = {
  id: string;
  title: string;
  currency: Currency;
  received: number;
  paid_out: number;
  status: string;
  paid_at: string | null;
};
type Move = {
  id: number;
  title: string;
  currency: Currency;
  direction: "in" | "out";
  amount: number;
  created_at: string;
  who: string | null;
  number: string;
};

async function Revenue() {
  const data = await withProfile(async (q, me) => {
    if (me.role !== "contractor") return null;
    const projects = await q<ProjectRow>(
      `select j.id, j.title, j.currency::text as currency,
              coalesce((select sum(amount) from payments p where p.job_id = j.id and p.direction = 'in'), 0)::float8 as received,
              coalesce((select sum(amount) from payments p where p.job_id = j.id and p.direction = 'out'), 0)::float8 as paid_out,
              ci.status::text as status, ci.paid_at
         from jobs j join invoices ci on ci.job_id = j.id and ci.kind = 'client'
        where j.contractor_id = $1
        order by coalesce(ci.paid_at, ci.issued_at) desc`,
      [me.id],
    );
    const [pending] = await q<{ amount: number }>(
      `select coalesce(sum(i.amount), 0)::float8 as amount from invoices i join jobs j on j.id = i.job_id
        where j.contractor_id = $1 and i.kind = 'client' and i.status = 'sent'`,
      [me.id],
    );
    const moves = await q<Move>(
      `select p.id, j.title, j.currency::text as currency, p.direction, p.amount::float8 as amount, p.created_at, i.number,
              case when p.direction = 'in' then coalesce(o.full_name, o.email) else s.name end as who
         from payments p join jobs j on j.id = p.job_id join invoices i on i.id = p.invoice_id
         left join profiles o on o.id = j.owner_id
         left join bid_invites bi on bi.id = i.invite_id left join subcontractors s on s.id = bi.subcontractor_id
        where j.contractor_id = $1
        order by p.created_at desc, p.id desc
        limit 500`,
      [me.id],
    );
    return { projects, pending: pending.amount, moves };
  });
  if (!data) notFound();
  const { projects, pending, moves } = data;
  const cur: Currency = projects[0]?.currency ?? "USD";
  const received = projects.reduce((s, p) => s + p.received, 0);
  const paidOut = projects.reduce((s, p) => s + p.paid_out, 0);
  const margin = received - paidOut;

  const cards: {
    label: string;
    value: string;
    hint: string;
    icon: LucideIcon;
    tone: "brand" | "success" | "info" | "warning";
  }[] = [
    {
      label: "Received from clients",
      value: money(received, cur),
      hint: `${projects.filter((p) => p.received > 0).length} paid invoices`,
      icon: ArrowDownLeft,
      tone: "info",
    },
    {
      label: "Paid to sub-contractors",
      value: money(paidOut, cur),
      hint: "paid automatically",
      icon: ArrowUpRight,
      tone: "brand",
    },
    {
      label: "Your margin",
      value: money(margin, cur),
      hint:
        received > 0
          ? `${((margin / received) * 100).toFixed(1)}% of what clients paid`
          : "nothing paid yet",
      icon: PiggyBank,
      tone: "success",
    },
    {
      label: "Waiting for clients",
      value: money(pending, cur),
      hint: "invoices sent, not paid yet",
      icon: Hourglass,
      tone: "warning",
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Revenue"
        description="What clients paid you, what went to sub-contractors, and the margin you kept."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="card p-5">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-medium text-muted">{c.label}</p>
              <IconTile icon={c.icon} tone={c.tone} size="sm" />
            </div>
            <p className="num mt-3 text-[28px] leading-none font-bold tracking-tight">
              {c.value}
            </p>
            <p className="mt-2 text-xs text-subtle">{c.hint}</p>
          </div>
        ))}
      </div>

      {projects.length === 0 ? (
        <Empty icon={TrendingUp} title="No revenue yet">
          When a project is finished, send the client an invoice from{" "}
          <Link href="/invoices" className="link">
            Invoices
          </Link>
          . Payments show up here.
        </Empty>
      ) : (
        <section className="space-y-3">
          <h2 className="text-[15px] font-semibold">By project</h2>
          <FilteredTable
            noun="projects"
            search="Search projects"
            filters={[
              {
                key: "status",
                label: "Payment",
                options: [
                  { value: "paid", label: "Paid" },
                  { value: "sent", label: "Waiting for client" },
                ],
              },
            ]}
            head={
              <tr className="text-left text-xs text-muted">
                <th className="border-b border-border bg-surface-2 px-5 py-3 font-medium">
                  Project
                </th>
                <th className="border-b border-border bg-surface-2 px-3 py-3 text-right font-medium">
                  Client paid
                </th>
                <th className="border-b border-border bg-surface-2 px-3 py-3 text-right font-medium">
                  Paid to subs
                </th>
                <th className="border-b border-border bg-surface-2 px-3 py-3 text-right font-medium">
                  Your margin
                </th>
                <th className="border-b border-border bg-surface-2 px-5 py-3 text-right font-medium">
                  Margin %
                </th>
              </tr>
            }
            items={projects.map((p) => {
              const m = p.received - p.paid_out;
              return {
                text: p.title,
                tags: { status: p.status },
                node: (
                  <tr key={p.id} className="hover:bg-surface-2/60">
                    <td className="border-b border-border px-5 py-3">
                      <Link
                        href={`/jobs/${p.id}/progress`}
                        className="font-medium hover:underline"
                      >
                        {p.title}
                      </Link>
                      <span className="block text-xs text-muted">
                        {p.status === "paid"
                          ? `Paid ${p.paid_at ? shortDate(p.paid_at) : ""}`
                          : "Invoice sent, waiting for payment"}
                      </span>
                    </td>
                    <td className="num border-b border-border px-3 py-3 text-right">
                      {p.received ? money(p.received, p.currency, 2) : "—"}
                    </td>
                    <td className="num border-b border-border px-3 py-3 text-right">
                      {p.paid_out ? money(p.paid_out, p.currency, 2) : "—"}
                    </td>
                    <td className="num border-b border-border px-3 py-3 text-right font-semibold text-success">
                      {p.received ? money(m, p.currency, 2) : "—"}
                    </td>
                    <td className="num border-b border-border px-5 py-3 text-right">
                      {p.received
                        ? `${((m / p.received) * 100).toFixed(1)}%`
                        : "—"}
                    </td>
                  </tr>
                ),
              };
            })}
          />
        </section>
      )}

      {moves.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-[15px] font-semibold">Payments</h2>
          <FilteredList
            noun="payments"
            search="Search payments"
            filters={[
              {
                key: "dir",
                label: "Type",
                options: [
                  { value: "in", label: "From clients" },
                  { value: "out", label: "To sub-contractors" },
                ],
              },
              {
                key: "project",
                label: "Project",
                options: [...new Set(moves.map((m) => m.title))]
                  .sort()
                  .map((t) => ({ value: t, label: t })),
              },
            ]}
            items={moves.map((m) => ({
              text: `${m.who ?? ""} ${m.number} ${m.title}`,
              tags: { dir: m.direction, project: m.title },
              node: (
                <li
                  key={m.id}
                  className="flex items-center gap-3 px-5 py-3 text-sm"
                >
                  <IconTile
                    icon={m.direction === "in" ? ArrowDownLeft : ArrowUpRight}
                    tone={m.direction === "in" ? "success" : "neutral"}
                    size="sm"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {m.direction === "in"
                        ? `${m.who ?? "Client"} paid ${m.number}`
                        : `Paid ${m.who ?? "sub-contractor"} · ${m.number}`}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {m.title} · {shortDate(m.created_at)}
                    </span>
                  </span>
                  <span
                    className={`num font-semibold ${m.direction === "in" ? "text-success" : ""}`}
                  >
                    {m.direction === "in" ? "+" : "−"}
                    {money(m.amount, m.currency, 2)}
                  </span>
                </li>
              ),
            }))}
          />
        </section>
      )}
    </div>
  );
}
