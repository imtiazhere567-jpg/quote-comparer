import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowRight, Scale } from "lucide-react";
import { withProfile } from "@/lib/auth";
import { getAwards, getInvites, getJob, getRates, getScope } from "@/lib/queries";
import { awardedInviteByItem, compareBids } from "@/lib/compare";
import { Empty } from "@/components/ui";
import { AwardBoard, type BoardBidder, type BoardItem } from "./award-board";

export default function ComparePage({ params }: PageProps<"/jobs/[id]/compare">) {
  return (
    <Suspense fallback={<div className="card h-96 animate-pulse" />}>
      <Compare params={params} />
    </Suspense>
  );
}

async function Compare({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await withProfile(async (q, me) => {
    const job = await getJob(q, id);
    if (!job || job.contractor_id !== me.id) return null;
    const [scope, invites, rates, awards] = await Promise.all([getScope(q, id), getInvites(q, id), getRates(q, id), getAwards(q, id)]);
    return { job, scope, invites, rates, awards };
  });
  if (!data) notFound();
  const { job, scope, invites, rates, awards } = data;

  const cmp = compareBids(scope, invites, rates);
  const submitted = invites.filter((i) => i.status === "submitted");

  if (submitted.length === 0) {
    return (
      <Empty
        icon={Scale}
        title="No bids to compare yet"
        action={
          <Link href={`/jobs/${job.id}/bids`} className="btn-primary">
            Request bids <ArrowRight />
          </Link>
        }
      >
        Once sub-contractors send their prices they&apos;ll appear here side by side, with the cheapest highlighted.
      </Empty>
    );
  }

  const awardedBy = awardedInviteByItem(scope, awards);
  const live = awards.filter((a) => a.status === "planned" || a.status === "offered" || a.status === "accepted");
  const wholeAward = live.find((a) => a.scope_item_id === null) ?? null;

  const bidders: BoardBidder[] = submitted.map((inv) => {
    const s = cmp.bidders.find((b) => b.inviteId === inv.id)!;
    return {
      inviteId: inv.id,
      name: inv.sub_name,
      company: inv.sub_company,
      notes: inv.sub_notes,
      total: s.total,
      priced: s.pricedCount,
      invited: s.invitedCount,
      complete: s.complete,
    };
  });

  const items: BoardItem[] = cmp.items.map((c) => {
    const award = awardedBy.get(c.item.id);
    return {
      id: c.item.id,
      stage: c.item.stage,
      description: c.item.description,
      quantity: c.item.quantity,
      unit: c.item.unit,
      prices: Object.fromEntries([...c.totals].map(([inv, total]) => [inv, { total, rate: c.rates.get(inv)! }])),
      lowest: c.cheapestInviteId,
      lowFlags: [...c.lowOutliers],
      highFlags: [...c.highOutliers],
      award: award ? { inviteId: award.invite_id, status: award.status as "planned" | "offered" | "accepted" } : null,
    };
  });

  const declined = awards
    .filter((a) => a.status === "declined" && !live.some((l) => l.scope_item_id === a.scope_item_id))
    .map((a) => ({
      name: invites.find((i) => i.id === a.invite_id)?.sub_name ?? "A sub-contractor",
      what: a.scope_item_id ? (scope.find((s) => s.id === a.scope_item_id)?.description ?? "an item") : "the whole job",
    }));

  return (
    <AwardBoard
      jobId={job.id}
      currency={job.currency}
      canAward={["bidding", "awarding"].includes(job.status)}
      bidders={bidders}
      items={items}
      bestSingle={cmp.bestSingle ? { inviteId: cmp.bestSingle.inviteId, total: cmp.bestSingle.total } : null}
      splitTotal={cmp.splitTotal}
      wholeAward={wholeAward ? { inviteId: wholeAward.invite_id, status: wholeAward.status as "planned" | "offered" | "accepted" } : null}
      waitingOn={invites.filter((i) => i.status === "sent" || i.status === "viewed").map((i) => i.sub_name)}
      declined={declined}
    />
  );
}
