import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { isDemoMode } from "@/lib/supabase/env";
import { MobileSignupForm } from "@/components/mobile/auth-forms";

export default function MobileSignup() {
  return (
    <main className="flex flex-1 flex-col px-5 pt-12 pb-8">
      <Link href="/m/welcome" className="flex size-10 items-center justify-center rounded-full bg-surface ring-1 ring-border" aria-label="Back">
        <ChevronLeft className="size-5" />
      </Link>
      <h1 className="mt-6 text-[28px] leading-tight font-bold tracking-tight">Create your account</h1>
      <p className="mt-1.5 text-[15px] text-muted">Plan your project and get quotes from contractors.</p>

      <div className="mt-7">
        <MobileSignupForm demo={isDemoMode} />
      </div>

      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/m/login" className="font-semibold text-foreground underline decoration-brand decoration-2 underline-offset-4">
          Log in
        </Link>
      </p>
    </main>
  );
}
