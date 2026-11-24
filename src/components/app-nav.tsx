"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, MapPin, Plus, Receipt, Settings, TrendingUp, Users, type LucideIcon } from "lucide-react";

type Item = { href: string; label: string; icon: LucideIcon; count?: number; hot?: boolean; match: (p: string) => boolean };

export function SideNav({ role, jobCount, subCount }: { role: string; jobCount: number; subCount: number }) {
  const pathname = usePathname();
  const items: Item[] = [
    {
      href: "/dashboard",
      label: "Projects",
      icon: Briefcase,
      count: jobCount,
      hot: true,
      match: (p) => p === "/dashboard" || (p.startsWith("/jobs/") && p !== "/jobs/new"),
    },
  ];
  if (role === "contractor") {
    items.push({ href: "/subcontractors", label: "Sub-contractors", icon: Users, count: subCount, match: (p) => p.startsWith("/subcontractors") });
    items.push({ href: "/invoices", label: "Invoices", icon: Receipt, match: (p) => p.startsWith("/invoices") });
    items.push({ href: "/revenue", label: "Revenue", icon: TrendingUp, match: (p) => p.startsWith("/revenue") });
    items.push({ href: "/service-areas", label: "Service areas", icon: MapPin, match: (p) => p.startsWith("/service-areas") });
    items.push({ href: "/settings", label: "Settings", icon: Settings, match: (p) => p.startsWith("/settings") });
  }
  items.push({ href: "/jobs/new", label: "New project", icon: Plus, match: (p) => p === "/jobs/new" });

  return (
    <nav className="space-y-0.5" aria-label="Main">
      {items.map(({ href, label, icon: Icon, count, hot, match }) => {
        const active = match(pathname);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`relative flex h-[38px] items-center gap-3 rounded-[9px] px-2.5 text-sm font-medium transition ${
              active ? "bg-ink-hover text-ink-fg" : "text-ink-muted hover:bg-ink-hover hover:text-ink-fg"
            }`}
          >
            {active && <span className="absolute top-2 bottom-2 -left-3 w-[3px] rounded-r bg-ink-accent" />}
            <Icon className={`size-4 ${active ? "text-ink-accent" : ""}`} />
            {label}
            {count ? (
              <span
                className={`num ml-auto rounded-full px-[7px] py-px text-[11px] font-semibold ${
                  hot ? "bg-ink-accent text-ink" : "bg-ink-2 text-ink-fg"
                }`}
              >
                {count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function SideJobLink({ id, title, sub, dot }: { id: string; title: string; sub: string; dot: string }) {
  const pathname = usePathname();
  const active = pathname.startsWith(`/jobs/${id}`);
  return (
    <Link
      href={`/jobs/${id}`}
      className={`flex items-center gap-2.5 rounded-[9px] px-2.5 py-2 transition ${
        active ? "bg-ink-hover text-ink-fg" : "text-ink-muted hover:bg-ink-hover hover:text-ink-fg"
      }`}
    >
      <span className="size-2 shrink-0 rounded-full" style={{ background: dot }} />
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-medium">{title}</span>
        <span className="block truncate text-[11px] text-ink-muted">{sub}</span>
      </span>
    </Link>
  );
}
