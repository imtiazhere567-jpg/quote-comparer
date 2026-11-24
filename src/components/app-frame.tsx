"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "./ui";
import { ThemeSwitcher } from "./theme-switcher";

/** Sidebar + top bar shell. The sidebar slides in as a drawer below the lg breakpoint. */
export function AppFrame({
  sidebar,
  headerRight,
  children,
  logo = <Logo />,
  logoLight = <Logo tone="light" />,
}: {
  sidebar: ReactNode;
  headerRight?: ReactNode;
  children: ReactNode;
  logo?: ReactNode;
  logoLight?: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-dvh flex-1">
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[264px] flex-col border-r border-ink-border bg-ink text-ink-fg transition-transform duration-200 lg:translate-x-0 ${
          open ? "translate-x-0 shadow-pop" : "-translate-x-full"
        }`}
        aria-label="Sidebar"
        // Close the mobile drawer whenever a link inside it is followed.
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a")) setOpen(false);
        }}
      >
        <div className="flex h-[68px] shrink-0 items-center justify-between px-5">
          <Link href="/dashboard" aria-label="Home">
            {logoLight}
          </Link>
          <button className="rounded-md p-1.5 text-ink-muted hover:bg-ink-hover lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
            <X className="size-5" />
          </button>
        </div>
        {sidebar}
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-black/35 lg:hidden" onClick={() => setOpen(false)} aria-hidden />}

      <div className="flex min-w-0 flex-1 flex-col lg:ml-[264px]">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-md sm:px-8">
          <button
            className="flex size-[38px] items-center justify-center rounded-[10px] border border-border-strong bg-surface text-muted shadow-card-sm lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="size-4" />
          </button>
          <span className="lg:hidden">
            {logo}
          </span>
          <div className="ml-auto flex items-center gap-2.5">
            <ThemeSwitcher />
            {headerRight}
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1320px] flex-1 px-4 py-6 sm:px-8 sm:py-7">{children}</main>
      </div>
    </div>
  );
}
