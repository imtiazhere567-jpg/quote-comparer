import Link from "next/link";
import { Suspense } from "react";
import {
  ArrowRight,
  Bell,
  ChevronRight,
  CircleCheck,
  FileText,
  HardHat,
  House,
  MapPin,
  Plus,
  Star,
  Receipt,
} from "lucide-react";
import { withOwner } from "@/lib/mobile-auth";
import { money } from "@/lib/format";
import type { Job } from "@/lib/types";
import { OwnerMiniProgress } from "@/components/mobile/owner-progress";
import { TabBar } from "@/components/mobile/tab-bar";
import { ProfileMenu } from "@/components/mobile/profile-menu";
import { ownerStatus, ownerStep } from "@/lib/owner-status";

import { getSettings } from "@/lib/settings";
export default function MobileHome() {
  return (
    <>
      <main className="flex-1 px-5 pt-12 pb-6">
        <Suspense fallback={<HomeSkeleton />}>
          <Home />
        </Suspense>
      </main>
      <Suspense
        fallback={<div className="h-20 border-t border-border bg-surface" />}
      >
        <TabBar />
      </Suspense>
    </>
  );
}

type Row = Job & {
  items: number;
  contractor: string | null;
  quote_status: string | null;
  quote_total: number | null;
  invoice_status: "sent" | "paid" | null;
  invoice_amount: number | null;
  invoice_number: string | null;
  has_feedback: boolean;
};

