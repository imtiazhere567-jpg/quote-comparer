import { Suspense } from "react";
import { LogOut, Mail, ShieldCheck } from "lucide-react";
import { requireOwner } from "@/lib/mobile-auth";
import { mobileSignOut } from "@/lib/actions/owner";
import { TabBar } from "@/components/mobile/tab-bar";
import { SubmitButton } from "@/components/submit-button";

export default function AccountPage() {
  return (
    <>
      <main className="flex-1 px-5 pt-12 pb-6">
        <h1 className="text-[26px] font-bold tracking-tight">Account</h1>
        <Suspense fallback={<div className="mt-6 h-40 animate-pulse rounded-2xl bg-surface" />}>
          <Account />
        </Suspense>
      </main>
      <Suspense fallback={<div className="h-20 border-t border-border bg-surface" />}>
        <TabBar />
      </Suspense>
    </>
  );
}

async function Account() {
  const me = await requireOwner();
  const name = me.full_name || me.email;
  return (
    <div className="mt-6 space-y-4">
      <div className="card flex items-center gap-4 p-5">
        <span className="flex size-14 items-center justify-center rounded-full bg-hero text-lg font-bold text-hero-num">{name[0]?.toUpperCase()}</span>
        <div className="min-w-0">
          <p className="text-lg font-semibold">{name}</p>
          <p className="flex items-center gap-1.5 truncate text-sm text-muted">
            <Mail className="size-3.5" /> {me.email}
          </p>
        </div>
      </div>

      <div className="card flex items-start gap-3 p-4 text-sm">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-success" />
        <p className="text-muted">Your details and budget are only shared with the contractor you choose.</p>
      </div>

      <form action={mobileSignOut} className="pt-4">
        <SubmitButton variant="danger" className="h-13 w-full rounded-2xl text-[15px]" pendingText="Logging out…">
          <LogOut /> Log out
        </SubmitButton>
      </form>
    </div>
  );
}
