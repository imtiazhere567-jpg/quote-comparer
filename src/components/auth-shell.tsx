import { BrandLogo } from "@/components/brand-logo";
import Link from "next/link";
import type { ReactNode } from "react";
import { CircleCheck, EyeOff, Layers, TrendingDown } from "lucide-react";
import { isDemoMode } from "@/lib/supabase/env";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="grid min-h-dvh flex-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <BrandPanel />
      <main className="flex flex-col px-5 py-8 sm:px-10">
        <div className="lg:hidden">
          <Link href="/">
            <BrandLogo />
          </Link>
        </div>
        <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center py-10">
          <h1 className="text-[28px] leading-tight font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
          {isDemoMode && (
            <p className="mt-4 rounded-[10px] border border-brand-soft-line bg-brand-soft px-3 py-2 text-xs text-brand-soft-fg">
              <strong>Demo mode:</strong> a local database on this computer. No passwords needed.
            </p>
          )}
          <div className="mt-7">{children}</div>
        </div>
      </main>
    </div>
  );
}

function BrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden bg-ink p-10 text-ink-fg lg:flex lg:flex-col">
      <div className="blueprint pointer-events-none absolute inset-0" />
      <div className="relative">
        <Link href="/">
          <BrandLogo tone="light" />
        </Link>
      </div>

      <div className="relative my-auto max-w-lg py-12">
        <h2 className="text-[40px] leading-[1.1] font-bold tracking-tight text-balance">
          Every sub-contractor bid, <span className="text-ink-accent">side by side.</span>
        </h2>
        <p className="mt-4 text-base text-ink-muted">
          Send one work list, get prices from your trades, award the best rate for every item and send your client one clean quote.
        </p>

        {/* mini preview */}
        <div className="mt-10 rounded-2xl border border-ink-border bg-ink-2/80 p-4 shadow-pop backdrop-blur">
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span className="font-semibold tracking-wide uppercase">Porcelain floor tiles · 320 sq ft</span>
            <span>4 bids</span>
          </div>
          <div className="mt-3 space-y-1.5">
            {[
              ["Mike Torres", "$3,238", false],
              ["Priya Shah", "$3,424", false],
              ["Grace Kim", "$2,910", true],
              ["Dan O'Neill", "$3,926", false],
            ].map(([n, p, best]) => (
              <div
                key={n as string}
                className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                  best ? "bg-ink-accent font-semibold text-ink" : "bg-ink-hover"
                }`}
              >
                <span className="flex items-center gap-2">
                  {best && <CircleCheck className="size-4" />}
                  {n}
                </span>
                <span className="num">{p}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <ul className="relative grid grid-cols-3 gap-4 text-[13px] text-ink-muted">
        <li className="flex items-start gap-2">
          <TrendingDown className="mt-0.5 size-4 shrink-0 text-ink-accent" /> Find the lowest price for every trade
        </li>
        <li className="flex items-start gap-2">
          <Layers className="mt-0.5 size-4 shrink-0 text-ink-accent" /> Award the whole job or split it
        </li>
        <li className="flex items-start gap-2">
          <EyeOff className="mt-0.5 size-4 shrink-0 text-ink-accent" /> Clients never see sub-contractor rates
        </li>
      </ul>
    </aside>
  );
}