async function Home() {
  const { me, projects, unread } = await withOwner(async (q, me) => ({
    me,
    projects: await q<Row>(
      `select j.*,
              (select count(*)::int from scope_items s where s.job_id = j.id) as items,
              coalesce(p.company_name, p.full_name) as contractor,
              lq.status::text as quote_status,
              (select sum(total)::float8 from owner_quote_lines l where l.quote_id = lq.id) as quote_total,
              ci.status::text as invoice_status, ci.amount::float8 as invoice_amount, ci.number as invoice_number,
              exists (select 1 from project_feedback f where f.job_id = j.id) as has_feedback
         from jobs j
         left join invoices ci on ci.job_id = j.id and ci.kind = 'client'
         left join profiles p on p.id = j.contractor_id
         left join lateral (select id, status from owner_quotes oq where oq.job_id = j.id order by version desc limit 1) lq on true
        where j.owner_id = $1
        order by j.updated_at desc`,
      [me.id],
    ),
    unread: (
      await q<{ n: number }>(
        `select count(*)::int as n from notifications where profile_id = $1 and read_at is null`,
        [me.id],
      )
    )[0].n,
  }));
  const first = (me.full_name || "there").split(" ")[0];
  const co = (await getSettings()).company_name;
  // things waiting for the homeowner: invoices to pay first, then quotes to review
  const alerts = [
    ...projects
      .filter((p) => p.invoice_status === "sent")
      .map((p) => ({
        id: p.id,
        kind: "invoice" as const,
        title: `Invoice ${p.invoice_number} to pay`,
        sub: p.title,
        amount: money(p.invoice_amount ?? 0, p.currency, 2),
      })),
    ...projects
      .filter((p) => p.quote_status === "sent")
      .map((p) => ({
        id: p.id,
        kind: "quote" as const,
        title: "Your quote is ready",
        sub: p.title,
        amount: p.quote_total != null ? money(p.quote_total, p.currency) : "",
      })),
    ...projects
      .filter((p) => p.invoice_status === "paid" && !p.has_feedback)
      .map((p) => ({ id: p.id, kind: "feedback" as const, title: "How was the work? Rate it", sub: p.title, amount: "" })),
  ];

  return (
    <div className="space-y-7">
      <header className="relative z-30 flex items-center justify-between">
        <div>
          <p className="text-sm text-muted">Welcome back</p>
          <h1 className="text-[26px] leading-tight font-bold tracking-tight">
            Hi, {first} 👋
          </h1>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            href="/m/notifications"
            aria-label={
              unread ? `Notifications, ${unread} unread` : "Notifications"
            }
            className="relative flex size-10 items-center justify-center rounded-full bg-surface ring-1 ring-border"
          >
            <Bell className="size-5" />
            {unread > 0 && (
              <span className="num absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[11px] font-bold text-white ring-2 ring-background">
                {unread}
              </span>
            )}
          </Link>
          <ProfileMenu
            initial={first[0]?.toUpperCase() ?? "?"}
            name={me.full_name || me.email}
            email={me.email}
          />
        </div>
      </header>

      {alerts.length > 0 && (
        <div className="space-y-2.5">
          {alerts.map((a) => (
            <Link
              key={a.kind + a.id}
              href={`/m/projects/${a.id}`}
              className={`animate-step-in flex items-center gap-3 rounded-2xl p-4 shadow-pop active:scale-[0.99] ${
                a.kind === "invoice"
                  ? "bg-hero text-white"
                  : "border border-brand-soft-line bg-brand-soft text-brand-soft-fg"
              }`}
            >
              <span
                className={`relative flex size-11 shrink-0 items-center justify-center rounded-xl ${
                  a.kind === "invoice"
                    ? "bg-hero-num text-hero"
                    : "bg-brand text-brand-fg"
                }`}
              >
                {a.kind === "invoice" ? (
                  <Receipt className="size-5" />
                ) : a.kind === "feedback" ? (
                  <Star className="size-5" />
                ) : (
                  <FileText className="size-5" />
                )}
                <span className="absolute -top-1 -right-1 flex size-3">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-danger opacity-70" />
                  <span className="relative inline-flex size-3 rounded-full bg-danger ring-2 ring-white" />
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold">{a.title}</span>
                <span className="block truncate text-[13px] opacity-80">
                  {a.sub}
                </span>
              </span>
              <span className="shrink-0 text-right">
                {a.amount && (
                  <span
                    className={`num block text-[15px] font-bold ${a.kind === "invoice" ? "text-hero-num" : ""}`}
                  >
                    {a.amount}
                  </span>
                )}
                <span className="inline-flex items-center gap-0.5 text-xs font-semibold opacity-90">
                  {a.kind === "invoice" ? "Pay now" : a.kind === "feedback" ? "Rate" : "Review"}{" "}
                  <ChevronRight className="size-3.5" />
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}

      <Link
        href="/m/new"
        className="hero-panel relative block overflow-hidden rounded-3xl p-5 active:scale-[0.99]"
      >
        <span className="absolute inset-y-0 left-0 w-1.5 bg-hero-num" />
        <div className="flex items-start justify-between">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-hero-num text-hero">
            <House className="size-6" />
          </span>
          <span className="flex size-9 items-center justify-center rounded-full bg-white/10">
            <Plus className="size-5 text-hero-num" />
          </span>
        </div>
        <p className="mt-5 text-xl font-bold text-white">Start a new project</p>
        <p className="mt-1 text-sm opacity-80">
          New home, extension or remodel. Answer a few questions, it takes 3
          minutes.
        </p>
        <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-hero-num">
          Get started <ArrowRight className="size-4" />
        </span>
      </Link>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-bold tracking-tight">Your projects</h2>
          <span className="text-sm text-muted">{projects.length}</span>
        </div>
        {projects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border-strong px-6 py-10 text-center">
            <House className="mx-auto size-8 text-subtle" />
            <p className="mt-3 font-semibold">No projects yet</p>
            <p className="mt-1 text-sm text-muted">
              Start your first project and your contractor will price it.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {projects.map((p) => {
              const s = ownerStatus(p, p.quote_status, co);
              return (
                <li key={p.id}>
                  <Link
                    href={`/m/projects/${p.id}`}
                    className={`card block overflow-hidden active:scale-[0.99] ${
                      p.invoice_status === "sent"
                        ? "ring-2 ring-hero"
                        : p.quote_status === "sent"
                          ? "ring-2 ring-brand"
                          : ""
                    }`}
                  >
                    {p.invoice_status === "sent" ? (
                      <span className="flex items-center gap-2 bg-hero px-4 py-2 text-[13px] font-semibold text-white">
                        <Receipt className="size-4 text-hero-num" /> Invoice{" "}
                        {p.invoice_number} ready to pay
                        <span className="num ml-auto text-hero-num">
                          {money(p.invoice_amount ?? 0, p.currency, 2)}
                        </span>
                      </span>
                    ) : p.quote_status === "sent" ? (
                      <span className="flex items-center gap-2 bg-brand px-4 py-2 text-[13px] font-semibold text-brand-fg">
                        <FileText className="size-4" /> New quote to review
                      </span>
                    ) : p.invoice_status === "paid" ? (
                      <span className="flex items-center gap-2 bg-success-soft px-4 py-2 text-[13px] font-semibold text-success">
                        <CircleCheck className="size-4" /> Paid · invoice{" "}
                        {p.invoice_number}
                      </span>
                    ) : null}
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{p.title}</p>
                          {p.site_address && (
                            <p className="mt-0.5 flex items-center gap-1 truncate text-[13px] text-muted">
                              <MapPin className="size-3.5 shrink-0" />{" "}
                              {p.site_address}
                            </p>
                          )}
                        </div>
                        <ChevronRight className="mt-0.5 size-5 shrink-0 text-subtle" />
                      </div>
                      <div className="mt-4">
                        <OwnerMiniProgress
                          step={ownerStep(p, p.quote_status)}
                        />
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3 text-[13px]">
                        <span
                          className={
                            s.highlight || p.invoice_status === "sent"
                              ? "font-semibold text-brand-soft-fg"
                              : "text-muted"
                          }
                        >
                          {p.invoice_status === "sent"
                            ? "Work done · please pay the invoice"
                            : p.invoice_status === "paid"
                              ? "Completed & paid"
                              : s.text}
                        </span>
                        {p.quote_total != null ? (
                          <span className="num font-semibold">
                            {money(p.quote_total, p.currency)}
                          </span>
                        ) : (
                          <span className="text-subtle">{p.items} items</span>
                        )}
                      </div>
                      {p.contractor && (
                        <p className="mt-3 flex items-center gap-1.5 border-t border-border pt-3 text-xs text-muted">
                          <HardHat className="size-3.5" /> {p.contractor}
                        </p>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="h-14 w-48 animate-pulse rounded-xl bg-surface" />
      <div className="h-48 animate-pulse rounded-3xl bg-surface" />
      <div className="h-32 animate-pulse rounded-2xl bg-surface" />
    </div>
  );
}
