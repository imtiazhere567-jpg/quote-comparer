"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronsDownUp, ChevronsUpDown, Pencil, Search, Trash2 } from "lucide-react";
import { deleteScopeItem, updateScopeItem } from "@/lib/actions/jobs";
import { qty } from "@/lib/format";
import type { ScopeItem } from "@/lib/types";
import { SubmitButton } from "@/components/submit-button";

/** Lists with more items than this start with stages collapsed. */
const COLLAPSE_OVER = 10;

export function WorkListView({ items, canEdit, units }: { items: ScopeItem[]; canEdit: boolean; units: string[] }) {
  const stages = useMemo(() => [...new Set(items.map((s) => s.stage))], [items]);
  const [open, setOpen] = useState<Set<string>>(() => new Set(items.length > COLLAPSE_OVER ? stages.slice(0, 1) : stages));
  const [term, setTerm] = useState("");
  // Items added after the page loaded: their stage opens automatically so you see the new line.
  const [seen, setSeen] = useState<Set<string>>(() => new Set(items.map((i) => i.id)));
  const fresh = new Set(items.filter((i) => !seen.has(i.id)).map((i) => i.stage));
  const t = term.trim().toLowerCase();

  const matches = (s: ScopeItem) => !t || `${s.stage} ${s.description} ${s.trade ?? ""} ${s.notes ?? ""}`.toLowerCase().includes(t);
  const visible = items.filter(matches);
  const allOpen = stages.every((s) => open.has(s));

  const toggle = (s: string) => {
    if (fresh.has(s)) {
      // first click on an auto-opened stage just closes it
      setSeen((prev) => new Set([...prev, ...items.filter((i) => i.stage === s).map((i) => i.id)]));
      setOpen((o) => {
        const n = new Set(o);
        n.delete(s);
        return n;
      });
      return;
    }
    setOpen((o) => {
      const n = new Set(o);
      if (n.has(s)) n.delete(s);
      else n.add(s);
      return n;
    });
  };

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="font-semibold tracking-tight">Work list</h2>
          <p className="text-xs text-muted">
            {items.length} items across {stages.length} stages
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Find an item…"
              className="input h-9 w-44 pl-9 sm:w-52"
              aria-label="Find an item"
            />
          </label>
          <button
            type="button"
            onClick={() => setOpen(allOpen ? new Set() : new Set(stages))}
            className="btn-secondary btn-sm"
            disabled={!!t}
            title={allOpen ? "Collapse all stages" : "Expand all stages"}
          >
            {allOpen ? <ChevronsDownUp /> : <ChevronsUpDown />}
            {allOpen ? "Collapse all" : "Expand all"}
          </button>
        </div>
      </div>

      {t && visible.length === 0 && <p className="px-5 py-10 text-center text-sm text-muted">No items match “{term}”.</p>}

      {stages.map((stage) => {
        const all = items.filter((s) => s.stage === stage);
        const shown = all.filter(matches);
        if (t && shown.length === 0) return null;
        const isOpen = t ? true : open.has(stage) || fresh.has(stage);
        return (
          <section key={stage} className="border-b border-border last:border-b-0">
            <button
              type="button"
              onClick={() => toggle(stage)}
              aria-expanded={isOpen}
              disabled={!!t}
              className="flex w-full items-center gap-3 bg-surface-2 px-5 py-3 text-left transition hover:bg-background disabled:cursor-default"
            >
              <ChevronDown className={`size-4 shrink-0 text-muted transition ${isOpen ? "" : "-rotate-90"}`} />
              <span className="flex-1 text-sm font-semibold">{stage}</span>
              {!isOpen && (
                <span className="hidden max-w-[50%] truncate text-xs text-subtle sm:block">{all.map((s) => s.description).join(" · ")}</span>
              )}
              <span className="num rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold text-muted ring-1 ring-border">
                {t ? `${shown.length}/${all.length}` : all.length}
              </span>
            </button>
            {isOpen && (
              <ul className="divide-y divide-border border-t border-border">
                {shown.map((item) => (
                  <ItemRow key={item.id} item={item} canEdit={canEdit} units={units} />
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

function ItemRow({ item, canEdit, units }: { item: ScopeItem; canEdit: boolean; units: string[] }) {
  const summary = (
    <div className="flex min-w-0 flex-1 items-baseline justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium">{item.description}</p>
        {(item.trade || item.notes) && (
          <p className="mt-0.5 truncate text-xs text-muted">
            {item.trade && <span className="mr-2 rounded bg-surface-2 px-1.5 py-px ring-1 ring-border">{item.trade}</span>}
            {item.notes}
          </p>
        )}
      </div>
      <p className="num shrink-0 text-sm">
        <span className="font-semibold">{qty(item.quantity)}</span> <span className="text-muted">{item.unit}</span>
      </p>
    </div>
  );

  if (!canEdit) return <li className="flex px-5 py-3.5">{summary}</li>;

  return (
    <li>
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-3.5 transition hover:bg-surface-2">
          {summary}
          <span className="rounded-md p-1.5 text-subtle transition group-hover:text-muted group-open:bg-brand-soft group-open:text-brand-soft-fg">
            <Pencil className="size-3.5" />
          </span>
        </summary>
        <form action={updateScopeItem} className="border-t border-border bg-surface-2 px-5 py-4">
          <input type="hidden" name="item_id" value={item.id} />
          <ItemFields units={units} item={item} />
          <div className="mt-4 flex justify-between gap-2">
            <SubmitButton formAction={deleteScopeItem} variant="danger" pendingText="Deleting…" className="btn-sm">
              <Trash2 /> Delete
            </SubmitButton>
            <SubmitButton className="btn-sm">Save changes</SubmitButton>
          </div>
        </form>
      </details>
    </li>
  );
}

export function ItemFields({ units, item, stacked = false }: { units: string[]; item?: ScopeItem; stacked?: boolean }) {
  const unitOptions = item && !units.includes(item.unit) ? [item.unit, ...units] : units;
  const col = (cls: string) => (stacked ? "" : cls);
  return (
    <div className={stacked ? "space-y-3" : "grid gap-3 sm:grid-cols-12"}>
      <div className={col("sm:col-span-3")}>
        <label className="label">Stage</label>
        <input name="stage" list="stages" required defaultValue={item?.stage} placeholder="e.g. Drywall" className="input" />
      </div>
      <div className={col("sm:col-span-9")}>
        <label className="label">Description</label>
        <input name="description" required defaultValue={item?.description} placeholder="What needs doing" className="input" />
      </div>
      <div className={stacked ? "grid grid-cols-2 gap-3" : "contents"}>
        <div className={col("sm:col-span-2")}>
          <label className="label">Quantity</label>
          <input name="quantity" type="number" min="0" step="any" required defaultValue={item?.quantity ?? 1} className="input num" />
        </div>
        <div className={col("sm:col-span-2")}>
          <label className="label">Unit</label>
          <select name="unit" defaultValue={item?.unit ?? units[0]} className="input">
            {unitOptions.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </div>
      </div>
      <div className={col("sm:col-span-3")}>
        <label className="label">
          Trade <span className="font-normal text-subtle">· optional</span>
        </label>
        <input name="trade" defaultValue={item?.trade ?? ""} placeholder="e.g. Plumbing" className="input" />
      </div>
      <div className={col("sm:col-span-5")}>
        <label className="label">
          Notes <span className="font-normal text-subtle">· optional</span>
        </label>
        <input name="notes" defaultValue={item?.notes ?? ""} placeholder="Spec, materials…" className="input" />
      </div>
    </div>
  );
}
