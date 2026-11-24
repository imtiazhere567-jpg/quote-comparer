"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { login, signup, type AuthState } from "@/app/auth-actions";
import { demoSignup } from "@/app/demo-actions";

function FormMessage({ state }: { state: AuthState }) {
  if (state?.error)
    return (
      <p role="alert" className="rounded-[10px] border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] text-danger">
        {state.error}
      </p>
    );
  if (state?.message)
    return (
      <p role="status" className="rounded-[10px] border border-success-line bg-success-soft px-3 py-2 text-[13px] text-success">
        {state.message}
      </p>
    );
  return null;
}

export function LoginForm() {
  const params = useSearchParams();
  const [state, action, pending] = useActionState(login, undefined);
  const confirmError = params.get("error") === "confirm";

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={params.get("next") ?? ""} />
      <div>
        <label htmlFor="email" className="label">
          Email
        </label>
        <input id="email" name="email" type="email" autoComplete="email" required className="input" />
      </div>
      <div>
        <label htmlFor="password" className="label">
          Password
        </label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
      </div>
      {confirmError && !state && <FormMessage state={{ error: "That confirmation link didn't work. Try logging in." }} />}
      <FormMessage state={state} />
      <button type="submit" disabled={pending} className="btn-primary btn-lg w-full">
        {pending && <LoaderCircle className="animate-spin" />}
        {pending ? "Logging in…" : "Log in"}
      </button>
      <p className="text-center text-sm text-muted">
        New here?{" "}
        <Link href="/signup" className="link">
          Create an account
        </Link>
      </p>
    </form>
  );
}


export function SignupForm({ demo = false }: { demo?: boolean }) {
  const [state, action, pending] = useActionState(demo ? demoSignup : signup, undefined);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="role" value="owner" />
      <div>
        <label htmlFor="full_name" className="label">
          Your name
        </label>
        <input id="full_name" name="full_name" autoComplete="name" required className="input" />
      </div>
      <div>
        <label htmlFor="email" className="label">
          Email
        </label>
        <input id="email" name="email" type="email" autoComplete="email" required className="input" />
      </div>
      {!demo && (
        <div>
          <label htmlFor="password" className="label">
            Password
          </label>
          <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required className="input" />
          <p className="mt-1 text-xs text-subtle">At least 8 characters.</p>
        </div>
      )}
      <FormMessage state={state} />
      <button type="submit" disabled={pending} className="btn-primary btn-lg w-full">
        {pending && <LoaderCircle className="animate-spin" />}
        {pending ? "Creating account…" : "Create account"}
      </button>
      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="link">
          Log in
        </Link>
      </p>
    </form>
  );
}
