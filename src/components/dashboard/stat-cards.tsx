"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Briefcase, ChevronRight, Inbox, Receipt, Search, Trophy, type LucideIcon } from "lucide-react";
import { money } from "@/lib/format";
import { JOB_STATUS_LABEL, QUOTE_STATUS_LABEL, type QuoteStatus } from "@/lib/types";
import { Avatar, IconTile, MiniProgress, StatusPill } from "@/components/ui";
import { Modal } from "@/components/modal";
import { Pagination, usePaged } from "@/components/pagination";
import type { BidRow, ProjectRow, QuoteRow } from "./types";

type Kind = "active" | "bids" | "awaiting" | "value";
type Tone = "brand" | "info" | "warning" | "success";

const PAGE = 6;

function ago(iso: string | null) {
  if (!iso) return "—";
  const h = Math.round((Date.now() - new Date(iso).getTime()) / 36e5);
  if (h < 1) return "just now";
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

export function StatCards({
  role,
  projects,
  bids,
  quotes,
}: {
  role: "owner" | "contractor";
  projects: ProjectRow[];
  bids: BidRow[];
  quotes: QuoteRow[];
}) {
  const [open, setOpen] = useState<Kind | null>(null);
  const cur = projects[0]?.currency ?? "USD";
  const active = projects.filter((p) => !["accepted", "completed", "cancelled"].includes(p.status));
  const awaiting = quotes.filter((q) => q.status === "sent");
  const valued = quotes.filter((q) => q.status !== "draft");
  const won = quotes.filter((q) => q.status === "accepted");
  const value = valued.reduce((s, q) => s + q.total, 0);
  const isC = role === "contractor";

  const cards: { kind: Kind; label: string; value: string | number; hint: string; icon: LucideIcon; tone: Tone }[] = [
    { kind: "active", label: "Active projects", value: active.length, hint: `${projects.length} in total`, icon: Briefcase, tone: "brand" },
    isC
      ? { kind: "bids", label: "Bids received", value: bids.length, hint: `across ${new Set(bids.map((b) => b.jobId)).size} projects`, icon: Inbox, tone: "info" }
      : { kind: "awaiting", label: "Quotes to review", value: awaiting.length, hint: "waiting for your reply", icon: Inbox, tone: "info" },
    isC
      ? { kind: "awaiting", label: "Awaiting client", value: awaiting.length, hint: "quotes sent, no reply yet", icon: Receipt, tone: "warning" }
      : { kind: "value", label: "Accepted", value: won.length, hint: "quotes you accepted", icon: Receipt, tone: "warning" },
    { kind: "value", label: isC ? "Quoted value" : "Total quoted", value: money(value, cur), hint: `${won.length} accepted · ${money(won.reduce((s, q) => s + q.total, 0), cur)}`, icon: Trophy, tone: "success" },
  ];

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <button
            key={c.label}
            onClick={() => setOpen(c.kind)}
            className="card group flex flex-col p-5 text-left transition hover:-translate-y-0.5 hover:border-border-strong hover:shadow-pop focus-visible:ring-4 focus-visible:ring-select-ring focus-visible:outline-none"
          >
            <div className="flex items-start justify-between">
              <IconTile icon={c.icon} tone={c.tone} />
              <span className="flex size-7 items-center justify-center rounded-full text-subtle transition group-hover:bg-surface-2 group-hover:text-foreground">
                <ChevronRight className="size-4" />
              </span>
            </div>
            <p className="mt-4 text-[13px] font-medium text-muted">{c.label}</p>
            <p className="num mt-0.5 text-[28px] leading-tight font-bold">{c.value}</p>
            <p className="mt-1 text-xs text-subtle">{c.hint}</p>
            <p className="mt-4 border-t border-border pt-3 text-xs font-semibold text-muted transition group-hover:text-foreground">View details →</p>
          </button>
        ))}
      </div>

      {open === "active" && (
        <ListModal
          title="Active projects"
          subtitle={`${active.length} projects in progress`}
          icon={<IconTile icon={Briefcase} tone="brand" />}
          items={active}
          filter={(p, t) => `${p.title} ${p.client ?? ""} ${p.address ?? ""}`.toLowerCase().includes(t)}
          noun="projects"
          onClose={() => setOpen(null)}
          render={(p) => (
            <Link href={`/jobs/${p.id}`} className="flex items-center gap-4 px-6 py-3.5 transition hover:bg-surface-2">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{p.title}</p>
                <p className="truncate text-xs text-muted">
                  {p.client ?? "No client yet"} · {p.items} items · updated {ago(p.updatedAt)}
                </p>
              </div>
              <div className="hidden sm:block">
                <MiniProgress status={p.status} />
              </div>
              <StatusPill status={p.status}>{JOB_STATUS_LABEL[p.status]}</StatusPill>
              <ChevronRight className="size-4 shrink-0 text-subtle" />
            </Link>
          )}
        />
      )}

      {open === "bids" && (
        <ListModal
          title="Bids received"
          subtitle={`${bids.length} bids from sub-contractors`}
          icon={<IconTile icon={Inbox} tone="info" />}
          items={bids}
          filter={(b, t) => `${b.sub} ${b.company ?? ""} ${b.project}`.toLowerCase().includes(t)}
          noun="bids"
          onClose={() => setOpen(null)}
          render={(b) => (
            <Link href={`/jobs/${b.jobId}/compare`} className="flex items-center gap-3.5 px-6 py-3.5 transition hover:bg-surface-2">
              <Avatar name={b.sub} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">
                  {b.sub}
                  {b.company && <span className="font-normal text-muted"> · {b.company}</span>}
                </p>
                <p className="truncate text-xs text-muted">
                  {b.project} · {b.priced}/{b.invited} priced · {ago(b.submittedAt)}
                </p>
              </div>
              <p className="num shrink-0 font-semibold">{money(b.total, b.currency)}</p>
              <ChevronRight className="size-4 shrink-0 text-subtle" />
            </Link>
          )}
        />
      )}

      {open === "awaiting" && (
        <ListModal
          title={isC ? "Awaiting client" : "Quotes to review"}
          subtitle={isC ? "Quotes you've sent that have no reply yet" : "Quotes waiting for your decision"}
          icon={<IconTile icon={Receipt} tone="warning" />}
          items={awaiting}
          filter={(q, t) => `${q.project} ${q.client ?? ""}`.toLowerCase().includes(t)}
          noun="quotes"
          onClose={() => setOpen(null)}
          render={(q) => <QuoteItem q={q} />}
          empty={isC ? "No quotes waiting on a client." : "No quotes waiting for you."}
        />
      )}

      {open === "value" && (
        <ListModal
          title={isC ? "Quoted value" : "Your quotes"}
          subtitle={`${valued.length} quotes · ${money(value, cur)} in total`}
          icon={<IconTile icon={Trophy} tone="success" />}
          items={valued}
          filter={(q, t) => `${q.project} ${q.client ?? ""} ${q.status}`.toLowerCase().includes(t)}
          noun="quotes"
          onClose={() => setOpen(null)}
          render={(q) => <QuoteItem q={q} />}
          footer={() => (
            <div className="flex justify-between text-[13px]">
              <span className="text-muted">Accepted</span>
              <span className="num font-semibold text-success">{money(won.reduce((s, q) => s + q.total, 0), cur)}</span>
            </div>
          )}
        />
      )}
    </>
  );
}

