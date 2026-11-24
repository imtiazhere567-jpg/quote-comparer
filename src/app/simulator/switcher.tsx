import Link from "next/link";
import { HardHat, House } from "lucide-react";

/** Toggle between the two phone apps on the simulator pages. */
export function SimulatorSwitcher({ active }: { active: "owner" | "sub" }) {
  const tab = (href: string, label: string, Icon: typeof House, on: boolean) => (
    <Link
      href={href}
      aria-current={on ? "page" : undefined}
      className={`flex h-10 items-center gap-2 rounded-lg px-3.5 text-sm font-semibold transition ${on ? "bg-ink-accent text-ink" : "text-ink-muted hover:bg-ink-hover hover:text-ink-fg"}`}
    >
      <Icon className="size-4" /> {label}
    </Link>
  );
  return (
    <nav className="inline-flex gap-1 rounded-xl bg-ink-2 p-1 ring-1 ring-ink-border" aria-label="Choose app">
      {tab("/simulator", "Homeowner app", House, active === "owner")}
      {tab("/simulator/sub", "Sub-contractor app", HardHat, active === "sub")}
    </nav>
  );
}
