import { AutoRefresh } from "@/components/auto-refresh";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeftRight, LogOut, Plus } from "lucide-react";
import { withProfile } from "@/lib/auth";
import { JOB_STATUS_LABEL, ROLE_LABEL, type JobStatus } from "@/lib/types";
import { signOut } from "@/app/auth-actions";
import { isDemoMode } from "@/lib/supabase/env";
import { AppFrame } from "@/components/app-frame";
import { BrandLogo } from "@/components/brand-logo";
import { NotificationBell } from "@/components/notification-bell";
import { SideJobLink, SideNav } from "@/components/app-nav";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <AppFrame
      logo={<BrandLogo />}
      logoLight={<BrandLogo tone="light" />}
      headerRight={
        <Suspense fallback={<div className="size-[38px] rounded-[10px] border border-border-strong bg-surface" />}>
          <Notifications />
        </Suspense>
      }
      sidebar={
        <Suspense fallback={<SidebarSkeleton />}>
          <Sidebar />
        </Suspense>
      }
    >
      {children}
      <AutoRefresh />
    </AppFrame>
  );
}

const DOT: Partial<Record<JobStatus, string>> = {
  draft: "#9aa39c",
  bidding: "#7fb4e6",
  awarding: "var(--ink-accent)",
  quoted: "#b9a3f0",
  accepted: "#5fcf9a",
};

async function Notifications() {
  const { items, unread } = await withProfile(async (q, me) => {
    const items = await q<{ id: number; kind: string; title: string; body: string | null; link: string | null; created_at: string; read_at: string | null }>(
      `select id, kind, title, body, link, created_at, read_at from notifications where profile_id = $1 order by created_at desc limit 20`,
      [me.id],
    );
    const [{ n }] = await q<{ n: number }>(`select count(*)::int as n from notifications where profile_id = $1 and read_at is null`, [me.id]);
    return { items, unread: n };
  });
  return (
    <NotificationBell
      unread={unread}
      items={items.map((n) => ({
        id: Number(n.id),
        kind: n.kind,
        title: n.title,
        body: n.body,
        link: n.link,
        createdAt: new Date(n.created_at).toISOString(),
        read: Boolean(n.read_at),
      }))}
    />
  );
}

async function Sidebar() {
  const data = await withProfile(async (q, me) => {
    const jobs = await q<{ id: string; title: string; status: JobStatus; bids_in: number; bids_out: number }>(
      `select j.id, j.title, j.status,
              (select count(*)::int from bid_invites i where i.job_id = j.id and i.status = 'submitted') as bids_in,
              (select count(*)::int from bid_invites i where i.job_id = j.id) as bids_out
         from jobs j
        where j.status not in ('completed','cancelled')
        order by j.updated_at desc`,
    );
    const [{ subs }] = await q<{ subs: number }>(`select count(*)::int as subs from subcontractors where contractor_id = $1`, [me.id]);
    return { me, jobs, subs };
  });
  const { me, jobs, subs } = data;
  const active = jobs.filter((j) => j.status !== "accepted");
  const name = me.full_name || me.email;
  const Icon = isDemoMode ? ArrowLeftRight : LogOut;
  const label = isDemoMode ? "Switch user" : "Sign out";

  return (
    <>
      <div className="flex-1 overflow-y-auto px-3 pt-2 pb-3">
        <SideNav role={me.role} jobCount={active.length} subCount={subs} />

        {jobs.length > 0 && (
          <>
            <p className="px-2.5 pt-5 pb-1.5 text-[11px] font-semibold tracking-[0.08em] text-ink-muted uppercase">Active projects</p>
            <div className="space-y-0.5">
              {jobs.slice(0, 6).map((j) => (
                <SideJobLink
                  key={j.id}
                  id={j.id}
                  title={j.title}
                  dot={DOT[j.status] ?? "#9aa39c"}
                  sub={
                    j.status === "bidding" && me.role === "contractor"
                      ? `Collecting bids · ${j.bids_in} of ${j.bids_out}`
                      : JOB_STATUS_LABEL[j.status]
                  }
                />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="px-3 pb-3">
        <Link
          href="/jobs/new"
          className="flex h-[38px] items-center justify-center gap-2 rounded-[9px] border border-dashed border-ink-border text-sm font-semibold text-ink-fg transition hover:border-solid hover:bg-ink-hover"
        >
          <Plus className="size-4" /> New project
        </Link>
      </div>

      {isDemoMode && (
        <p className="mx-3 mb-3 rounded-lg bg-ink-2 px-3 py-2 text-[11px] text-ink-muted">
          <span className="font-semibold text-ink-fg">Demo mode</span> · local database
        </p>
      )}

      <div className="flex items-center gap-2.5 border-t border-ink-border px-4 py-3.5">
        <span className="inline-flex size-[34px] shrink-0 items-center justify-center rounded-full bg-ink-accent text-xs font-semibold text-ink">
          {name
            .split(/\s+/)
            .slice(0, 2)
            .map((p) => p[0]?.toUpperCase())
            .join("")}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold">{name}</p>
          <p className="truncate text-xs text-ink-muted">
            {me.company_name ?? ROLE_LABEL[me.role]}
            {me.company_name ? ` · ${ROLE_LABEL[me.role]}` : ""}
          </p>
        </div>
        <form action={signOut}>
          <button className="flex size-8 items-center justify-center rounded-lg text-ink-muted transition hover:bg-ink-hover hover:text-ink-fg" aria-label={label} title={label}>
            <Icon className="size-4" />
          </button>
        </form>
      </div>
    </>
  );
}

function SidebarSkeleton() {
  return (
    <div className="space-y-1.5 px-3 pt-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-[38px] animate-pulse rounded-[9px] bg-ink-2" />
      ))}
    </div>
  );
}
