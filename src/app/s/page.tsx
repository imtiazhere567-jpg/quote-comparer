import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { ChevronRight, HardHat } from "lucide-react";
import { asSystem } from "@/lib/db";
import { isDemoMode } from "@/lib/supabase/env";
import { Avatar } from "@/components/ui";

/** Demo sign-in for sub-contractors: pick whose phone you're holding. */
export default function SubStart() {
  return (
    <main className="flex flex-1 flex-col">
      <div className="hero-panel relative overflow-hidden px-6 pt-16 pb-9">
        <div className="blueprint pointer-events-none absolute inset-0" />
        <div className="relative">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-hero-num text-hero">
            <HardHat className="size-6" />
          </span>
          <h1 className="mt-6 text-[30px] leading-tight font-bold tracking-tight text-white">
            Sub-contractor <span className="text-hero-num">app</span>
          </h1>
          <p className="mt-2 text-[15px] opacity-80">Bid requests arrive in your inbox. Send prices, get jobs, track your tasks.</p>
        </div>
      </div>
      <div className="flex-1 px-5 py-7">
        {isDemoMode ? (
          <>
            <p className="eyebrow mb-3">Open the phone of…</p>
            <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-surface" />}>
              <Subs />
            </Suspense>
          </>
        ) : (
          <p className="text-sm text-muted">Sub-contractors open the private link from their email. This demo screen is only available in demo mode.</p>
        )}
      </div>
    </main>
  );
}

async function Subs() {
  await connection();
  const subs = await asSystem((q) =>
    q<{ id: string; name: string; company_name: string | null; trades: string[]; unread: number }>(
      `select s.id, s.name, s.company_name, s.trades,
              (select count(*)::int from notifications n where n.subcontractor_id = s.id and n.read_at is null) as unread
         from subcontractors s order by s.name`,
    ),
  );
  return (
    <ul className="space-y-2.5">
      {subs.map((s) => (
        <li key={s.id}>
          <Link href={`/s/${s.id}`} className="card flex items-center gap-3.5 p-4 active:scale-[0.99]">
            <Avatar name={s.name} size="lg" />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{s.name}</span>
              <span className="block truncate text-[13px] text-muted">{s.company_name ?? s.trades.join(", ")}</span>
            </span>
            {s.unread > 0 && (
              <span className="num rounded-full bg-danger px-2 py-0.5 text-xs font-bold text-white">{s.unread}</span>
            )}
            <ChevronRight className="size-5 text-subtle" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
