"use client";

import Link from "next/link";
import { useState } from "react";
import { Briefcase, Mail, Phone, Receipt, Star, Trophy } from "lucide-react";
import { Modal } from "@/components/modal";
import { Avatar, Badge } from "@/components/ui";
import { money, shortDate } from "@/lib/format";

export type SubDetail = {
  id: string;
  name: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  trades: string[];
  notes: string | null;
  projects: { job_id: string; title: string; invite: string; bid_total: number | null; outcome: "won" | "lost" | "pending" | "declined" | "waiting"; tasks: number; done: number }[];
  ratings: { id: string; title: string; work_label: string; stars: number; reason: string | null; approved: boolean; created_at: string }[];
  invoices: { id: string; number: string; title: string; amount: number; status: string; issued_at: string }[];
};

const OUTCOME: Record<SubDetail["projects"][number]["outcome"], { label: string; tone: "success" | "danger" | "info" | "neutral" | "warning" }> = {
  won: { label: "Won", tone: "success" },
  lost: { label: "Not chosen", tone: "danger" },
  pending: { label: "Bid sent", tone: "info" },
  waiting: { label: "No bid yet", tone: "warning" },
  declined: { label: "Declined", tone: "neutral" },
};

function Stars({ n }: { n: number }) {
  return (
    <span className="whitespace-nowrap text-warning" aria-label={`${n} stars`}>
      {"★".repeat(n)}
      <span className="text-border-strong">{"★".repeat(5 - n)}</span>
    </span>
  );
}

/** The sub-contractor's name in the table; click for everything about them. */
export function SubDetailButton({ sub }: { sub: SubDetail }) {
  const [open, setOpen] = useState(false);
  const won = sub.projects.filter((p) => p.outcome === "won");
  const bids = sub.projects.filter((p) => p.bid_total != null);
  const avg = sub.ratings.length ? sub.ratings.reduce((s, r) => s + r.stars, 0) / sub.ratings.length : null;
  const paid = sub.invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.amount, 0);
  const due = sub.invoices.filter((i) => i.status !== "paid").reduce((s, i) => s + i.amount, 0);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-3 text-left">
        <Avatar name={sub.name} />
        <span className="min-w-0">
          <span className="block font-semibold hover:underline">{sub.name}</span>
          <span className="block text-xs text-subtle">{sub.company_name ?? sub.email ?? ""}</span>
        </span>
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={sub.name}
        subtitle={[sub.company_name, sub.trades.join(", ")].filter(Boolean).join(" · ")}
        icon={<Avatar name={sub.name} size="lg" />}
      >
        <div className="space-y-6 p-6">
          {/* contact */}
          <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
            {sub.email && (
              <a href={`mailto:${sub.email}`} className="inline-flex items-center gap-1.5 text-brand-soft-fg hover:underline">
                <Mail className="size-4" /> {sub.email}
              </a>
            )}
            {sub.phone && (
              <a href={`tel:${sub.phone}`} className="inline-flex items-center gap-1.5 text-brand-soft-fg hover:underline">
                <Phone className="size-4" /> {sub.phone}
              </a>
            )}
            {sub.notes && <p className="w-full text-muted">{sub.notes}</p>}
          </div>

          {/* stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { icon: Briefcase, label: "Bids sent", value: `${bids.length} of ${sub.projects.length}` },
              { icon: Trophy, label: "Jobs won", value: String(won.length) },
              { icon: Star, label: "Client rating", value: avg ? `${avg.toFixed(1)}★ (${sub.ratings.length})` : "—" },
              { icon: Receipt, label: "Paid to them", value: money(paid, "USD"), hint: due ? `${money(due, "USD")} waiting` : undefined },
            ].map((s) => (
              <div key={s.label} className="rounded-[12px] border border-border bg-surface-2 p-3">
                <p className="flex items-center gap-1.5 text-xs text-muted">
                  <s.icon className="size-3.5" /> {s.label}
                </p>
                <p className="num mt-1 text-lg font-bold">{s.value}</p>
                {s.hint && <p className="text-xs text-subtle">{s.hint}</p>}
              </div>
            ))}
          </div>

          {/* feedback */}
          <section>
            <h3 className="mb-2 text-sm font-semibold">Client feedback</h3>
            {sub.ratings.length === 0 ? (
              <p className="text-sm text-muted">No ratings yet.</p>
            ) : (
              <ul className="divide-y divide-border rounded-[12px] border border-border">
                {sub.ratings.map((r) => (
                  <li key={r.id} className="flex items-start gap-3 px-4 py-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        {r.title} <span className="font-normal text-muted">· {r.work_label}</span>
                      </p>
                      {r.reason && <p className="mt-1 rounded-lg bg-danger-soft px-2.5 py-1 text-[13px] text-danger">“{r.reason}”</p>}
                      <p className="mt-0.5 text-xs text-subtle">{shortDate(r.created_at)}</p>
                    </div>
                    <div className="text-right">
                      <Stars n={r.stars} />
                      <div className="mt-1">{r.approved ? <Badge tone="success">Approved</Badge> : <Badge tone="danger">Needs attention</Badge>}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* projects */}
          <section>
            <h3 className="mb-2 text-sm font-semibold">Projects</h3>
            {sub.projects.length === 0 ? (
              <p className="text-sm text-muted">Not invited to any project yet.</p>
            ) : (
              <ul className="divide-y divide-border rounded-[12px] border border-border">
                {sub.projects.map((p) => (
                  <li key={p.job_id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <Link href={`/jobs/${p.job_id}`} className="min-w-0 flex-1 truncate font-medium hover:underline">
                      {p.title}
                    </Link>
                    {p.tasks > 0 && (
                      <span className="text-xs text-muted">
                        {p.done}/{p.tasks} tasks
                      </span>
                    )}
                    <span className="num w-24 text-right font-semibold">{p.bid_total != null ? money(p.bid_total, "USD") : "—"}</span>
                    <Badge tone={OUTCOME[p.outcome].tone}>{OUTCOME[p.outcome].label}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* invoices */}
          {sub.invoices.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-semibold">Invoices</h3>
              <ul className="divide-y divide-border rounded-[12px] border border-border">
                {sub.invoices.map((i) => (
                  <li key={i.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <span className="num font-semibold">{i.number}</span>
                    <span className="min-w-0 flex-1 truncate text-muted">{i.title}</span>
                    <span className="num font-semibold">{money(i.amount, "USD", 2)}</span>
                    {i.status === "paid" ? <Badge tone="success">Paid</Badge> : <Badge tone="info">Waiting</Badge>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </Modal>
    </>
  );
}
