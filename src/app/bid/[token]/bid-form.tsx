"use client";

import { useMemo, useState, useTransition } from "react";
import { CircleCheck, LoaderCircle, Send } from "lucide-react";
import { submitBid } from "@/lib/actions/bid";
import { money, qty, type Currency } from "@/lib/format";
import type { ScopeItem } from "@/lib/types";
import { Callout } from "@/components/ui";

export function BidForm({
  token,
  currency,
  items,
  initialRates,
  initialNotes,
  submitted,
  locked,
}: {
  token: string;
  currency: Currency;
  items: ScopeItem[];
  initialRates: Record<string, number>;
  initialNotes: string;
  submitted: boolean;
  locked: boolean;
}) {
  const [rates, setRates] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.map((i) => [i.id, initialRates[i.id]?.toString() ?? ""])),
  );
  const [notes, setNotes] = useState(initialNotes);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const lineTotal = (i: ScopeItem) => {
    const r = parseFloat(rates[i.id]);
    return Number.isFinite(r) ? r * i.quantity : null;
  };
  const total = useMemo(() => items.reduce((s, i) => s + (lineTotal(i) ?? 0), 0), [items, rates]); // eslint-disable-line react-hooks/exhaustive-deps
  const priced = items.filter((i) => lineTotal(i) !== null).length;
  const stages = [...new Set(items.map((i) => i.stage))];
  const sym = currency === "GBP" ? "£" : "$";

  function submit() {
    setError(null);
    setSaved(false);
    start(async () => {
      try {
        await submitBid({
          token,
          notes,
          rates: items.map((i) => ({ scopeItemId: i.id, unitRate: rates[i.id].trim() === "" ? null : Number(rates[i.id]) })),
        });
        setSaved(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  return (
    <div className="space-y-5">
      {submitted && !locked && !saved && (
        <Callout tone="success">Your bid has been sent. You can still change it until the work is awarded.</Callout>
      )}

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-base font-semibold tracking-tight">Your prices</h2>
            <p className="text-[13px] text-muted">
              {locked ? "Your bid is locked because work has been offered." : "Enter your rate per unit. Leave a line empty if you don't do that work."}
            </p>
          </div>
          <span className="text-[13px] text-muted">
            <span className="num font-semibold text-foreground">{priced}</span> of {items.length} priced
          </span>
        </div>

        <div className="hidden grid-cols-12 gap-3 border-b border-border bg-surface-2 px-5 py-2.5 text-xs font-medium text-muted sm:grid">
          <span className="col-span-6">Item</span>
          <span className="col-span-2 text-right">Quantity</span>
          <span className="col-span-2 text-right">Your rate / unit</span>
          <span className="col-span-2 text-right">Line total</span>
        </div>
        {stages.map((stage) => (
          <div key={stage}>
            <div className="border-b border-border bg-surface-2 px-5 py-2">
              <span className="eyebrow">{stage}</span>
            </div>
            {items
              .filter((i) => i.stage === stage)
              .map((i) => {
                const lt = lineTotal(i);
                return (
                  <div key={i.id} className="grid grid-cols-12 items-center gap-3 border-b border-border px-5 py-3.5 last:border-b-0">
                    <div className="col-span-12 sm:col-span-6">
                      <p className="text-sm font-semibold">{i.description}</p>
                      {i.notes && <p className="text-xs text-muted">{i.notes}</p>}
                    </div>
                    <p className="num col-span-4 text-sm sm:col-span-2 sm:text-right">
                      <span className="font-semibold">{qty(i.quantity)}</span> <span className="text-muted">{i.unit}</span>
                    </p>
                    <div className="relative col-span-4 sm:col-span-2">
                      <label className="sr-only" htmlFor={`rate-${i.id}`}>
                        Rate for {i.description}
                      </label>
                      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-xs text-subtle">{sym}</span>
                      <input
                        id={`rate-${i.id}`}
                        inputMode="decimal"
                        type="number"
                        min="0"
                        step="0.01"
                        disabled={locked}
                        value={rates[i.id]}
                        onChange={(e) => setRates((r) => ({ ...r, [i.id]: e.target.value }))}
                        placeholder="—"
                        className="input num pl-6 text-right"
                      />
                    </div>
                    <p className="num col-span-4 text-right text-sm font-semibold sm:col-span-2">
                      {lt === null ? <span className="font-normal text-subtle">—</span> : money(lt, currency, 2)}
                    </p>
                  </div>
                );
              })}
          </div>
        ))}
      </div>

      <div className="card p-5">
        <label htmlFor="notes" className="label">
          Notes for the contractor <span className="font-normal text-subtle">· optional</span>
        </label>
        <textarea
          id="notes"
          rows={3}
          disabled={locked}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Start date, how long it will take, what's included or excluded, warranty…"
          className="textarea"
        />
      </div>

      {error && <Callout tone="danger">{error}</Callout>}
      {saved && <Callout tone="success">Bid sent. Thank you! You&apos;ll see any offer right here on this link.</Callout>}

      {/* Sticky total bar */}
      <div className="sticky bottom-4 z-10">
        <div className="hero-panel flex flex-wrap items-center justify-between gap-4 rounded-[14px] px-5 py-4 shadow-pop">
          <div>
            <p className="text-xs opacity-75">Your total</p>
            <p className="num text-2xl font-bold text-hero-num">{money(total, currency, 2)}</p>
          </div>
          {!locked ? (
            <button onClick={submit} disabled={pending || priced === 0} className="btn-primary btn-lg">
              {pending ? <LoaderCircle className="animate-spin" /> : <Send />}
              {pending ? "Sending…" : submitted ? "Update my bid" : "Send my bid"}
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-sm text-hero-num">
              <CircleCheck className="size-4" /> Bid locked
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
