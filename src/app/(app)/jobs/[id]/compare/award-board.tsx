"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  CircleCheck,
  Hand,
  LoaderCircle,
  MessageSquareQuote,
  RotateCcw,
  Sparkles,
  TrendingDown,
  UserRound,
  UserX,
  type LucideIcon,
} from "lucide-react";
import { sendAwardPlan, withdrawAllAwards } from "@/lib/actions/jobs";
import { money, qty, type Currency } from "@/lib/format";
import { Avatar, Badge, Callout, Tag } from "@/components/ui";
import { NextStepAction } from "@/components/next-step";

export type BoardBidder = {
  inviteId: string;
  name: string;
  company: string | null;
  notes: string | null;
  total: number;
  priced: number;
  invited: number;
  complete: boolean;
};

export type BoardItem = {
  id: string;
  stage: string;
  description: string;
  quantity: number;
  unit: string;
  prices: Record<string, { total: number; rate: number }>;
  lowest: string | null;
  lowFlags: string[];
  /** far above the others: often a typo */
  highFlags: string[];
  award: { inviteId: string; status: "planned" | "offered" | "accepted" } | null;
};

/** single = one contractor for everything · auto = cheapest per item · manual = you choose per item */
type Mode = "single" | "auto" | "manual";

const first = (name: string) => name.split(" ")[0];

