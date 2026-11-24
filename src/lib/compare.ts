import type { Award, BidInvite, BidRate, ScopeItem } from "@/lib/types";

/** Below this share of the median, a rate is flagged as suspiciously low. */
export const LOW_RATE_RATIO = 0.6;
/** Above this multiple of the median (3+ bids), or of the other bid (2 bids), a rate is flagged as suspiciously high. */
export const HIGH_RATE_RATIO = 1.8;
export const HIGH_PAIR_RATIO = 2.5;

export type ItemComparison = {
  item: ScopeItem;
  /** inviteId -> line total (qty × rate) */
  totals: Map<string, number>;
  rates: Map<string, number>;
  cheapestInviteId: string | null;
  cheapestTotal: number | null;
  median: number | null;
  lowOutliers: Set<string>;
  /** Rates far above the others: often a typo (e.g. a total typed as a unit rate). */
  highOutliers: Set<string>;
};

export type BidderSummary = {
  inviteId: string;
  total: number;
  pricedCount: number;
  invitedCount: number;
  missingItemIds: string[];
  complete: boolean;
  cheapestCount: number;
};

export type Comparison = {
  items: ItemComparison[];
  bidders: BidderSummary[];
  /** Cheapest complete single bidder for the whole job */
  bestSingle: BidderSummary | null;
  /** Sum of the cheapest bid on every item that has at least one bid */
  splitTotal: number;
  unbidItemIds: string[];
};

function median(values: number[]) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function compareBids(scope: ScopeItem[], invites: BidInvite[], rates: BidRate[]): Comparison {
  const submitted = invites.filter((i) => i.status === "submitted");
  const rateMap = new Map<string, Map<string, number>>(); // itemId -> inviteId -> rate
  for (const r of rates) {
    if (!submitted.some((i) => i.id === r.invite_id)) continue;
    if (!rateMap.has(r.scope_item_id)) rateMap.set(r.scope_item_id, new Map());
    rateMap.get(r.scope_item_id)!.set(r.invite_id, r.unit_rate);
  }

  const items: ItemComparison[] = scope.map((item) => {
    const rs = rateMap.get(item.id) ?? new Map<string, number>();
    const totals = new Map<string, number>();
    let cheapestInviteId: string | null = null;
    let cheapestTotal: number | null = null;
    for (const [inviteId, rate] of rs) {
      const t = rate * item.quantity;
      totals.set(inviteId, t);
      if (cheapestTotal === null || t < cheapestTotal) {
        cheapestTotal = t;
        cheapestInviteId = inviteId;
      }
    }
    const med = median([...rs.values()]);
    const lowOutliers = new Set<string>();
    if (med && rs.size >= 3) {
      for (const [inviteId, rate] of rs) if (rate < med * LOW_RATE_RATIO) lowOutliers.add(inviteId);
    }
    const highOutliers = new Set<string>();
    if (med && rs.size >= 3) {
      for (const [inviteId, rate] of rs) if (rate > med * HIGH_RATE_RATIO) highOutliers.add(inviteId);
    } else if (rs.size === 2) {
      const [[a, ra], [b, rb]] = [...rs];
      const lo = Math.min(ra, rb);
      if (lo > 0 && Math.max(ra, rb) / lo > HIGH_PAIR_RATIO) highOutliers.add(ra > rb ? a : b);
    }
    return { item, totals, rates: rs, cheapestInviteId, cheapestTotal, median: med, lowOutliers, highOutliers };
  });

  const bidders: BidderSummary[] = submitted.map((inv) => {
    const invited = inv.scope_item_ids?.length ? scope.filter((s) => inv.scope_item_ids!.includes(s.id)) : scope;
    let total = 0;
    const missing: string[] = [];
    for (const it of invited) {
      const t = items.find((c) => c.item.id === it.id)!.totals.get(inv.id);
      if (t === undefined) missing.push(it.id);
      else total += t;
    }
    return {
      inviteId: inv.id,
      total,
      pricedCount: invited.length - missing.length,
      invitedCount: invited.length,
      missingItemIds: missing,
      complete: missing.length === 0 && invited.length === scope.length,
      cheapestCount: items.filter((c) => c.cheapestInviteId === inv.id).length,
    };
  });

  const completes = bidders.filter((b) => b.complete).sort((a, b) => a.total - b.total);
  return {
    items,
    bidders,
    bestSingle: completes[0] ?? null,
    splitTotal: items.reduce((sum, c) => sum + (c.cheapestTotal ?? 0), 0),
    unbidItemIds: items.filter((c) => c.cheapestInviteId === null).map((c) => c.item.id),
  };
}

/** Which invite (sub) is doing each item, based on live awards. */
export function awardedInviteByItem(scope: ScopeItem[], awards: Award[]) {
  const live = awards.filter((a) => a.status === "planned" || a.status === "offered" || a.status === "accepted");
  const whole = live.find((a) => a.scope_item_id === null);
  const map = new Map<string, Award>();
  for (const item of scope) {
    const own = live.find((a) => a.scope_item_id === item.id);
    if (own) map.set(item.id, own);
    else if (whole) map.set(item.id, whole);
  }
  return map;
}
