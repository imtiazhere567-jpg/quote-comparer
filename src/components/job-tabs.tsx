"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = { href: string; label: string; count?: number };

export function JobTabs({
  jobId,
  role,
  counts,
  showProgress = false,
}: {
  jobId: string;
  role: "owner" | "contractor";
  counts: { items: number; bids: number };
  showProgress?: boolean;
}) {
  const pathname = usePathname();
  const base = `/jobs/${jobId}`;
  const tabs: Tab[] =
    role === "contractor"
      ? [
          { href: base, label: "Work list", count: counts.items },
          { href: `${base}/bids`, label: "Sub-contractors", count: counts.bids },
          { href: `${base}/compare`, label: "Compare & award" },
          { href: `${base}/quote`, label: "Client quote" },
          ...(showProgress ? [{ href: `${base}/progress`, label: "Progress" }] : []),
        ]
      : [
          { href: base, label: "Work list", count: counts.items },
          { href: `${base}/quote`, label: "Quote" },
          ...(showProgress ? [{ href: `${base}/progress`, label: "Progress" }] : []),
        ];

  return (
    <nav className="mt-7 flex gap-7 overflow-x-auto border-b border-border" aria-label="Job sections">
      {tabs.map(({ href, label, count }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-0.5 py-3 text-sm font-semibold whitespace-nowrap transition ${
              active ? "border-foreground text-foreground" : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {label}
            {count ? (
              <span
                className={`num rounded-full border px-2 text-xs ${
                  active ? "border-brand-line bg-brand text-brand-fg" : "border-border bg-surface text-muted"
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
