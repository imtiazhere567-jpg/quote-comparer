import { AutoRefresh } from "@/components/auto-refresh";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "BidLevel Home",
  description: "Plan your build, get one clear quote.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/** Homeowner mobile app shell: phone-width column, centred on larger screens. */
export default function MobileLayout({ children }: LayoutProps<"/m">) {
  return (
    <div className="flex min-h-dvh flex-1 justify-center bg-[color-mix(in_srgb,var(--bg)_70%,#000_6%)]">
      <div className="relative flex min-h-dvh w-full max-w-[480px] flex-col bg-background shadow-pop">{children}</div>
      <AutoRefresh />
    </div>
  );
}
