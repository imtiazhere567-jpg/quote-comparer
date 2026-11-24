import { BrandLogo } from "@/components/brand-logo";
import Link from "next/link";
import { Suspense } from "react";
import { CircleCheck, ClipboardList, House, Receipt, Send } from "lucide-react";
import { OpenPhone, Phone } from "./phone";
import { SimulatorSwitcher } from "./switcher";

export const metadata = { title: "BidLevel · Homeowner app simulator" };

const steps = [
  { icon: House, title: "Create an account or log in", body: "New homeowners tap Create account. Or log in with a demo account: Olivia or Sam." },
  { icon: ClipboardList, title: "Start a new project", body: "Tap the big card or the + button. 7 short questions: type, address, size, what's included (add your own too), finish, timing and budget." },
  { icon: CircleCheck, title: "Create it", body: "The app builds a work list from the answers, with quantities worked out from the floor area." },
  { icon: Send, title: "Northline Builders gets it", body: "Every project goes straight to Northline Builders. Open the contractor web app (Chris) to carry on from their side." },
  { icon: Receipt, title: "Review the quote", body: "Accept it, ask for changes or reject it, with a note. When the work is done, the invoice arrives here to pay." },
];

export default function SimulatorPage() {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-ink text-ink-fg">
      <div className="blueprint pointer-events-none absolute inset-0" />
      <div className="relative mx-auto grid min-h-dvh max-w-6xl items-center gap-12 px-6 py-6 lg:grid-cols-[1fr_auto]">
        <div className="max-w-md">
          <Link href="/">
            <BrandLogo tone="light" />
          </Link>
          <div className="mt-8">
            <SimulatorSwitcher active="owner" />
          </div>
          <h1 className="mt-6 text-[40px] leading-[1.08] font-bold tracking-tight text-white">The homeowner app</h1>
          <p className="mt-3 text-base text-ink-muted">
            This is how homeowners will use BidLevel on their phone. Everything you do in the phone is real and saved to the same database as the
            contractor&apos;s web app.
          </p>

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

          <div className="mt-8 flex flex-wrap gap-2.5">
            <Link href="/login" className="btn border border-ink-border text-ink-fg hover:bg-ink-hover">
              Open contractor web app
            </Link>
          </div>
        </div>

        <Suspense fallback={<Phone />}>
          <OpenPhone />
        </Suspense>
      </div>
    </div>
  );
}
