"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Client-side paging over an already-filtered list. Resets to page 1 when the list length changes. */
export function usePaged<T>(items: T[], pageSize: number) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, pageCount);
  const rows = useMemo(() => items.slice((current - 1) * pageSize, current * pageSize), [items, current, pageSize]);
  return { rows, page: current, pageCount, setPage, total: items.length, pageSize };
}

function pages(current: number, count: number): (number | "…")[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const from = Math.max(2, current - 1);
  const to = Math.min(count - 1, current + 1);
  if (from > 2) out.push("…");
  for (let i = from; i <= to; i++) out.push(i);
  if (to < count - 1) out.push("…");
  out.push(count);
  return out;
}

export function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  onChange,
  noun = "items",
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onChange: (p: number) => void;
  noun?: string;
}) {
  if (total === 0) return null;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  const btn = "flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-[13px] font-semibold transition disabled:opacity-40";
  return (
    <nav className="flex flex-wrap items-center justify-between gap-3" aria-label="Pagination">
      <p className="text-[13px] text-muted">
        Showing <span className="num font-semibold text-foreground">{first}–{last}</span> of{" "}
        <span className="num font-semibold text-foreground">{total}</span> {noun}
      </p>
      {pageCount > 1 && (
        <div className="flex items-center gap-1">
          <button className={`${btn} text-muted hover:bg-surface-2`} onClick={() => onChange(page - 1)} disabled={page === 1} aria-label="Previous page">
            <ChevronLeft className="size-4" />
          </button>
          {pages(page, pageCount).map((p, i) =>
            p === "…" ? (
              <span key={`e${i}`} className="px-1 text-subtle">
                …
              </span>
            ) : (
              <button
                key={p}
                onClick={() => onChange(p)}
                aria-current={p === page ? "page" : undefined}
                className={`${btn} ${p === page ? "bg-hero text-hero-num" : "text-muted hover:bg-surface-2"}`}
              >
                {p}
              </button>
            ),
          )}
          <button
            className={`${btn} text-muted hover:bg-surface-2`}
            onClick={() => onChange(page + 1)}
            disabled={page === pageCount}
            aria-label="Next page"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </nav>
  );
}
