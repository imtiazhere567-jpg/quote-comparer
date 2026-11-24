import { Suspense } from "react";
import { getSettings } from "@/lib/settings";
import { Logo } from "./ui";

async function Named({ tone }: { tone: "dark" | "light" }) {
  return <Logo tone={tone} name={(await getSettings()).app_name} />;
}

/** The logo with the app name from Settings (shows the default name while it loads). */
export function BrandLogo({ tone = "dark" }: { tone?: "dark" | "light" }) {
  return (
    <Suspense fallback={<Logo tone={tone} />}>
      <Named tone={tone} />
    </Suspense>
  );
}
