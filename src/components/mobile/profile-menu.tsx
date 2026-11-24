"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LogOut, UserRound } from "lucide-react";
import { mobileSignOut } from "@/lib/actions/owner";

/** Round initial in the home header. Tapping it opens Account / Log out. */
export function ProfileMenu({ initial, name, email }: { initial: string; name: string; email: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Profile menu"
        className="flex size-11 items-center justify-center rounded-full bg-hero text-sm font-semibold text-hero-num"
      >
        {initial}
      </button>
      {open && (
        <div role="menu" className="animate-step-in absolute top-13 right-0 z-40 w-60 overflow-hidden rounded-2xl border border-border bg-surface shadow-pop">
          <div className="border-b border-border px-4 py-3">
            <p className="truncate text-sm font-semibold">{name}</p>
            <p className="truncate text-xs text-muted">{email}</p>
          </div>
          <Link role="menuitem" href="/m/account" className="flex h-12 items-center gap-3 px-4 text-sm font-medium hover:bg-surface-2">
            <UserRound className="size-4 text-muted" /> Account
          </Link>
          <form action={mobileSignOut}>
            <button role="menuitem" className="flex h-12 w-full items-center gap-3 border-t border-border px-4 text-sm font-semibold text-danger hover:bg-danger-soft">
              <LogOut className="size-4" /> Log out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
