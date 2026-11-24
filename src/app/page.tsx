import { BrandLogo } from "@/components/brand-logo";
import Link from "next/link";
import { ArrowRight, CircleCheck, ClipboardList, EyeOff, Receipt, Scale, Send } from "lucide-react";

const steps = [
  { icon: ClipboardList, title: "List the work", body: "Every stage from foundation to finishes, with quantities. Start from a ready-made list." },
  { icon: Send, title: "Collect sub bids", body: "Each sub-contractor gets a private link and prices every line. No account needed." },
  { icon: Scale, title: "Compare & award", body: "See the cheapest price for every item. Give the whole job to one sub, or split it." },
  { icon: Receipt, title: "Quote the client", body: "Add your markup and send one clean quote. Your client never sees sub-contractor rates." },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <section className="relative overflow-hidden bg-ink text-ink-fg">
        <div className="blueprint pointer-events-none absolute inset-0" />
        <header className="relative mx-auto flex h-20 w-full max-w-6xl items-center justify-between px-5 sm:px-8">
          <BrandLogo tone="light" />
          <nav className="flex items-center gap-2">
            <Link href="/login" className="btn text-ink-fg hover:bg-ink-hover">
              Log in
            </Link>
            <Link href="/signup" className="btn-primary">
              Get started
            </Link>
          </nav>
        </header>

        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-5 pt-12 pb-24 sm:px-8 lg:grid-cols-2 lg:pt-20">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-ink-border bg-ink-2 px-3 py-1 text-xs font-medium text-ink-muted">
              <span className="size-1.5 rounded-full bg-ink-accent" /> Northline Builders · homes, extensions and remodels
            </span>
            <h1 className="mt-6 text-[44px] leading-[1.05] font-bold tracking-tight text-balance sm:text-[56px]">
              Every sub-contractor bid, <span className="text-ink-accent">side by side.</span>
            </h1>
            <p className="mt-5 max-w-lg text-lg text-ink-muted">
              One work list. Many bids. The best price for every trade, and a clean quote for your client.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/m/welcome" className="btn-primary btn-lg">
                Start your project <ArrowRight />
              </Link>
              <Link href="/login" className="btn btn-lg border border-ink-border text-ink-fg hover:bg-ink-hover">
                Northline team log in
              </Link>
            </div>
          </div>

          {/* product preview */}
          <div className="rounded-2xl border border-ink-border bg-surface p-5 text-foreground shadow-pop">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Maple Street kitchen &amp; bath</p>
                <p className="text-xs text-muted">4 bids · 8 items</p>
              </div>
              <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-semibold text-success ring-1 ring-success-line ring-inset">
                Save $2,464
              </span>
            </div>
            <div className="mt-4 grid grid-cols-[1.4fr_repeat(3,1fr)] gap-1.5 text-[13px]">
              <span className="eyebrow self-end pb-1">Item</span>
              {["Grace", "Mike", "Priya"].map((n) => (
                <span key={n} className="pb-1 text-right text-xs font-semibold">
                  {n}
                </span>
              ))}
              {[
                ["Strip out", ["$2,142", "$2,400", "$2,165"], 0],
                ["Plumbing", ["—", "$3,496", "$3,711"], 1],
                ["Electrical", ["$3,952", "$4,704", "$3,437"], 2],
                ["Kitchen", ["$5,804", "$7,140", "$6,008"], 0],
              ].map(([item, prices, best]) => (
                <div key={item as string} className="contents">
                  <span className="border-t border-border py-2 font-medium">{item as string}</span>
                  {(prices as string[]).map((p, i) => (
                    <span
                      key={i}
                      className={`num border-t border-border py-2 text-right ${
                        i === best ? "rounded-md bg-select-bg px-1.5 font-semibold text-success ring-1 ring-select ring-inset" : "text-muted"
                      }`}
                    >
                      {p}
                    </span>
                  ))}
                </div>
              ))}
            </div>
            <div className="hero-panel mt-4 flex items-center justify-between rounded-xl px-4 py-3">
              <span className="text-xs opacity-75">Total cost to you</span>
              <span className="num text-xl font-bold text-hero-num">$24,541</span>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8">
        <p className="eyebrow">How it works</p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight">From work list to signed quote in four steps</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ icon: Icon, title, body }, i) => (
            <div key={title} className="card p-6">
              <div className="flex items-center justify-between">
                <span className="flex size-10 items-center justify-center rounded-[10px] bg-brand-soft text-brand-soft-fg">
                  <Icon className="size-5" />
                </span>
                <span className="num text-sm font-semibold text-subtle">0{i + 1}</span>
              </div>
              <h3 className="mt-5 font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted">{body}</p>
            </div>
          ))}
        </div>

        <div className="hero-panel mt-12 flex flex-wrap items-center justify-between gap-6 rounded-2xl p-8">
          <div className="flex items-start gap-3">
            <EyeOff className="mt-1 size-5 shrink-0 text-hero-num" />
            <div>
              <p className="text-lg font-semibold">Private by design</p>
              <p className="mt-1 max-w-xl text-sm opacity-80">
                Owners see one price per line. Sub-contractor names, their rates and your margin are locked away in the database itself, not
                just hidden on screen.
              </p>
            </div>
          </div>
          <Link href="/signup" className="btn-primary btn-lg">
            <CircleCheck /> Start free
          </Link>
        </div>
      </section>
    </div>
  );
}
