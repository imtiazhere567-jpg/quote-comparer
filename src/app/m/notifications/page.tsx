import Link from "next/link";
import { Suspense } from "react";
import { Bell, ChevronLeft, CircleCheck, FileText, Hammer, Receipt, Star, type LucideIcon } from "lucide-react";
import { withOwner } from "@/lib/mobile-auth";
import { TabBar } from "@/components/mobile/tab-bar";
import { MarkOwnerRead } from "@/components/mobile/mark-read";

import { getSettings } from "@/lib/settings";
export default function NotificationsPage() {
  return (
    <>
      <Suspense fallback={<div className="flex-1 animate-pulse bg-surface" />}>
        <Notifications />
      </Suspense>
      <Suspense fallback={<div className="h-20 border-t border-border bg-surface" />}>
        <TabBar />
      </Suspense>
    </>
  );
}

const ICON: Record<string, LucideIcon> = {
  invoice_sent: Receipt,
  quote_sent: FileText,
  task_update: Hammer,
  feedback_request: Star,
};

function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

/** Old notifications may point at web pages; homeowners only use the phone app. */
function phoneLink(link: string | null, jobId: string | null) {
  if (link?.startsWith("/m/")) return link;
  return jobId ? `/m/projects/${jobId}` : "/m";
}

async function Notifications() {
  const items = await withOwner((q, me) =>
    q<{ id: number; job_id: string | null; kind: string; title: string; body: string | null; link: string | null; created_at: string; read_at: string | null }>(
      `select id, job_id, kind, title, body, link, created_at, read_at from notifications where profile_id = $1 order by created_at desc limit 50`,
      [me.id],
    ),
  );
  const unread = items.filter((n) => !n.read_at).length;
  const co = (await getSettings()).company_name;

  return (
    <main className="flex-1 px-5 pt-12 pb-6">
      {unread > 0 && <MarkOwnerRead />}
      <div className="flex items-center gap-3">
        <Link href="/m" className="flex size-10 items-center justify-center rounded-full bg-surface ring-1 ring-border" aria-label="Back">
          <ChevronLeft className="size-5" />
        </Link>
        <h1 className="text-[26px] font-bold tracking-tight">Notifications</h1>
      </div>

      {items.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border-strong px-6 py-12 text-center">
          <Bell className="mx-auto size-8 text-subtle" />
          <p className="mt-3 font-semibold">Nothing yet</p>
          <p className="mt-1 text-sm text-muted">Quotes, invoices and updates from {co} show up here.</p>
        </div>
      ) : (
        <ul className="mt-5 overflow-hidden rounded-2xl border border-border bg-surface">
          {items.map((n) => {
            const Icon = ICON[n.kind] ?? CircleCheck;
            const hot = ["invoice_sent", "quote_sent", "feedback_request"].includes(n.kind);
            return (
              <li key={n.id} className="border-b border-border last:border-b-0">
                <Link href={phoneLink(n.link, n.job_id)} className={`flex gap-3 px-4 py-3.5 active:bg-surface-2 ${n.read_at ? "" : "bg-brand-soft/60"}`}>
                  <span
                    className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${hot ? "bg-hero text-hero-num" : "bg-surface-2 text-muted ring-1 ring-border"}`}
                  >
                    <Icon className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={`text-[15px] ${n.read_at ? "font-medium" : "font-bold"}`}>{n.title}</span>
                      <span className="shrink-0 text-xs text-subtle">{ago(n.created_at)}</span>
                    </span>
                    {n.body && <span className="mt-0.5 block text-[13px] text-muted">{n.body}</span>}
                  </span>
                  {!n.read_at && <span className="mt-2 size-2.5 shrink-0 rounded-full bg-danger" aria-label="Unread" />}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