export function AwardBoard({
  jobId,
  currency,
  canAward,
  bidders,
  items,
  bestSingle,
  splitTotal,
  wholeAward,
  waitingOn,
  declined,
}: {
  jobId: string;
  currency: Currency;
  canAward: boolean;
  bidders: BoardBidder[];
  items: BoardItem[];
  bestSingle: { inviteId: string; total: number } | null;
  splitTotal: number;
  wholeAward: { inviteId: string; status: "planned" | "offered" | "accepted" } | null;
  waitingOn: string[];
  declined: { name: string; what: string }[];
}) {
  const hasAwards = items.some((i) => i.award);
  const fromAwards = (): Record<string, string> => Object.fromEntries(items.filter((i) => i.award).map((i) => [i.id, i.award!.inviteId]));
  const cheapest = useMemo(
    (): Record<string, string> => Object.fromEntries(items.filter((i) => i.lowest).map((i) => [i.id, i.lowest!])),
    [items],
  );
  const sameAsCheapest = (c: Record<string, string>) => items.every((it) => (c[it.id] ?? null) === (cheapest[it.id] ?? null));

  const initialMode = (): Mode => {
    if (wholeAward) return "single";
    if (hasAwards) return sameAsCheapest(fromAwards()) ? "auto" : "manual";
    return bestSingle ? "single" : "auto";
  };

  const [mode, setMode] = useState<Mode>(initialMode);
  const [singleId, setSingleId] = useState<string | null>(wholeAward?.inviteId ?? bestSingle?.inviteId ?? null);
  const [manual, setManual] = useState<Record<string, string>>(() => (hasAwards && !wholeAward ? fromAwards() : cheapest));
  const [showAll, setShowAll] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sentNote, setSentNote] = useState<string | null>(null);

  const nameOf = (id: string) => bidders.find((b) => b.inviteId === id)?.name ?? "?";
  const locked = (it: BoardItem) => it.award?.status === "accepted";
  const isOdd = (it: BoardItem, inv: string) => it.lowFlags.includes(inv) || (it.highFlags ?? []).includes(inv);

  /** itemId -> inviteId for the option being looked at */
  const plan: Record<string, string> = useMemo(() => {
    if (mode === "single") return singleId ? Object.fromEntries(items.filter((i) => i.prices[singleId]).map((i) => [i.id, singleId])) : {};
    if (mode === "auto") return cheapest;
    return manual;
  }, [mode, singleId, manual, cheapest, items]);

  const planTotal = items.reduce((s, it) => s + (plan[it.id] ? (it.prices[plan[it.id]]?.total ?? 0) : 0), 0);
  const flaggedInPlan = items.filter((it) => plan[it.id] && isOdd(it, plan[it.id]));
  const unassigned = items.filter((it) => !plan[it.id]).length;

  const groups = useMemo(() => {
    const by = new Map<string, BoardItem[]>();
    for (const it of items) {
      const inv = plan[it.id];
      if (inv) by.set(inv, [...(by.get(inv) ?? []), it]);
    }
    return [...by].sort((a, b) => b[1].length - a[1].length);
  }, [items, plan]);

  // Has the choice changed since offers were last sent?
  const dirty = useMemo(() => {
    if (mode === "single") return !(wholeAward && wholeAward.inviteId === singleId);
    if (wholeAward) return true;
    return items.some((it) => (it.award?.inviteId ?? null) !== (plan[it.id] ?? null));
  }, [mode, singleId, wholeAward, items, plan]);

  const autoGroups = new Set(Object.values(cheapest)).size;
  const savings = bestSingle ? bestSingle.total - splitTotal : 0;

  function choose(m: Mode) {
    setSentNote(null);
    setError(null);
    if (m === "manual" && mode !== "manual") setManual(mode === "single" ? plan : cheapest);
    setMode(m);
  }

  function pick(it: BoardItem, inviteId: string) {
    if (!canAward || locked(it)) return;
    setSentNote(null);
    // clicking a price always means "I'm choosing myself"
    if (mode !== "manual") {
      setManual({ ...plan, [it.id]: inviteId });
      setMode("manual");
    } else setManual((c) => ({ ...c, [it.id]: inviteId }));
  }

  function send() {
    setError(null);
    start(async () => {
      try {
        await sendAwardPlan(mode === "single" && singleId ? { jobId, mode: "single", inviteId: singleId } : { jobId, mode: "items", choices: plan });
        setSentNote(
          mode === "single"
            ? `Saved: ${nameOf(singleId!)} will do the whole job. They're told once your client accepts the quote.`
            : `Saved: work split across ${groups.length} sub-contractor${groups.length === 1 ? "" : "s"}. They're told once your client accepts the quote.`,
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  const actionLabel =
    mode === "single"
      ? `Assign project to ${singleId ? first(nameOf(singleId)) : "…"} · ${money(planTotal, currency)}`
      : `${mode === "auto" ? "Auto-assign & hire" : "Assign & hire"} ${groups.length} · ${money(planTotal, currency)}`;
  const canSend = canAward && (dirty || !hasAwards) && groups.length > 0 && (mode !== "single" || !!singleId);

  /* ---------------------------------------------------------------- alerts */
  const incomplete = bidders.filter((b) => b.priced < b.invited);
  const odd = items.flatMap((it) => [
    ...it.lowFlags.map((inv) => ({ it, inv, kind: "low" as const })),
    ...(it.highFlags ?? []).map((inv) => ({ it, inv, kind: "high" as const })),
  ]);

  const options: { id: Mode; icon: LucideIcon; title: string; line: string; sub: string; badge?: { text: string; tone: "success" | "brand" | "neutral" } }[] = [
    {
      id: "single",
      icon: UserRound,
      title: "One contractor for everything",
      line: bestSingle ? `${nameOf(bestSingle.inviteId)} · ${money(bestSingle.total, currency)}` : "Nobody priced every item",
      sub: bestSingle ? "Cheapest complete bid. One person to manage." : "Choose one of the other options.",
      badge: bestSingle ? { text: "Simplest", tone: "neutral" } : undefined,
    },
    {
      id: "auto",
      icon: Sparkles,
      title: "Auto-assign the cheapest",
      line: `${money(splitTotal, currency)} · ${autoGroups} sub-contractor${autoGroups === 1 ? "" : "s"}`,
      sub: "Every item goes to whoever priced it lowest. You hire all of them.",
      badge: savings > 0 ? { text: `Saves ${money(savings, currency)}`, tone: "success" } : { text: "Lowest cost", tone: "success" },
    },
    {
      id: "manual",
      icon: Hand,
      title: "Assign manually",
      line: "You choose, item by item",
      sub: "Click a price in the table to give that item to that sub-contractor.",
    },
  ];

  /* ---------------------------------------------------------------- price table */
  const matrix = (interactive: boolean) => (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[880px] border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th className="w-[240px] border-b border-border bg-surface-2 px-5 py-3 text-left align-bottom">
              <span className="eyebrow">Item</span>
            </th>
            {bidders.map((b) => {
              const best = bestSingle?.inviteId === b.inviteId;
              return (
                <th key={b.inviteId} className="border-b border-border bg-surface-2 px-2.5 py-3 text-left align-top font-normal">
                  <div className={`flex flex-col gap-1.5 rounded-xl border p-3 ${best ? "border-success-line bg-[linear-gradient(var(--success-soft),var(--surface)_70%)]" : "border-border bg-surface"}`}>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={b.name} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate text-sm leading-tight font-semibold">{b.name}</p>
                        <p className="truncate text-xs text-subtle">{b.company ?? " "}</p>
                      </div>
                    </div>
                    <p className="num text-lg font-bold">{money(b.total, currency)}</p>
                    <p className="text-xs text-muted">
                      {b.priced}/{b.invited} priced
                    </p>
                    {best ? (
                      <span className="self-start">
                        <Badge tone="success">Cheapest overall</Badge>
                      </span>
                    ) : b.priced < b.invited ? (
                      <span className="self-start">
                        <Badge tone="warning">Missing {b.invited - b.priced}</Badge>
                      </span>
                    ) : null}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {items.map((it, idx) => {
            const newStage = idx === 0 || items[idx - 1].stage !== it.stage;
            const vals = Object.values(it.prices).map((p) => p.total);
            const min = Math.min(...vals);
            const max = Math.max(...vals);
            return [
              newStage && (
                <tr key={`${it.id}-stage`}>
                  <td colSpan={bidders.length + 1} className="border-b border-border bg-surface-2 px-5 py-2">
                    <span className="eyebrow">{it.stage}</span>
                  </td>
                </tr>
              ),
              <tr key={it.id}>
                <td className="border-b border-border px-5 py-3">
                  <p className="font-semibold">{it.description}</p>
                  <p className="num mt-0.5 text-xs text-subtle">
                    {qty(it.quantity)} {it.unit}
                  </p>
                  {it.award?.status === "accepted" && (
                    <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-success">
                      <CircleCheck className="size-3.5" /> Accepted by {first(nameOf(it.award.inviteId))}
                    </p>
                  )}
                </td>
                {bidders.map((b) => {
                  const p = it.prices[b.inviteId];
                  if (!p)
                    return (
                      <td key={b.inviteId} className="border-b border-border px-2.5 py-1.5">
                        <span className="block px-3 py-4 text-[13px] text-subtle italic">Not priced</span>
                      </td>
                    );
                  const isLow = it.lowest === b.inviteId;
                  const flagged = isOdd(it, b.inviteId);
                  const selected = plan[it.id] === b.inviteId;
                  const pct = max === min ? 100 : 25 + ((p.total - min) / (max - min)) * 75;
                  const clickable = interactive && canAward && !locked(it);
                  return (
                    <td key={b.inviteId} className="border-b border-border px-2.5 py-1.5 align-middle">
                      <button
                        type="button"
                        onClick={() => pick(it, b.inviteId)}
                        disabled={!clickable}
                        aria-pressed={selected}
                        title={clickable ? `Give “${it.description}” to ${b.name}` : undefined}
                        className={`grid w-full grid-cols-[18px_1fr] items-center gap-x-2.5 gap-y-0.5 rounded-[10px] border px-3 py-2.5 text-left transition ${
                          selected
                            ? "border-select bg-select-bg shadow-[0_0_0_3px_var(--select-ring)]"
                            : isLow
                              ? "border-transparent bg-success-soft"
                              : "border-transparent"
                        } ${clickable && !selected ? "hover:border-border-strong hover:bg-surface-2" : ""} disabled:cursor-default`}
                      >
                        <span className={`row-span-2 grid size-[18px] place-items-center rounded-full border-[1.5px] ${selected ? "border-select-dot bg-select-dot" : "border-border-strong bg-surface"}`}>
                          {selected && <span className="size-[7px] rounded-full bg-select-dot-in" />}
                        </span>
                        <span className={`num flex flex-wrap items-center gap-1.5 text-[15px] font-semibold ${isLow ? "text-success" : ""}`}>
                          {money(p.total, currency)}
                          {isLow && <Tag tone="success">Lowest</Tag>}
                          {flagged && <Tag tone="warning">Check</Tag>}
                        </span>
                        <span className="num text-xs text-subtle">{it.unit === "lump sum" ? "fixed price" : `${money(p.rate, currency, 2)} / ${it.unit}`}</span>
                        <span className="relative col-start-2 mt-1.5 h-[3px] overflow-hidden rounded-full bg-border">
                          <i className={`absolute inset-y-0 left-0 rounded-full ${isLow ? "bg-success" : "bg-subtle/50"}`} style={{ width: `${pct}%` }} />
                        </span>
                      </button>
                    </td>
                  );
                })}
              </tr>,
            ];
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Alerts: only what needs a look */}
      {(declined.length > 0 || odd.length > 0 || incomplete.length > 0 || waitingOn.length > 0) && (
        <div className="space-y-2">
          {declined.map((d, i) => (
            <Callout key={`d${i}`} tone="warning">
              <span className="inline-flex items-center gap-1.5">
                <UserX className="size-3.5" /> {d.name} declined {d.what}. Choose someone else and assign again.
              </span>
            </Callout>
          ))}
          {odd.slice(0, 3).map(({ it, inv, kind }, i) => (
            <Callout key={`o${i}`} tone="warning">
              {nameOf(inv)}&apos;s price for {it.description.toLowerCase()} is far {kind === "high" ? "above" : "below"} the others.{" "}
              {kind === "high" ? "It may be a typo." : "Check what's included."}
            </Callout>
          ))}
          {incomplete.length > 0 && (
            <Callout tone="info">
              {incomplete.map((b) => first(b.name)).join(", ")} didn&apos;t price every item, so {incomplete.length === 1 ? "they" : "they"} can&apos;t take the whole job.
            </Callout>
          )}
          {waitingOn.length > 0 && <Callout tone="info">Still waiting on {waitingOn.join(", ")}.</Callout>}
        </div>
      )}

      {/* Step 1: choose how */}
      <section className="card overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold tracking-tight">Who should do the work?</h2>
          <p className="text-[13px] text-muted">
            {bidders.length} bids compared across {items.length} items. Pick one of three ways to assign it.
          </p>
        </div>
        <div className="grid gap-3 p-4 md:grid-cols-3" role="radiogroup" aria-label="How to assign the work">
          {options.map((o) => {
            const on = mode === o.id;
            const disabled = !canAward || (o.id === "single" && !bestSingle);
            return (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={disabled}
                onClick={() => choose(o.id)}
                className={`relative flex flex-col rounded-[14px] border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  on ? "border-select bg-select-bg shadow-[0_0_0_3px_var(--select-ring)]" : "border-border bg-surface hover:border-border-strong hover:bg-surface-2"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className={`flex size-10 items-center justify-center rounded-[10px] ${on ? "bg-hero text-hero-num" : "bg-surface-2 text-muted ring-1 ring-border"}`}>
                    <o.icon className="size-5" />
                  </span>
                  <span className={`flex size-6 items-center justify-center rounded-full border-2 ${on ? "border-select-dot bg-select-dot" : "border-border-strong"}`}>
                    {on && <Check className="size-3.5 text-select-dot-in" strokeWidth={3} />}
                  </span>
                </div>
                <p className="mt-3 font-semibold">{o.title}</p>
                <p className="num mt-0.5 text-sm font-semibold text-foreground">{o.line}</p>
                <p className="mt-1 text-[13px] text-muted">{o.sub}</p>
                {o.badge && (
                  <span className="mt-3 self-start">
                    <Badge tone={o.badge.tone}>{o.badge.text}</Badge>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Step 2: details of the chosen option + one button */}
      <section className="card overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold tracking-tight">
            {mode === "single" ? "Choose the contractor" : mode === "auto" ? "Who gets what (cheapest per item)" : "Choose who does each item"}
          </h2>
          <p className="text-[13px] text-muted">
            {mode === "single"
              ? "Cheapest first. They'll do every item at the prices they bid."
              : mode === "auto"
                ? "Worked out from the lowest price on every line."
                : "Click a price in the table below. Your choices are highlighted."}
          </p>
        </div>

        {mode === "single" && (
          <ContractorPicker
            bidders={bidders.filter((b) => b.complete)}
            value={singleId}
            onChange={(id) => {
              setSentNote(null);
              setSingleId(id);
            }}
            currency={currency}
            oddIds={new Set(odd.map((o) => o.inv))}
            disabled={!canAward}
          />
        )}

        {mode === "manual" && <div className="border-b border-border">{matrix(true)}</div>}

        {mode !== "single" && (
          <ul className="grid gap-3 p-5 sm:grid-cols-2">
            {groups.map(([inviteId, its]) => {
              const sum = its.reduce((s, it) => s + it.prices[inviteId].total, 0);
              const accepted = its.every((it) => it.award?.status === "accepted" && it.award.inviteId === inviteId);
              return (
                <li key={inviteId} className="flex gap-3 rounded-xl border border-border p-3.5">
                  <Avatar name={nameOf(inviteId)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-semibold">
                        {nameOf(inviteId)}
                        {accepted && <CircleCheck className="ml-1 inline size-3.5 text-success" aria-label="Accepted" />}
                      </p>
                      <p className="num shrink-0 font-semibold">{money(sum, currency)}</p>
                    </div>
                    <p className="mt-0.5 text-xs text-muted">
                      {its.length} item{its.length > 1 ? "s" : ""}: {its.map((i) => i.description).join(", ")}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* action bar */}
        <div className="hero-panel flex flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div>
            <p className="text-xs opacity-75">Total cost to you</p>
            <p className="num text-[26px] leading-tight font-bold text-hero-num">{money(planTotal, currency)}</p>
            {bestSingle && bestSingle.total - planTotal > 0 && (
              <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-hero-num">
                <TrendingDown className="size-3.5" /> {money(bestSingle.total - planTotal, currency)} less than one contractor
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canAward && hasAwards && (
              <form action={withdrawAllAwards}>
                <input type="hidden" name="job_id" value={jobId} />
                <button className="btn h-10 text-hero-fg/80 hover:bg-white/10 hover:text-hero-fg">
                  <RotateCcw /> Clear choice
                </button>
              </form>
            )}
            {canSend ? (
              <button className="btn-primary btn-lg" onClick={send} disabled={pending}>
                {pending ? <LoaderCircle className="animate-spin" /> : <Check />}
                {hasAwards ? "Update choice" : actionLabel}
              </button>
            ) : hasAwards ? (
              <Link href={`/jobs/${jobId}/quote`} className="btn-primary btn-lg">
                Build client quote <ArrowRight />
              </Link>
            ) : null}
          </div>
        </div>
        {(flaggedInPlan.length > 0 || unassigned > 0 || error || (sentNote && !dirty)) && (
          <div className="space-y-2 border-t border-border p-4">
            {flaggedInPlan.length > 0 && (
              <Callout tone="warning">
                This choice includes {flaggedInPlan.length === 1 ? `${first(nameOf(plan[flaggedInPlan[0].id]))}'s price for ${flaggedInPlan[0].description.toLowerCase()}` : `${flaggedInPlan.length} unusual prices`}
                , which {flaggedInPlan.length === 1 ? "looks" : "look"} unusual. Check before assigning.
              </Callout>
            )}
            {unassigned > 0 && <Callout tone="info">{unassigned} item{unassigned > 1 ? "s have" : " has"} nobody assigned.</Callout>}
            {error && <Callout tone="danger">{error}</Callout>}
            {sentNote && !dirty && <Callout tone="success">{sentNote}</Callout>}
          </div>
        )}
        <p className="border-t border-border bg-surface-2 px-5 py-2.5 text-xs text-muted">
          Sub-contractors are only told after your client accepts the quote. Your client never sees these prices.
        </p>
      </section>

      {/* Full comparison (for options 1 and 2) */}
      {mode !== "manual" && (
        <section className="card overflow-hidden">
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            aria-expanded={showAll}
            className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-surface-2"
          >
            <span>
              <span className="block text-base font-semibold tracking-tight">Compare all prices</span>
              <span className="block text-[13px] text-muted">
                {bidders.length} bids × {items.length} items, cheapest in green
              </span>
            </span>
            <ChevronDown className={`size-5 text-muted transition ${showAll ? "rotate-180" : ""}`} />
          </button>
          {showAll && <div className="border-t border-border">{matrix(true)}</div>}
        </section>
      )}

      {bidders.some((b) => b.notes) && (
        <section>
          <h2 className="mb-3 text-base font-semibold tracking-tight">Notes from bidders</h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {bidders
              .filter((b) => b.notes)
              .map((b) => (
                <li key={b.inviteId} className="card flex gap-3 p-4 text-sm">
                  <Avatar name={b.name} size="sm" />
                  <div>
                    <p className="font-semibold">{b.name}</p>
                    <p className="mt-0.5 flex gap-1.5 text-muted">
                      <MessageSquareQuote className="mt-0.5 size-3.5 shrink-0" />
                      {b.notes}
                    </p>
                  </div>
                </li>
              ))}
          </ul>
        </section>
      )}

      {/* Same main action in the page's Next step banner */}
      <NextStepAction path={`/jobs/${jobId}/compare`}>
        {canSend ? (
          <button className="btn-primary" onClick={send} disabled={pending}>
            {pending ? <LoaderCircle className="animate-spin" /> : <Check />}
            {hasAwards ? "Update choice" : actionLabel}
          </button>
        ) : hasAwards ? (
          <Link href={`/jobs/${jobId}/quote`} className="btn-primary">
            Build client quote <ArrowRight />
          </Link>
        ) : null}
      </NextStepAction>
    </div>
  );
}

/** Card list to choose the one sub-contractor for the whole job. */
function ContractorPicker({
  bidders,
  value,
  onChange,
  currency,
  oddIds,
  disabled,
}: {
  bidders: BoardBidder[];
  value: string | null;
  onChange: (id: string) => void;
  currency: Currency;
  oddIds: Set<string>;
  disabled: boolean;
}) {
  const sorted = [...bidders].sort((a, b) => a.total - b.total);
  const best = sorted[0]?.total ?? 0;
  return (
    <div className="p-5">
      {sorted.length === 0 ? (
        <p className="rounded-xl bg-surface-2 px-3 py-3 text-[13px] text-muted">Nobody has priced every item yet.</p>
      ) : (
        <div role="radiogroup" aria-label="Contractor for the whole job" className="grid gap-2.5 md:grid-cols-2">
          {sorted.map((b, i) => {
            const on = value === b.inviteId;
            return (
              <button
                key={b.inviteId}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={disabled}
                onClick={() => onChange(b.inviteId)}
                className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition disabled:cursor-default ${
                  on ? "border-select bg-select-bg shadow-[0_0_0_3px_var(--select-ring)]" : "border-border bg-surface hover:border-border-strong hover:bg-surface-2"
                }`}
              >
                <span className={`grid size-[18px] shrink-0 place-items-center rounded-full border-[1.5px] ${on ? "border-select-dot bg-select-dot" : "border-border-strong bg-surface"}`}>
                  {on && <span className="size-[7px] rounded-full bg-select-dot-in" />}
                </span>
                <Avatar name={b.name} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{b.name}</span>
                  <span className="block truncate text-xs text-subtle">
                    {i === 0 ? <span className="font-semibold text-success">Cheapest</span> : <>+{money(b.total - best, currency)} more</>}
                    {oddIds.has(b.inviteId) && <span className="ml-1.5 font-semibold text-warning">· check prices</span>}
                  </span>
                </span>
                <span className={`num shrink-0 text-[15px] font-bold ${i === 0 ? "text-success" : ""}`}>{money(b.total, currency)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
