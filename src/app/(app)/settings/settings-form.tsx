"use client";

import { useActionState, useState, type ReactNode } from "react";
import { Building2, CircleCheck, FileText, Hammer, LoaderCircle, Percent, Save, Star } from "lucide-react";
import { saveSettings } from "@/lib/actions/settings";
import { FilterSelect } from "@/components/filter-select";

export type SettingsValues = {
  app_name: string;
  company_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  default_markup: number;
  default_currency: string;
  default_units: string;
  bid_days: number;
  invoice_due_days: number;
  invoice_note: string | null;
  quote_message: string | null;
  rating_threshold: number;
};

function Section({ icon: Icon, title, hint, children }: { icon: typeof Building2; title: string; hint: string; children: ReactNode }) {
  return (
    <section className="card grid gap-6 p-6 md:grid-cols-[240px_minmax(0,1fr)]">
      <div>
        <span className="flex size-9 items-center justify-center rounded-[10px] bg-brand-soft text-brand-soft-fg">
          <Icon className="size-4" />
        </span>
        <h2 className="mt-3 font-semibold">{title}</h2>
        <p className="mt-1 text-[13px] text-muted">{hint}</p>
      </div>
      <div className="grid content-start gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({ label, hint, wide, children }: { label: string; hint?: string; wide?: boolean; children: ReactNode }) {
  return (
    <label className={`block ${wide ? "sm:col-span-2" : ""}`}>
      <span className="label">{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint && <span className="mt-1 block text-xs text-subtle">{hint}</span>}
    </label>
  );
}

export function SettingsForm({ initial }: { initial: SettingsValues }) {
  const [state, action, pending] = useActionState(saveSettings, undefined);
  const [currency, setCurrency] = useState(initial.default_currency);
  const [units, setUnits] = useState(initial.default_units);
  const [threshold, setThreshold] = useState(String(initial.rating_threshold));
  const [markup, setMarkup] = useState(String(initial.default_markup));

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="default_currency" value={currency} />
      <input type="hidden" name="default_units" value={units} />
      <input type="hidden" name="rating_threshold" value={threshold} />

      <Section icon={Building2} title="Company" hint="Shown to homeowners and sub-contractors in the apps, emails, quotes and invoices.">
        <Field label="Company name">
          <input name="company_name" required defaultValue={initial.company_name} className="input w-full" />
        </Field>
        <Field label="App name" hint="The product name on the log-in page and menus.">
          <input name="app_name" required defaultValue={initial.app_name} className="input w-full" />
        </Field>
        <Field label="Contact email" hint="Shown to homeowners on their project.">
          <input name="contact_email" type="email" defaultValue={initial.contact_email ?? ""} className="input w-full" />
        </Field>
        <Field label="Contact phone">
          <input name="contact_phone" defaultValue={initial.contact_phone ?? ""} className="input w-full" />
        </Field>
      </Section>

      <Section icon={Percent} title="Pricing & quotes" hint="Defaults for new quotes. You can still change them on each project.">
        <Field label="Default margin" hint="Added on top of the sub-contractors' prices.">
          <div className="relative">
            <input
              name="default_markup"
              inputMode="decimal"
              value={markup}
              onChange={(e) => setMarkup(e.target.value)}
              className="input num w-full pr-9"
            />
            <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted">%</span>
          </div>
          <div className="mt-2 flex gap-1.5">
            {[10, 15, 20, 25].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMarkup(String(m))}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${Number(markup) === m ? "bg-hero text-hero-num" : "bg-surface-2 text-muted ring-1 ring-border"}`}
              >
                {m}%
              </button>
            ))}
          </div>
        </Field>
        <div className="grid content-start gap-4">
          <div>
            <span className="label">Currency for new projects</span>
            <div className="mt-1.5">
              <FilterSelect
                label="Currency"
                value={currency}
                onChange={setCurrency}
                options={[
                  { value: "USD", label: "US dollar ($)" },
                  { value: "GBP", label: "British pound (£)" },
                ]}
              />
            </div>
          </div>
          <div>
            <span className="label">Units</span>
            <div className="mt-1.5">
              <FilterSelect
                label="Units"
                value={units}
                onChange={setUnits}
                options={[
                  { value: "imperial", label: "Imperial (sq ft)" },
                  { value: "metric", label: "Metric (m²)" },
                ]}
              />
            </div>
          </div>
        </div>
        <Field label="Default message on quotes" wide>
          <textarea name="quote_message" rows={2} defaultValue={initial.quote_message ?? ""} className="textarea w-full" />
        </Field>
      </Section>

      <Section icon={Hammer} title="Sub-contractors" hint="How long bid links stay open.">
        <Field label="Bid deadline" hint="Days a sub-contractor has to send prices.">
          <div className="relative">
            <input name="bid_days" inputMode="numeric" defaultValue={initial.bid_days} className="input num w-full pr-14" />
            <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted">days</span>
          </div>
        </Field>
      </Section>

      <Section icon={FileText} title="Invoices" hint="Used when you send the client their final invoice.">
        <Field label="Payment terms" hint="Days the client has to pay.">
          <div className="relative">
            <input name="invoice_due_days" inputMode="numeric" defaultValue={initial.invoice_due_days} className="input num w-full pr-14" />
            <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted">days</span>
          </div>
        </Field>
        <Field label="Default note on invoices" wide>
          <textarea name="invoice_note" rows={2} defaultValue={initial.invoice_note ?? ""} className="textarea w-full" />
        </Field>
      </Section>

      <Section icon={Star} title="Client feedback" hint="After paying, clients rate each part of the work.">
        <div className="sm:col-span-2">
          <span className="label">Approve automatically from</span>
          <div className="mt-1.5 flex flex-wrap items-center gap-3">
            <FilterSelect
              label="Approve at"
              value={threshold}
              onChange={setThreshold}
              options={[5, 4, 3, 2].map((n) => ({ value: String(n), label: `${n}★ and up` }))}
            />
            <span className="text-[13px] text-muted">Below {threshold}★ the client must give a reason, and you get an alert.</span>
          </div>
        </div>
      </Section>

      <div className="sticky bottom-4 z-10 flex items-center justify-end gap-3 rounded-[14px] border border-border bg-surface/95 px-5 py-3 shadow-pop backdrop-blur">
        {state?.error && <p className="mr-auto text-sm font-medium text-danger">{state.error}</p>}
        {state?.ok && (
          <p className="mr-auto flex items-center gap-1.5 text-sm font-medium text-success">
            <CircleCheck className="size-4" /> {state.ok}
          </p>
        )}
        <button disabled={pending} className="btn-primary">
          {pending ? <LoaderCircle className="animate-spin" /> : <Save />} Save settings
        </button>
      </div>
    </form>
  );
}
