import Link from "next/link";
import { ClipboardList, Receipt, Users } from "lucide-react";
import { LogoMark } from "@/components/ui";

/** First screen of the homeowner app: what it does, then Create account / Log in. */
export default function Welcome() {
  const points = [
    { icon: ClipboardList, text: "Describe your project in a few taps" },
    { icon: Users, text: "Get a clear quote from Northline Builders" },
    { icon: Receipt, text: "Compare, accept and track it all here" },
  ];
  return (
    <main className="hero-panel relative flex flex-1 flex-col overflow-hidden px-6 pt-16 pb-8">
      <div className="blueprint pointer-events-none absolute inset-0" />
      <div className="relative flex flex-1 flex-col">
        <LogoMark className="size-12" />
        <h1 className="mt-8 text-[34px] leading-[1.1] font-bold tracking-tight text-white">
          Build your home <span className="text-hero-num">with confidence.</span>
        </h1>
        <p className="mt-3 text-[15px] opacity-80">From a new house to a new kitchen: one simple app to plan it and get it priced.</p>

        <ul className="mt-10 space-y-4">
          {points.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3.5 text-[15px]">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-hero-num">
                <Icon className="size-5" />
              </span>
              {text}
            </li>
          ))}
        </ul>

        <div className="mt-auto space-y-3 pt-10">
          <Link
            href="/m/signup"
            className="flex h-14 w-full items-center justify-center rounded-2xl bg-hero-num text-[16px] font-semibold text-hero transition active:scale-[0.99]"
          >
            Create account
          </Link>
          <Link
            href="/m/login"
            className="flex h-14 w-full items-center justify-center rounded-2xl border border-white/25 text-[16px] font-semibold text-white transition active:scale-[0.99]"
          >
            I already have an account
          </Link>
        </div>
      </div>
    </main>
  );
}
