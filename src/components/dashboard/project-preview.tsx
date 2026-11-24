"use client";

import Link from "next/link";
import { ArrowRight, Clock, ClipboardList, Flag, Inbox, MapPin, Receipt, TrendingDown, type LucideIcon } from "lucide-react";
import { money, shortDate } from "@/lib/format";
import { contractorNextAction } from "@/lib/next-action";
import { JOB_STATUS_LABEL, QUOTE_STATUS_LABEL, type QuoteStatus } from "@/lib/types";
import { Avatar, MiniProgress, StatusPill } from "@/components/ui";
import { Modal } from "@/components/modal";
import type { BidRow, ProjectRow } from "./types";

/** Quick look at one project from the dashboard table, with a link to the full page. */
export function ProjectPreview({
  project: p,
  bids,
  role,
  onClose,
}: {
  project: ProjectRow;
  bids: BidRow[];
  role: "owner" | "contractor";
  onClose: () => void;
}) {
  const isC = role === "contractor";
  const complete = bids.filter((b) => b.priced >= b.invited);
  const lowest = (complete.length ? complete : bids).reduce<BidRow | null>((m, b) => (!m || b.total < m.total ? b : m), null);
  const next = isC
    ? contractorNextAction({ jobId: p.id, status: p.status, items: p.items, invites: p.bidsOut, bidsIn: p.bidsIn, quoteStatus: p.quoteStatus })
    : null;

  const facts: { icon: LucideIcon; label: string; value: string; sub?: string }[] = [
    { icon: ClipboardList, label: "Work items", value: String(p.items) },
    ...(isC
      ? [
          { icon: Inbox, label: "Bids in", value: p.bidsOut ? `${p.bidsIn} of ${p.bidsOut}` : "None yet" },
          {
            icon: TrendingDown,
            label: "Lowest bid",
            value: lowest ? money(lowest.total, p.currency) : "—",
            sub: lowest ? lowest.sub : undefined,
          },
        ]
      : []),
    {
      icon: Receipt,
      label: "Client quote",
      value: p.quoteTotal != null && p.quoteStatus !== "draft" ? money(p.quoteTotal, p.currency) : "Not sent",
      sub: p.quoteStatus && p.quoteStatus !== "draft" ? QUOTE_STATUS_LABEL[p.quoteStatus as QuoteStatus] : undefined,
    },
  ];

  return (
    <Modal
      open
      onClose={onClose}
      title={p.title}
      subtitle={
        <span className="inline-flex items-center gap-1.5">
          <MapPin className="size-3.5" /> {p.address ?? "No address"}
        </span>
      }
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2.5">
          {next?.href && next.cta && !next.waiting && (
            <Link href={next.href} className="btn-secondary">
              {next.cta}
            </Link>
          )}
          <Link href={`/jobs/${p.id}`} className="btn-primary">
            View project <ArrowRight />
          </Link>
        </div>
      }
    >
      <div className="space-y-5 px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {p.client && <Avatar name={p.client} />}
            <div className="text-sm">
              <p className="text-xs text-muted">{isC ? "Client" : "Builder"}</p>
              <p className="font-semibold">{p.client ?? "Not added yet"}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <StatusPill status={p.status}>{JOB_STATUS_LABEL[p.status]}</StatusPill>
            <MiniProgress status={p.status} />
          </div>
        </div>

        <div className={`grid gap-3 ${facts.length === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2"}`}>
          {facts.map((f) => (
            <div key={f.label} className="rounded-xl border border-border bg-surface-2 p-3.5">
              <f.icon className="size-4 text-subtle" />
              <p className="mt-2 text-xs text-muted">{f.label}</p>
              <p className="num text-[15px] font-bold">{f.value}</p>
              {f.sub && <p className="truncate text-xs text-subtle">{f.sub}</p>}
            </div>
          ))}
        </div>

        {next && (
          <div
            className={`flex gap-3 rounded-xl border p-4 ${next.waiting ? "border-border bg-surface" : "border-brand-soft-line bg-brand-soft"}`}
          >
            {next.waiting ? <Clock className="mt-0.5 size-5 shrink-0 text-muted" /> : <Flag className="mt-0.5 size-5 shrink-0 text-brand-soft-fg" />}
            <div className="text-sm">
              <p className={`text-[11px] font-semibold tracking-[0.08em] uppercase ${next.waiting ? "text-subtle" : "text-brand-soft-fg"}`}>
                {next.waiting ? "Waiting" : "Next step"}
              </p>
              <p className="font-semibold">{next.title}</p>
              <p className="text-[13px] text-muted">{next.body}</p>
            </div>
          </div>
        )}

        {isC && bids.length > 0 && (
          <div>
            <p className="eyebrow mb-2">Bids</p>
            <ul className="divide-y divide-border rounded-xl border border-border">
              {[...bids]
                .sort((a, b) => a.total - b.total)
                .slice(0, 4)
                .map((b) => (
                  <li key={b.id} className="flex items-center gap-3 px-3.5 py-2.5 text-sm">
                    <Avatar name={b.sub} size="sm" />
                    <span className="min-w-0 flex-1 truncate">
                      {b.sub}
                      <span className="text-xs text-subtle">
                        {" "}
                        · {b.priced}/{b.invited} priced
                      </span>
                    </span>
                    <span className={`num font-semibold ${b.id === lowest?.id ? "text-success" : ""}`}>{money(b.total, b.currency)}</span>
                  </li>
                ))}
            </ul>
            {bids.length > 4 && <p className="mt-1.5 text-xs text-muted">+ {bids.length - 4} more on the project page</p>}
          </div>
        )}

        <p className="text-xs text-subtle">Last updated {shortDate(p.updatedAt)}</p>
      </div>
    </Modal>
  );
}
