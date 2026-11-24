"use client";

import { useActionState } from "react";
import { LoaderCircle } from "lucide-react";
import { mobileLogin, mobileSignup, type MobileAuthState } from "@/lib/actions/owner";

const inputCls =
  "h-13 w-full rounded-2xl border border-border-strong bg-surface px-4 text-[16px] outline-none transition focus:border-select focus:ring-4 focus:ring-select-ring";

function Message({ state }: { state: MobileAuthState }) {
  if (state?.error)
    return (
      <p role="alert" className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-[13px] text-danger">
        {state.error}
      </p>
    );
  if (state?.message)
    return (
      <p role="status" className="rounded-xl bg-success-soft px-3.5 py-2.5 text-[13px] text-success">
        {state.message}
      </p>
    );
  return null;
}

function Submit({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-hero text-[16px] font-semibold text-hero-num transition active:scale-[0.99] disabled:opacity-60"
    >
      {pending && <LoaderCircle className="size-5 animate-spin" />}
      {children}
    </button>
  );
}

export function MobileLoginForm({ demo }: { demo: boolean }) {
  const [state, action, pending] = useActionState(mobileLogin, undefined);
  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-semibold">Email</span>
        <input name="email" type="email" inputMode="email" autoComplete="email" required className={inputCls} placeholder="you@example.com" />
      </label>
      {!demo && (
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold">Password</span>
          <input name="password" type="password" autoComplete="current-password" required className={inputCls} />
        </label>
      )}
      <Message state={state} />
      <Submit pending={pending}>{pending ? "Logging in…" : "Log in"}</Submit>
    </form>
  );
}

export function MobileSignupForm({ demo }: { demo: boolean }) {
  const [state, action, pending] = useActionState(mobileSignup, undefined);
  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-semibold">Your name</span>
        <input name="full_name" autoComplete="name" required className={inputCls} placeholder="e.g. Olivia Bennett" />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-semibold">Email</span>
        <input name="email" type="email" inputMode="email" autoComplete="email" required className={inputCls} placeholder="you@example.com" />
      </label>
      {!demo && (
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold">Password</span>
          <input name="password" type="password" autoComplete="new-password" minLength={8} required className={inputCls} />
          <span className="mt-1 block text-xs text-muted">At least 8 characters.</span>
        </label>
      )}
      <Message state={state} />
      <Submit pending={pending}>{pending ? "Creating your account…" : "Create account"}</Submit>
      <p className="text-center text-xs text-subtle">Free for homeowners. No card needed.</p>
    </form>
  );
}
