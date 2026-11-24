import { Suspense } from "react";
import { LogoMark } from "@/components/ui";
import { GateForm } from "./gate-form";

export const metadata = { title: "Private preview" };

/** Shared-password screen in front of the whole site (only when SITE_PASSWORD is set). */
export default function GatePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-ink px-4">
      <div className="card w-full max-w-sm p-7">
        <LogoMark className="size-10" />
        <h1 className="mt-5 text-xl font-bold tracking-tight">Private preview</h1>
        <p className="mt-1 mb-5 text-sm text-muted">Enter the password you were given to open the demo.</p>
        <Suspense>
          <GateForm />
        </Suspense>
      </div>
    </main>
  );
}
