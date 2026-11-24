import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { asSystem } from "@/lib/db";
import { isDemoMode } from "@/lib/supabase/env";
import { mobileDemoLogin } from "@/lib/actions/owner";
import type { Profile } from "@/lib/types";
import { Avatar } from "@/components/ui";
import { MobileLoginForm } from "@/components/mobile/auth-forms";

export default function MobileLogin() {
  return (
    <main className="flex flex-1 flex-col px-5 pt-12 pb-8">
      <Link href="/m/welcome" className="flex size-10 items-center justify-center rounded-full bg-surface ring-1 ring-border" aria-label="Back">
        <ChevronLeft className="size-5" />
      </Link>
      <h1 className="mt-6 text-[28px] leading-tight font-bold tracking-tight">Welcome back</h1>
      <p className="mt-1.5 text-[15px] text-muted">Log in to see your projects and quotes.</p>

      <div className="mt-7">
        <MobileLoginForm demo={isDemoMode} />
      </div>

      <p className="mt-6 text-center text-sm text-muted">
        New here?{" "}
        <Link href="/m/signup" className="font-semibold text-foreground underline decoration-brand decoration-2 underline-offset-4">
          Create an account
        </Link>
      </p>

      {isDemoMode && (
        <section className="mt-auto pt-10">
          <p className="eyebrow mb-2.5">Demo accounts · tap to log in</p>
          <Suspense fallback={<div className="h-28 animate-pulse rounded-2xl bg-surface" />}>
            <DemoOwners />
          </Suspense>
        </section>
      )}
    </main>
  );
}

async function DemoOwners() {
  await connection();
  const owners = await asSystem((q) =>
    q<Profile>(`select id, role, full_name, company_name, email from profiles where role = 'owner' order by created_at`),
  );
  return (
    <ul className="space-y-2">
      {owners.map((o) => (
        <li key={o.id}>
          <form action={mobileDemoLogin}>
            <input type="hidden" name="user_id" value={o.id} />
            <button className="flex w-full items-center gap-3 rounded-2xl border border-border bg-surface px-3.5 py-3 text-left active:scale-[0.99]">
              <Avatar name={o.full_name || o.email} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{o.full_name || o.email}</span>
                <span className="block truncate text-xs text-muted">{o.email}</span>
              </span>
              <ChevronRight className="size-4 text-subtle" />
            </button>
          </form>
        </li>
      ))}
    </ul>
  );
}
