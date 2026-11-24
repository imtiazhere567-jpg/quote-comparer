"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, ListFilter } from "lucide-react";

export type FilterOption = { value: string; label: string; count?: number };

/**
 * Branded dropdown for filters (replaces the browser's grey <select>).
 * Keyboard: Enter/Space/↓ opens, ↑/↓ moves, Enter picks, Esc closes.
 */
export function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const id = useId();
  const current = options.find((o) => o.value === value) ?? options[0];
  const active = value !== options[0]?.value;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id}
        aria-label={`${label}: ${current?.label}`}
        onClick={() => {
          setHi(Math.max(0, options.findIndex((o) => o.value === value)));
          setOpen((o) => !o);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
          else if (["ArrowDown", "ArrowUp"].includes(e.key)) {
            e.preventDefault();
            if (!open) setOpen(true);
            setHi((h) => (e.key === "ArrowDown" ? Math.min(options.length - 1, h + 1) : Math.max(0, h - 1)));
          } else if (open && e.key === "Enter") {
            e.preventDefault();
            pick(options[hi].value);
          }
        }}
        className={`inline-flex h-9 items-center gap-2 rounded-[10px] border px-3 text-[13px] font-medium whitespace-nowrap transition ${
          active
            ? "border-brand-soft-line bg-brand-soft text-brand-soft-fg"
            : "border-border-strong bg-surface text-foreground hover:border-select"
        } ${open ? "shadow-[0_0_0_3px_var(--select-ring)]" : ""}`}
      >
        <ListFilter className="size-3.5 opacity-70" />
        <span className="text-muted">{label}:</span>
        <span className="font-semibold">{current?.label}</span>
        <ChevronDown className={`size-4 opacity-60 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul
          id={id}
          role="listbox"
          aria-label={label}
          className="animate-step-in absolute top-[calc(100%+6px)] left-0 z-40 min-w-full overflow-hidden rounded-[12px] border border-border bg-surface p-1 shadow-pop"
        >
          {options.map((o, i) => {
            const sel = o.value === value;
            return (
              <li
                key={o.value}
                role="option"
                aria-selected={sel}
                onMouseEnter={() => setHi(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(o.value)}
                className={`flex cursor-pointer items-center gap-2.5 rounded-[8px] px-3 py-2 text-[13px] whitespace-nowrap ${
                  i === hi ? "bg-surface-2" : ""
                } ${sel ? "font-semibold text-brand-soft-fg" : ""}`}
              >
                <span className={`flex size-4 items-center justify-center rounded-full ${sel ? "bg-brand text-brand-fg" : "ring-1 ring-border-strong"}`}>
                  {sel && <Check className="size-3" strokeWidth={3} />}
                </span>
                <span className="flex-1">{o.label}</span>
                {o.count != null && <span className="num rounded-full bg-surface-2 px-1.5 text-[11px] text-muted ring-1 ring-border">{o.count}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
