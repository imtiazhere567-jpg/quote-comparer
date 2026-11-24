"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, Inbox, Receipt, Scale, ClipboardList, Hammer, type LucideIcon } from "lucide-react";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/actions/notifications";

export type NotificationItem = {
  id: number;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  createdAt: string;
  read: boolean;
};

const ICON: Record<string, LucideIcon> = {
  bid_received: Inbox,
  all_bids_in: Scale,
  new_project: ClipboardList,
  quote_sent: Receipt,
  quote_accepted: Receipt,
  quote_changes_requested: Receipt,
  quote_rejected: Receipt,
  task_update: Hammer,
};

function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

export function NotificationBell({ items, unread }: { items: NotificationItem[]; unread: number }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        className="relative flex size-[38px] items-center justify-center rounded-[10px] border border-border-strong bg-surface text-muted shadow-card-sm hover:text-foreground"
      >
        <Bell className="size-4" />
        {unread > 0 && (
          <span className="num absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[11px] font-bold text-white ring-2 ring-background">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div role="dialog" aria-label="Notifications" className="animate-step-in absolute top-12 right-0 z-50 w-[min(380px,calc(100vw-24px))] overflow-hidden rounded-[14px] border border-border bg-surface shadow-pop">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="font-semibold">Notifications</p>
            {unread > 0 && (
              <button
                onClick={async () => {
                  await markAllNotificationsRead();
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-foreground"
              >
                <CheckCheck className="size-3.5" /> Mark all read
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted">No notifications yet.</p>
          ) : (
            <ul className="max-h-[420px] divide-y divide-border overflow-y-auto">
              {items.map((n) => {
                const Icon = ICON[n.kind] ?? Bell;
                return (
                  <li key={n.id}>
                    <button
                      onClick={async () => {
                        setOpen(false);
                        if (!n.read) await markNotificationRead(n.id);
                        if (n.link) router.push(n.link);
                        router.refresh();
                      }}
                      className={`flex w-full gap-3 px-4 py-3 text-left transition hover:bg-surface-2 ${n.read ? "" : "bg-brand-soft/50"}`}
                    >
                      <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ${n.read ? "bg-surface-2 text-muted" : "bg-hero text-hero-num"}`}>
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">{n.title}</span>
                        {n.body && <span className="block text-[13px] text-muted">{n.body}</span>}
                        <span className="mt-0.5 block text-[11px] text-subtle">{ago(n.createdAt)}</span>
                      </span>
                      {!n.read && <span className="mt-2 size-2 shrink-0 rounded-full bg-danger" aria-label="Unread" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
