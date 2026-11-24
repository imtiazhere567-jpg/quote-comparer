import { BrandLogo } from "@/components/brand-logo";
import Link from "next/link";
import { CircleCheck, Inbox, ListChecks, Send, Smartphone } from "lucide-react";
import { Phone } from "../phone";
import { SimulatorSwitcher } from "../switcher";

export const metadata = { title: "BidLevel · Sub-contractor app simulator" };

const steps = [
  { icon: Smartphone, title: "Open a sub-contractor's phone", body: "Pick Mike, Priya, Dan or Grace. Each has their own inbox." },
  { icon: Inbox, title: "Email: bid request", body: "When Northline sends a bid request, an email arrives with a private link." },
  { icon: Send, title: "Send your prices", body: "Open the link, enter a rate for every item and tap “Send my bid”. Northline gets a notification right away." },
  { icon: CircleCheck, title: "Email: you got the job", body: "Only after the homeowner accepts the quote, the chosen sub-contractors get their task list." },
  { icon: ListChecks, title: "Track the work", body: "Tap Start and Mark done on each task. Northline sees the progress live on the Progress tab." },
];

export default function SubSimulatorPage() {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-ink text-ink-fg">
      <div className="blueprint pointer-events-none absolute inset-0" />
      <div className="relative mx-auto grid min-h-dvh max-w-6xl items-center gap-12 px-6 py-6 lg:grid-cols-[1fr_auto]">
        <div className="max-w-md">
          <Link href="/">
            <BrandLogo tone="light" />
          </Link>
          <div className="mt-8">
            <SimulatorSwitcher active="sub" />
          </div>
          <h1 className="mt-6 text-[40px] leading-[1.08] font-bold tracking-tight text-white">The sub-contractor app</h1>
          <p className="mt-3 text-base text-ink-muted">How trades receive bid requests, send prices and track their tasks. Everything is real and saved.</p>
          <ol className="mt-8 space-y-5">
            {steps.map(({ icon: Icon, title, body }, n) => (
              <li key={title} className="flex gap-3.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-ink-2 text-ink-accent ring-1 ring-ink-border">
                  <Icon className="size-[18px]" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">
                    {n + 1}. {title}
                  </p>
                  <p className="mt-0.5 text-[13px] text-ink-muted">{body}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-8">
            <Link href="/login" className="btn border border-ink-border text-ink-fg hover:bg-ink-hover">
              Open Northline web app
            </Link>
          </div>
        </div>
        <Phone src="/s" title="Sub-contractor app" />
      </div>
    </div>
  );
}
