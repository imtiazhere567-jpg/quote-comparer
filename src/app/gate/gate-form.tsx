"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { LoaderCircle, LockKeyhole } from "lucide-react";
import { enterSite } from "./actions";

export function GateForm() {
  const [state, action, pending] = useActionState(enterSite, undefined);
  const next = useSearchParams().get("next") ?? "/";
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <label className="block">
        <span className="label">Password</span>
        <input name="password" type="password" required autoFocus autoComplete="current-password" className="input mt-1.5 w-full" />
      </label>
      {state?.error && <p className="text-sm font-medium text-danger">{state.error}</p>}
      <button disabled={pending} className="btn-primary w-full justify-center">
        {pending ? <LoaderCircle className="animate-spin" /> : <LockKeyhole />} Enter
      </button>
    </form>
  );
}
