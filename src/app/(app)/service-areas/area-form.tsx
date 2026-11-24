"use client";

import { useActionState, useRef, useState } from "react";
import { LoaderCircle, Plus } from "lucide-react";
import { addServiceArea } from "@/lib/actions/areas";

export function AreaForm() {
  const [state, action, pending] = useActionState(addServiceArea, undefined);
  const [country, setCountry] = useState<"US" | "UK">("US");
  const form = useRef<HTMLFormElement>(null);
  const uk = country === "UK";

  return (
    <form
      ref={form}
      action={async (fd) => {
        await action(fd);
      }}
      className="card space-y-4 p-5"
    >
      <div>
        <h2 className="font-semibold">Add a service area</h2>
        <p className="text-[13px] text-muted">Homeowners in this city can create projects straight away.</p>
      </div>
      <input type="hidden" name="country" value={country} />
      <div className="grid grid-cols-2 gap-1.5 rounded-[10px] bg-surface-2 p-1 ring-1 ring-border">
        {(["US", "UK"] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCountry(c)}
            aria-pressed={country === c}
            className={`h-9 rounded-lg text-sm font-semibold ${country === c ? "bg-surface shadow-card" : "text-muted"}`}
          >
            {c === "US" ? "United States" : "United Kingdom"}
          </button>
        ))}
      </div>
      <label className="block">
        <span className="label">{uk ? "Town / city" : "City"}</span>
        <input name="city" required className="input mt-1.5 w-full" placeholder={uk ? "e.g. Bristol" : "e.g. San Marcos"} />
      </label>
      <label className="block">
        <span className="label">{uk ? "County" : "State"} · optional</span>
        <input name="region" className="input mt-1.5 w-full" placeholder={uk ? "e.g. Somerset" : "e.g. TX"} />
      </label>
      <label className="block">
        <span className="label">{uk ? "Postcode areas" : "ZIP code prefixes"} · optional</span>
        <input name="prefixes" className="input mt-1.5 w-full" placeholder={uk ? "e.g. BS" : "e.g. 786, 787"} />
        <span className="mt-1 block text-xs text-subtle">
          {uk ? "Only postcodes starting with these are accepted. Leave empty to accept any postcode in this town." : "Only ZIP codes starting with these are accepted. Leave empty to accept any ZIP in this city."}
        </span>
      </label>
      {state?.error && <p className="text-sm font-medium text-danger">{state.error}</p>}
      {state?.ok && <p className="text-sm font-medium text-success">{state.ok}</p>}
      <button disabled={pending} className="btn-primary w-full justify-center">
        {pending ? <LoaderCircle className="animate-spin" /> : <Plus />} Add area
      </button>
    </form>
  );
}
