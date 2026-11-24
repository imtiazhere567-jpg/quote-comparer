import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { ArrowRight } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "@/components/auth-forms";
import { isDemoMode } from "@/lib/supabase/env";
import { asSystem } from "@/lib/db";
import { demoLogin } from "@/app/demo-actions";
import { ROLE_LABEL, type Profile } from "@/lib/types";
import { Avatar, Badge } from "@/components/ui";

export default function LoginPage() {
  return (
    <AuthShell
      title={isDemoMode ? "Choose a demo user" : "Welcome back"}
      subtitle={isDemoMode ? "The web dashboard is for the builder's team. Homeowners use the phone app." : "Log in to your account."}
    >
      <Suspense fallback={<div className="h-56 animate-pulse rounded-xl bg-surface" />}>
        {isDemoMode ? <DemoUsers /> : <LoginForm />}
      </Suspense>
    </AuthShell>
  );
}

async function DemoUsers() {
  await connection(); // read the database per request, never at build time
  const users = await asSystem((q) =>
    q<Profile>(`select id, role, full_name, company_name, email from profiles where role = 'contractor' order by created_at`),
  );
  return (
    <div className="space-y-5">
      <ul className="space-y-2.5">
        {users.map((u) => (
          <li key={u.id}>
            <form action={demoLogin}>
              <input type="hidden" name="user_id" value={u.id} />
              <button className="card group flex w-full items-center gap-3.5 p-3.5 text-left transition hover:border-select hover:shadow-[0_0_0_3px_var(--select-ring)]">
                <Avatar name={u.full_name || u.email} size="lg" />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{u.full_name || u.email}</span>
                  <span className="block truncate text-[13px] text-muted">{u.company_name ?? u.email}</span>
                </span>
                <Badge tone={u.role === "contractor" ? "brand" : "neutral"} dot={false}>
                  {ROLE_LABEL[u.role]}
                </Badge>
                <ArrowRight className="size-4 text-subtle transition group-hover:translate-x-0.5 group-hover:text-foreground" />
              </button>
            </form>
          </li>
        ))}
      </ul>
      <div className="rounded-[12px] border border-dashed border-border-strong bg-surface-2 p-4 text-sm">
        <p className="font-semibold">Are you a homeowner?</p>
        <p className="mt-0.5 text-muted">Homeowners create projects, review quotes and pay invoices in the phone app.</p>
        <Link href="/simulator" className="btn-secondary mt-3">
          Open the homeowner app <ArrowRight />
        </Link>
      </div>
    </div>
  );
}
