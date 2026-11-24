"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

/**
 * Accessible popup built on <dialog>: focus is trapped, Esc closes it,
 * and clicking the dimmed backdrop closes it too.
 */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  /** set while we close the dialog ourselves (cleanup), so it doesn't count as the user closing it */
  const silent = useRef(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
    // If the page is hidden or left (e.g. after following a link), never leave a modal
    // dialog open: it would make the next page unclickable.
    return () => {
      if (d.open) {
        silent.current = true;
        d.close();
      }
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={() => {
        if (silent.current) {
          silent.current = false;
          return;
        }
        onClose();
      }}
      onClick={(e) => {
        // backdrop click, or following any link inside the popup, closes it
        if (e.target === ref.current || (e.target as HTMLElement).closest("a")) onClose();
      }}
      className="m-auto max-h-[min(720px,calc(100dvh-32px))] w-[min(760px,calc(100vw-24px))] overflow-hidden rounded-[18px] border border-border bg-surface p-0 text-foreground shadow-pop backdrop:bg-black/45 backdrop:backdrop-blur-[2px] open:flex open:flex-col"
    >
      <header className="flex items-start gap-3.5 border-b border-border px-6 py-5">
        {icon}
        <div className="min-w-0 flex-1">
          <h2 className="text-lg leading-tight font-bold tracking-tight">{title}</h2>
          {subtitle && <p className="mt-1 text-[13px] text-muted">{subtitle}</p>}
        </div>
        <button
          onClick={onClose}
          className="-mt-1 -mr-2 flex size-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground"
          aria-label="Close"
        >
          <X className="size-5" />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      {footer && <footer className="border-t border-border bg-surface-2 px-6 py-3.5">{footer}</footer>}
    </dialog>
  );
}
