import { AutoRefresh } from "@/components/auto-refresh";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Sub-contractor app · BidLevel",
  description: "Your bid requests, your jobs and your tasks.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

/** Sub-contractor phone app (demo): a mailbox for bid requests plus the jobs list. */
export default function SubLayout({ children }: LayoutProps<"/s">) {
  return (
    <div className="flex min-h-dvh flex-1 justify-center bg-[color-mix(in_srgb,var(--bg)_70%,#000_6%)]">
      <div className="relative flex min-h-dvh w-full max-w-[480px] flex-col bg-background shadow-pop">{children}</div>
      <AutoRefresh />
    </div>
  );
}
