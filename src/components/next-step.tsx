"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowLeftRight, ArrowRight, Clock, Flag } from "lucide-react";
import type { NextAction } from "@/lib/next-action";
import { submitToContractor } from "@/lib/actions/owner";
import { SubmitButton } from "./submit-button";

/** "Next step" banner on a project page: one clear thing to do, and a button that does it. */
export type DemoShortcut = { href: string; label: string; hint: string };

export function NextStep({ action, step, of, jobId, demo }: { action: NextAction; step: number; of: number; jobId: string; demo?: DemoShortcut | null }) {
  const pathname = usePathname();
  const slotRef = useRef<HTMLDivElement>(null);
  // Only mark the slot usable once this banner has hydrated, so the page's button
  // is never portalled into server HTML React hasn't claimed yet (hydration mismatch).
  useEffect(() => {
    if (slotRef.current) slotRef.current.dataset.ready = "1";
  });
  const target = action.href?.split("#")[0] ?? null;
  const here = target === pathname;
  const Icon = action.waiting ? Clock : Flag;

  return (
    <div
      className={`relative mt-6 flex flex-wrap items-center gap-4 overflow-hidden rounded-[14px] border px-5 py-4 ${
        action.waiting ? "border-border bg-surface" : "border-brand-soft-line bg-brand-soft"
      }`}
      role="status"
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${action.waiting ? "bg-border-strong" : "bg-brand"}`} />
      <span
        className={`flex size-10 shrink-0 items-center justify-center rounded-[10px] ${
          action.waiting ? "bg-surface-2 text-muted ring-1 ring-border" : "bg-hero text-hero-num"
        }`}
      >
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-[11px] font-semibold tracking-[0.08em] uppercase ${action.waiting ? "text-subtle" : "text-brand-soft-fg"}`}>
          {action.waiting ? "Waiting" : "Next step"} · step {Math.min(step, of)} of {of}
        </p>
        <p className="text-[17px] leading-snug font-semibold">{action.title}</p>
        <p className="text-[13px] text-muted">{action.body}</p>
      </div>
      {action.submit && action.cta ? (
        <form action={submitToContractor}>
          <input type="hidden" name="job_id" value={jobId} />
          <SubmitButton pendingText="Sending…">
            {action.cta} <ArrowRight />
          </SubmitButton>
        </form>
      ) : action.href &&
        action.cta &&
        (here ? (
          <>
            {/* The page fills this slot with its own live button (see NextStepAction). */}
            <div ref={slotRef} data-next-slot={pathname} className="peer flex shrink-0 flex-wrap gap-2 empty:hidden" />
            <button
              type="button"
              onClick={() => {
                const hash = action.href?.split("#")[1];
                const el = (hash && document.getElementById(hash)) || document.querySelector("main [data-step-target]");
                el?.scrollIntoView({ behavior: "smooth", block: "center" });
                el?.querySelector<HTMLElement>("input, select, textarea, button")?.focus({ preventScroll: true });
              }}
              className={`hidden peer-empty:inline-flex ${action.waiting ? "btn-secondary" : "btn-primary"}`}
            >
              <ArrowDown /> {action.cta}
            </button>
          </>
        ) : (
          <Link href={action.href} className={action.waiting ? "btn-secondary" : "btn-primary"}>
            {action.cta} <ArrowRight />
          </Link>
        ))}
      {demo && (
        <div className="flex w-full flex-wrap items-center gap-3 rounded-[10px] border border-dashed border-border-strong bg-surface-2 px-4 py-2.5">
          <p className="min-w-0 flex-1 text-[13px] text-muted">
            <span className="font-semibold text-foreground">Demo:</span> {demo.hint}
          </p>
          <a href={demo.href} className="btn-primary">
            <ArrowLeftRight /> {demo.label}
          </a>
        </div>
      )}
    </div>
  );
}

/**
 * Renders a page's main action inside the Next step banner (when the banner points at that page),
 * so the button text can follow the page's live state, e.g. "Send offers to 3 · $24,542".
 */
export function NextStepAction({ path, children }: { path: string; children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const find = () => document.querySelector<HTMLElement>(`[data-next-slot="${CSS.escape(path)}"][data-ready]`);
    let current: HTMLElement | null = null;
    const sync = () => {
      const el = find();
      if (el !== current) {
        current = el;
        setSlot(el);
      }
    };
    sync();
    // The banner can stream in after the page, or be re-rendered: keep following it.
    const obs = new MutationObserver(sync);
    obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-ready"] });
    return () => obs.disconnect();
  }, [path]);

  return slot ? createPortal(children, slot) : null;
}
