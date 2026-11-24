"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, Plus, UserRound } from "lucide-react";

export function TabBar() {
  const pathname = usePathname();
  const tab = (href: string, label: string, Icon: typeof House, active: boolean) => (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex flex-1 flex-col items-center gap-0.5 pt-2 text-[11px] font-semibold ${active ? "text-foreground" : "text-subtle"}`}
    >
      <Icon className={`size-[22px] ${active ? "text-foreground" : ""}`} strokeWidth={active ? 2.3 : 1.8} />
      {label}
    </Link>
  );
  return (
    <nav
      className="sticky bottom-0 z-30 flex items-start border-t border-border bg-surface/95 pb-[max(env(safe-area-inset-bottom),18px)] backdrop-blur"
      aria-label="App"
    >
      {tab("/m", "Home", House, pathname === "/m" || pathname.startsWith("/m/projects"))}
      <div className="flex flex-1 justify-center">
        <Link
          href="/m/new"
          aria-label="New project"
          className="-mt-5 flex size-14 items-center justify-center rounded-full bg-hero text-hero-num shadow-pop ring-4 ring-background transition active:scale-95"
        >
          <Plus className="size-7" strokeWidth={2.4} />
        </Link>
      </div>
      {tab("/m/account", "Account", UserRound, pathname === "/m/account")}
    </nav>
  );
}
