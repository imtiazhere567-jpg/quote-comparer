"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Search, X } from "lucide-react";
import { FilterSelect } from "./filter-select";
import { PagedList, PagedTable } from "./paged-table";

/** One row, rendered on the server, plus what it can be searched/filtered by. */
export type FilterItem = {
  node: ReactNode;
  text: string;
  tags: Record<string, string>;
};
export type FilterDef = {
  key: string;
  label: string;
  options: { value: string; label: string }[];
};

/** `dedupeBy`: items sharing this tag are one row listed once per value (e.g. a sub with several trades). */
function useFiltered(
  items: FilterItem[],
  filters: FilterDef[],
  dedupeBy?: string,
) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Record<string, string>>({});
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const hit = items.filter(
      (it) =>
        (!needle || it.text.toLowerCase().includes(needle)) &&
        filters.every(
          (f) =>
            !sel[f.key] ||
            sel[f.key] === "all" ||
            it.tags[f.key] === sel[f.key],
        ),
    );
    if (!dedupeBy) return hit;
    const seen = new Set<string>();
    return hit.filter(
      (it) => !seen.has(it.tags[dedupeBy]) && seen.add(it.tags[dedupeBy]),
    );
  }, [items, filters, q, sel, dedupeBy]);
  return { q, setQ, sel, setSel, shown };
}

/** Distinct rows (for counts and "x of y") when items are duplicated per value. */
function distinct(items: FilterItem[], dedupeBy?: string) {
  return dedupeBy
    ? new Set(items.map((i) => i.tags[dedupeBy])).size
    : items.length;
}

function Toolbar({
  items,
  filters,
  search,
  state,
  dedupeBy,
}: {
  items: FilterItem[];
  filters: FilterDef[];
  search: string;
  state: ReturnType<typeof useFiltered>;
  dedupeBy?: string;
}) {
  const { q, setQ, sel, setSel, shown } = state;
  const any = q || Object.values(sel).some((v) => v && v !== "all");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="relative w-full sm:w-64">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={search}
          aria-label={search}
          className="input h-9 w-full pl-9 text-[13px]"
        />
      </label>
      {filters.map((f) => (
        <FilterSelect
          key={f.key}
          label={f.label}
          value={sel[f.key] ?? "all"}
          onChange={(v) => setSel((s) => ({ ...s, [f.key]: v }))}
          options={[
            { value: "all", label: "All", count: distinct(items, dedupeBy) },
            ...f.options.map((o) => ({
              ...o,
              count: distinct(
                items.filter((it) => it.tags[f.key] === o.value),
                dedupeBy,
              ),
            })),
          ]}
        />
      ))}
      {any && (
        <button
          type="button"
          onClick={() => {
            setQ("");
            setSel({});
          }}
          className="inline-flex h-9 items-center gap-1 rounded-[10px] px-2.5 text-[13px] font-medium text-muted hover:bg-surface-2 hover:text-foreground"
        >
          <X className="size-3.5" /> Clear · {shown.length} of{" "}
          {distinct(items, dedupeBy)}
        </button>
      )}
    </div>
  );
}

const NoMatch = () => (
  <div className="card px-6 py-10 text-center text-sm text-muted">
    Nothing matches these filters.
  </div>
);

export function FilteredTable({
  items,
  filters,
  head,
  noun,
  search = "Search",
  minWidth,
  dedupeBy,
}: {
  items: FilterItem[];
  filters: FilterDef[];
  head: ReactNode;
  noun: string;
  search?: string;
  minWidth?: number;
  dedupeBy?: string;
}) {
  const state = useFiltered(items, filters, dedupeBy);
  return (
    <div className="space-y-3">
      <Toolbar
        items={items}
        filters={filters}
        search={search}
        state={state}
        dedupeBy={dedupeBy}
      />
      {state.shown.length ? (
        <PagedTable
          head={head}
          rows={state.shown.map((s) => s.node)}
          noun={noun}
          minWidth={minWidth}
        />
      ) : (
        <NoMatch />
      )}
    </div>
  );
}

export function FilteredList({
  items,
  filters,
  noun,
  search = "Search",
}: {
  items: FilterItem[];
  filters: FilterDef[];
  noun: string;
  search?: string;
}) {
  const state = useFiltered(items, filters);
  return (
    <div className="space-y-3">
      <Toolbar items={items} filters={filters} search={search} state={state} />
      {state.shown.length ? (
        <PagedList items={state.shown.map((s) => s.node)} noun={noun} />
      ) : (
        <NoMatch />
      )}
    </div>
  );
}
