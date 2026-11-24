import { UserPlus } from "lucide-react";
import { addSubcontractor } from "@/lib/actions/jobs";
import { SubmitButton } from "@/components/submit-button";

export function SubcontractorForm({ open = false }: { open?: boolean }) {
  return (
    <details className="card group" open={open}>
      <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-4 font-semibold tracking-tight">
        <span className="flex size-7 items-center justify-center rounded-md bg-surface-2 text-muted ring-1 ring-border">
          <UserPlus className="size-4" />
        </span>
        Add a sub-contractor
        <span className="ml-auto text-xs font-normal text-muted group-open:hidden">Open</span>
      </summary>
      <form action={addSubcontractor} className="space-y-3 border-t border-border p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Name</label>
            <input name="name" required className="input" />
          </div>
          <div>
            <label className="label">Company</label>
            <input name="company_name" className="input" />
          </div>
          <div>
            <label className="label">Email</label>
            <input name="email" type="email" className="input" />
          </div>
          <div>
            <label className="label">Phone</label>
            <input name="phone" type="tel" className="input" />
          </div>
        </div>
        <div>
          <label className="label">Trades</label>
          <input name="trades" placeholder="Plumbing, HVAC" className="input" />
          <p className="mt-1 text-xs text-muted">Separate with commas.</p>
        </div>
        <SubmitButton variant="ghost" className="w-full">Save sub-contractor</SubmitButton>
      </form>
    </details>
  );
}