function QuoteItem({ q }: { q: QuoteRow }) {
  return (
    <Link href={`/jobs/${q.jobId}/quote`} className="flex items-center gap-4 px-6 py-3.5 transition hover:bg-surface-2">
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{q.project}</p>
        <p className="truncate text-xs text-muted">
          {q.client ?? "Client"} · version {q.version} · sent {ago(q.sentAt)}
        </p>
      </div>
      <StatusPill status={q.status}>{QUOTE_STATUS_LABEL[q.status as QuoteStatus] ?? q.status}</StatusPill>
      <p className="num w-24 shrink-0 text-right font-semibold">{money(q.total, q.currency)}</p>
      <ChevronRight className="size-4 shrink-0 text-subtle" />
    </Link>
  );
}

function ListModal<T>({
  title,
  subtitle,
  icon,
  items,
  filter,
  render,
  noun,
  onClose,
  footer,
  empty = "Nothing here yet.",
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  items: T[];
  filter: (item: T, term: string) => boolean;
  render: (item: T) => React.ReactNode;
  noun: string;
  onClose: () => void;
  footer?: (rows: T[]) => React.ReactNode;
  empty?: string;
}) {
  const [term, setTerm] = useState("");
  const filtered = useMemo(() => (term.trim() ? items.filter((i) => filter(i, term.trim().toLowerCase())) : items), [items, term, filter]);
  const paged = usePaged(filtered, PAGE);

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      icon={icon}
      footer={
        <div className="space-y-3">
          <Pagination page={paged.page} pageCount={paged.pageCount} total={paged.total} pageSize={PAGE} onChange={paged.setPage} noun={noun} />
          {footer && paged.total > 0 && <div className="border-t border-border pt-3">{footer(filtered)}</div>}
        </div>
      }
    >
      <div className="border-b border-border px-6 py-3">
        <label className="relative block">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
          <input
            value={term}
            onChange={(e) => {
              setTerm(e.target.value);
              paged.setPage(1);
            }}
            placeholder={`Search ${noun}…`}
            className="input pl-9"
            aria-label={`Search ${noun}`}
          />
        </label>
      </div>
      {paged.rows.length === 0 ? (
        <p className="px-6 py-14 text-center text-sm text-muted">{term ? `No ${noun} match “${term}”.` : empty}</p>
      ) : (
        <ul className="divide-y divide-border">
          {paged.rows.map((r, i) => (
            <li key={i}>{render(r)}</li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
