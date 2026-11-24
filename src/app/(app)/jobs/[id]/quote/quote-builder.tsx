"use client";

import { useState, useTransition } from "react";
import { CircleCheck, EyeOff, LoaderCircle, Save, Send, TriangleAlert } from "lucide-react";
import { saveOwnerQuote } from "@/lib/actions/jobs";
import { money, qty, type Currency } from "@/lib/format";
import { NextStepAction } from "@/components/next-step";
import { useConfirm } from "@/components/confirm-dialog";

type Item = {
  id: string;
  stage: string;
  description: string;
  quantity: number;
  unit: string;
  cost: number | null;
  source: string | null;
};

const PRESETS = [10, 15, 20, 25];

export function QuoteBuilder({
  jobId,
  currency,
  items,
  initialMarkup,
  initialMessage,
  ownerReady,
}: {
  jobId: string;
  currency: Currency;
  items: Item[];
  initialMarkup: number;
  initialMessage: string;
  ownerReady: boolean;
}) {
  const [markup, setMarkup] = useState(String(initialMarkup));
  const [message, setMessage] = useState(initialMessage);
  const [costs, setCosts] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.map((i) => [i.id, i.cost?.toString() ?? ""])),
  );
  const [pending, start] = useTransition();
  const [action, setAction] = useState<"draft" | "send" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const m = Math.max(0, parseFloat(markup) || 0);
  const costOf = (id: string) => {
    const v = parseFloat(costs[id]);
    return Number.isFinite(v) && v >= 0 ? v : null;
  };
  const totalCost = items.reduce((s, i) => s + (costOf(i.id) ?? 0), 0);
  const ownerTotal = totalCost * (1 + m / 100);
  const missing = items.filter((i) => costOf(i.id) === null).length;
  const stages = [...new Set(items.map((i) => i.stage))];

  const [confirm, confirmDialog] = useConfirm();

  async function save(send: boolean) {
    setError(null);
    setNotice(null);
    if (
      send &&
      !(await confirm({
        title: "Send this quote to your client?",
        amount: money(ownerTotal, currency),
        body: "They'll see one price per line on their phone, never the sub-contractor rates. They can accept it, ask for changes or reject it.",
        confirmLabel: "Send quote",
      }))
    )
      return;
    setAction(send ? "send" : "draft");
    start(async () => {
      try {
        await saveOwnerQuote({
          jobId,
          markupPercent: m,
          message,
          send,
          lines: items.map((i) => ({ scopeItemId: i.id, cost: costOf(i.id) ?? NaN })),
        });
        if (!send) setNotice("Draft saved");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      {confirmDialog}
      <NextStepAction path={`/jobs/${jobId}/quote`}>
        <button onClick={() => save(true)} disabled={pending || missing > 0 || !ownerReady} className="btn-primary">
          {pending && action === "send" ? <LoaderCircle className="animate-spin" /> : <Send />}
          {missing > 0 ? `${missing} line${missing > 1 ? "s" : ""} need a cost` : `Send quote to client · ${money(ownerTotal, currency)}`}
        </button>
      </NextStepAction>
      <div className="card min-w-0 overflow-hidden">
        <div className="border-b border-border px-5 py-3.5">
          <h2 className="font-semibold tracking-tight">Your costs</h2>
          <p className="text-xs text-muted">Pre-filled from the awarded bids. Change any line, e.g. for work you do yourself.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="text-xs text-muted">
                <th className="border-b border-border bg-surface-2 px-5 py-2.5 text-left font-medium">Item</th>
                <th className="border-b border-border bg-surface-2 px-3 py-2.5 text-left font-medium">Doing it</th>
                <th className="border-b border-border bg-surface-2 px-3 py-2.5 text-right font-medium">Your cost</th>
                <th className="border-b border-border bg-surface-2 px-5 py-2.5 text-right font-medium">Client price</th>
              </tr>
            </thead>
            {stages.map((stage) => (
              <tbody key={stage}>
                <tr>
                  <td colSpan={4} className="border-b border-border px-5 pt-4 pb-1.5">
                    <span className="eyebrow">{stage}</span>
                  </td>
                </tr>
                {items
                  .filter((i) => i.stage === stage)
                  .map((i) => {
                    const c = costOf(i.id);
                    return (
                      <tr key={i.id}>
                        <td className="border-b border-border px-5 py-2.5">
                          <span className="block font-medium">{i.description}</span>
                          <span className="num text-xs text-muted">
                            {qty(i.quantity)} {i.unit}
                          </span>
                        </td>
                        <td className="border-b border-border px-3 py-2.5 text-xs">
                          {i.source ? (
                            <span className="inline-flex items-center gap-1 text-muted">
                              <CircleCheck className="size-3.5 text-success" /> {i.source}
                            </span>
                          ) : (
                            <span className="text-subtle">Not awarded</span>
                          )}
                        </td>
                        <td className="w-40 border-b border-border px-3 py-2">
                          <label className="sr-only" htmlFor={`cost-${i.id}`}>
                            Cost for {i.description}
                          </label>
                          <div className="relative">
                            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-xs text-subtle">
                              {currency === "GBP" ? "£" : "$"}
                            </span>
                            <input
                              id={`cost-${i.id}`}
                              type="number"
                              min="0"
                              step="0.01"
                              inputMode="decimal"
                              value={costs[i.id]}
                              onChange={(e) => setCosts((s) => ({ ...s, [i.id]: e.target.value }))}
                              placeholder="0.00"
                              className={`input num h-9 pl-6 text-right ${c === null ? "border-warning/60 bg-warning-soft/40" : ""}`}
                            />
                          </div>
                        </td>
                        <td className="num border-b border-border px-5 py-2.5 text-right font-medium">
                          {c === null ? <span className="text-subtle">—</span> : money(c * (1 + m / 100), currency, 2)}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            ))}
          </table>
        </div>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <div className="card p-5">
          <p className="label">Your markup</p>
          <div className="flex items-center gap-2">
            <div className="relative w-28">
              <input
                type="number"
                id="markup"
                min="0"
                step="0.5"
                value={markup}
                onChange={(e) => setMarkup(e.target.value)}
                className="input num pr-7 text-right"
                aria-label="Markup percent"
              />
              <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted">%</span>
            </div>
            <div className="flex gap-1">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setMarkup(String(p))}
                  className={`h-8 rounded-md px-2 text-xs font-medium transition ${
                    m === p ? "bg-brand text-brand-fg" : "bg-surface-2 text-muted ring-1 ring-border hover:text-foreground"
                  }`}
                >
                  {p}%
                </button>
              ))}
            </div>
          </div>

          <dl className="mt-5 space-y-2.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Your cost</dt>
              <dd className="num">{money(totalCost, currency, 2)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Your margin</dt>
              <dd className="num font-medium text-success">+{money(ownerTotal - totalCost, currency, 2)}</dd>
            </div>
            <div className="flex items-baseline justify-between border-t border-border pt-3">
              <dt className="font-semibold">Client pays</dt>
              <dd className="num text-2xl font-semibold">{money(ownerTotal, currency, 2)}</dd>
            </div>
          </dl>
        </div>

        <div className="card p-5">
          <label htmlFor="message" className="label">
            Message to your client
          </label>
          <textarea
            id="message"
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Start date, timeline, payment schedule, what's included…"
            className="textarea"
          />
          <p className="mt-3 flex items-start gap-2 text-xs text-muted">
            <EyeOff className="mt-px size-3.5 shrink-0" />
            Your client sees one price per line and the total. Never your costs, margin or sub-contractors.
          </p>

          {(missing > 0 || !ownerReady || error) && (
            <div className="mt-3 space-y-1.5">
              {missing > 0 && (
                <p className="flex items-center gap-1.5 text-xs text-warning">
                  <TriangleAlert className="size-3.5" /> {missing} line{missing > 1 ? "s" : ""} still need a cost
                </p>
              )}
              {!ownerReady && (
                <p className="flex items-center gap-1.5 text-xs text-warning">
                  <TriangleAlert className="size-3.5" /> Add your client&apos;s email in Project details first
                </p>
              )}
              {error && (
                <p role="alert" className="text-xs text-danger">
                  {error}
                </p>
              )}
            </div>
          )}
          {notice && (
            <p role="status" className="mt-3 flex items-center gap-1.5 text-xs text-success">
              <CircleCheck className="size-3.5" /> {notice}
            </p>
          )}

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button onClick={() => save(false)} disabled={pending} className="btn-secondary">
              {pending && action === "draft" ? <LoaderCircle className="animate-spin" /> : <Save />} Save draft
            </button>
            <button onClick={() => save(true)} disabled={pending || missing > 0 || !ownerReady} className="btn-primary">
              {pending && action === "send" ? <LoaderCircle className="animate-spin" /> : <Send />} Send to client
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
