import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import {
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Mail,
  Wallet,
} from "lucide-react";
import { money, shortDate, type Currency } from "@/lib/format";
import { asSystem } from "@/lib/db";
import { isDemoMode } from "@/lib/supabase/env";
import { Avatar } from "@/components/ui";

import { getSettings } from "@/lib/settings";
type Search = { tab?: string };

export default function SubHome({
  params,
  searchParams,
}: PageProps<"/s/[subId]">) {
  return (
    <Suspense fallback={<div className="flex-1 animate-pulse bg-surface" />}>
      <Home params={params} searchParams={searchParams as Promise<Search>} />
    </Suspense>
  );
}

function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

async function Home({
  params,
  searchParams,
}: {
  params: Promise<{ subId: string }>;
  searchParams: Promise<Search>;
}) {
  await connection();
  if (!isDemoMode) notFound();
  const [{ subId }, sp] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(subId)) notFound();
  const tab =
    sp.tab === "jobs" ? "jobs" : sp.tab === "revenue" ? "revenue" : "inbox";

  const data = await asSystem(async (q) => {
    const [sub] = await q<{
      id: string;
      name: string;
      company_name: string | null;
      email: string | null;
    }>(
      `select id, name, company_name, email from subcontractors where id = $1`,
      [subId],
    );
    if (!sub) return null;
    const mail = await q<{
      id: number;
      title: string;
      body: string | null;
      created_at: string;
      read_at: string | null;
      kind: string;
    }>(
      `select id, title, body, created_at, read_at, kind from notifications where subcontractor_id = $1 order by created_at desc`,
      [subId],
    );
    const jobs = await q<{
      token: string;
      title: string;
      site_address: string | null;
      invite_status: string;
      tasks: number;
      done: number;
      contractor: string;
      invoice: string | null;
      lost: boolean;
    }>(
      `select i.token, j.title, j.site_address, i.status::text as invite_status,
              (select status::text from invoices v where v.invite_id = i.id and v.kind = 'sub') as invoice,
              exists (select 1 from notifications n where n.job_id = j.id and n.subcontractor_id = i.subcontractor_id and n.kind = 'job_lost') as lost,
              (select count(*)::int from work_tasks t where t.invite_id = i.id) as tasks,
              (select count(*)::int from work_tasks t where t.invite_id = i.id and t.status = 'done') as done,
              coalesce(p.company_name, p.full_name) as contractor
         from bid_invites i join jobs j on j.id = i.job_id join profiles p on p.id = j.contractor_id
        where i.subcontractor_id = $1
        order by i.created_at desc`,
      [subId],
    );
    const invoices = await q<{
      id: string;
      number: string;
      title: string;
      currency: Currency;
      amount: number;
      status: string;
      issued_at: string;
      paid_at: string | null;
    }>(
      `select v.id, v.number, j.title, j.currency::text as currency, v.amount::float8 as amount, v.status::text as status, v.issued_at, v.paid_at
         from invoices v join bid_invites i on i.id = v.invite_id join jobs j on j.id = v.job_id
        where i.subcontractor_id = $1 and v.kind = 'sub'
        order by v.issued_at desc`,
      [subId],
    );
    return { sub, mail, jobs, invoices };
  });
  if (!data) notFound();
  const { sub, mail, jobs, invoices } = data;
  const cur: Currency = invoices[0]?.currency ?? "USD";
  const paid = invoices
    .filter((v) => v.status === "paid")
    .reduce((t, v) => t + v.amount, 0);
  const due = invoices
    .filter((v) => v.status !== "paid")
    .reduce((t, v) => t + v.amount, 0);
  const unread = mail.filter((m) => !m.read_at).length;
  const co = (await getSettings()).company_name;

  return (
    <>
      <header className="sticky top-0 z-20 bg-background/95 px-5 pt-12 pb-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <Link
            href="/s"
            className="flex size-10 items-center justify-center rounded-full bg-surface ring-1 ring-border"
            aria-label="Switch phone"
          >
            <ChevronLeft className="size-5" />
          </Link>
          <Avatar name={sub.name} />
          <div className="min-w-0">
            <p className="truncate font-semibold">{sub.name}</p>
            <p className="truncate text-xs text-muted">
              {sub.email ?? sub.company_name}
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 px-5 pt-2 pb-6">
        <h1 className="mb-4 text-[26px] font-bold tracking-tight">
          {tab === "inbox" ? "Inbox" : tab === "jobs" ? "My jobs" : "Revenue"}
        </h1>
        {tab === "inbox" ? (
          mail.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border-strong px-6 py-12 text-center">
              <Mail className="mx-auto size-8 text-subtle" />
              <p className="mt-3 font-semibold">No emails yet</p>
              <p className="mt-1 text-sm text-muted">
                Bid requests from contractors land here.
              </p>
            </div>
          ) : (
            <ul className="overflow-hidden rounded-2xl border border-border bg-surface">
              {mail.map((m) => (
                <li
                  key={m.id}
                  className="border-b border-border last:border-b-0"
                >
                  <Link
                    href={`/s/${sub.id}/mail/${m.id}`}
                    className="flex gap-3 px-4 py-3.5 active:bg-surface-2"
                  >
                    <span
                      className={`mt-1.5 size-2.5 shrink-0 rounded-full ${m.read_at ? "bg-transparent" : "bg-info"}`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span
                          className={`truncate text-[15px] ${m.read_at ? "font-medium" : "font-bold"}`}
                        >
                          {co}
                        </span>
                        <span className="shrink-0 text-xs text-subtle">
                          {ago(m.created_at)}
                        </span>
                      </span>
                      <span
                        className={`block truncate text-sm ${m.read_at ? "text-muted" : "font-semibold"}`}
                      >
                        {m.title}
                      </span>
                      <span className="block truncate text-[13px] text-subtle">
                        {m.body}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )
        ) : tab === "revenue" ? (
          <div className="space-y-4">
            <div className="hero-panel relative overflow-hidden rounded-2xl p-5">
              <p className="text-xs opacity-75">Paid to you</p>
              <p className="num mt-1 text-[34px] leading-none font-bold text-hero-num">
                {money(paid, cur, 2)}
              </p>
              <p className="mt-3 text-[13px] opacity-80">
                {money(due, cur, 2)} waiting · paid when the client pays
                {co}
              </p>
            </div>
            {invoices.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border-strong px-6 py-10 text-center">
                <Wallet className="mx-auto size-8 text-subtle" />
                <p className="mt-3 font-semibold">No invoices yet</p>
                <p className="mt-1 text-sm text-muted">
                  When you mark all your tasks done, your invoice is created and
                  sent automatically.
                </p>
              </div>
            ) : (
              <ul className="overflow-hidden rounded-2xl border border-border bg-surface">
                {invoices.map((v) => (
                  <li
                    key={v.id}
                    className="flex items-center gap-3 border-b border-border px-4 py-3.5 last:border-b-0"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold">
                        {v.title}
                      </span>
                      <span className="block text-xs text-muted">
                        {v.number} ·{" "}
                        {v.status === "paid" && v.paid_at
                          ? `paid ${shortDate(v.paid_at)}`
                          : `sent ${shortDate(v.issued_at)}`}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="num block font-bold">
                        {money(v.amount, v.currency, 2)}
                      </span>
                      <span
                        className={`text-xs font-semibold ${v.status === "paid" ? "text-success" : "text-warning-text"}`}
                      >
                        {v.status === "paid" ? "Paid" : "Waiting"}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : jobs.length === 0 ? (
          <p className="text-sm text-muted">No jobs yet.</p>
        ) : (
          <ul className="space-y-3">
            {jobs.map((j) => {
              const label =
                j.invoice === "paid"
                  ? "Done · you've been paid"
                  : j.invoice === "sent"
                    ? "Done · invoice sent, payment pending"
                    : j.lost && j.tasks === 0
                      ? "Not chosen this time"
                      : j.tasks > 0
                        ? j.done === j.tasks
                          ? "All tasks done"
                          : `You got the job · ${j.done}/${j.tasks} tasks done`
                        : j.invite_status === "submitted"
                          ? "Bid sent · waiting for the client"
                          : j.invite_status === "declined"
                            ? "You declined"
                            : "Bid needed";
              return (
                <li key={j.token}>
                  <Link
                    href={`/bid/${j.token}`}
                    className="card block p-4 active:scale-[0.99]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{j.title}</p>
                        <p className="truncate text-[13px] text-muted">
                          {j.site_address ?? j.contractor}
                        </p>
                      </div>
                      <ChevronRight className="size-5 shrink-0 text-subtle" />
                    </div>
                    <p
                      className={`mt-3 text-[13px] font-semibold ${j.tasks > 0 ? "text-success" : j.invite_status === "submitted" ? "text-muted" : "text-brand-soft-fg"}`}
                    >
                      {label}
                    </p>
                    {j.tasks > 0 && (
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2 ring-1 ring-border ring-inset">
                        <div
                          className="h-full rounded-full bg-success"
                          style={{ width: `${(j.done / j.tasks) * 100}%` }}
                        />
                      </div>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      <nav
        className="sticky bottom-0 z-30 flex border-t border-border bg-surface/95 pb-[max(env(safe-area-inset-bottom),18px)] backdrop-blur"
        aria-label="App"
      >
        <Link
          href={`/s/${sub.id}`}
          className={`relative flex flex-1 flex-col items-center gap-0.5 pt-2 text-[11px] font-semibold ${tab === "inbox" ? "text-foreground" : "text-subtle"}`}
        >
          <Inbox className="size-[22px]" />
          Inbox
          {unread > 0 && (
            <span className="num absolute top-1 left-[calc(50%+6px)] rounded-full bg-danger px-1.5 text-[10px] font-bold text-white">
              {unread}
            </span>
          )}
        </Link>
        <Link
          href={`/s/${sub.id}?tab=jobs`}
          className={`flex flex-1 flex-col items-center gap-0.5 pt-2 text-[11px] font-semibold ${tab === "jobs" ? "text-foreground" : "text-subtle"}`}
        >
          <Briefcase className="size-[22px]" />
          My jobs
        </Link>
        <Link
          href={`/s/${sub.id}?tab=revenue`}
          className={`flex flex-1 flex-col items-center gap-0.5 pt-2 text-[11px] font-semibold ${tab === "revenue" ? "text-foreground" : "text-subtle"}`}
        >
          <Wallet className="size-[22px]" />
          Revenue
        </Link>
      </nav>
    </>
  );
}
