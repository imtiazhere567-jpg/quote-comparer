import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, ClipboardList, EyeOff, Scale, Send, Sparkles } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { createJob } from "@/lib/actions/jobs";
import { SubmitButton } from "@/components/submit-button";
import { IconTile, PageHeader } from "@/components/ui";

export default function NewJobPage() {
  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1.5 text-[13px] font-medium text-subtle" aria-label="Breadcrumb">
        <Link href="/dashboard" className="text-muted hover:text-foreground">
          Projects
        </Link>
        <ChevronRight className="size-3.5" /> New project
      </nav>
      <Suspense fallback={<div className="card h-[560px] animate-pulse" />}>
        <NewJobForm />
      </Suspense>
    </div>
  );
}

async function NewJobForm() {
  const me = await requireProfile();
  const isOwner = me.role === "owner";
  const settings = await getSettings();

  const steps = isOwner
    ? [
        { icon: ClipboardList, title: "You list the work", body: "Every job with quantities. Start from the standard list and edit it." },
        { icon: Send, title: "Northline Builders gets prices", body: "They send the list to their trades and compare the bids." },
        { icon: Scale, title: "You get one clear quote", body: "Accept it, or ask for changes. Simple." },
      ]
    : [
        { icon: ClipboardList, title: "List the work", body: "Every item with quantities. Sub-contractors price each line." },
        { icon: Send, title: "Send bid links", body: "Each sub-contractor gets a private link. No account needed." },
        { icon: Scale, title: "Compare, award, quote", body: "Pick the best prices, add your markup and send your client one quote." },
      ];

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <form action={createJob} className="card">
        <div className="border-b border-border px-6 py-5">
          <PageHeader title="New project" description="Tell us about the project. You'll add the work items on the next screen." />
        </div>

        <div className="space-y-5 px-6 py-6">
          <div>
            <label htmlFor="title" className="label">
              Project name
            </label>
            <input id="title" name="title" required placeholder="e.g. Oakwood Lane new build" className="input" />
          </div>
          <div>
            <label htmlFor="site_address" className="label">
              Site address
            </label>
            <input id="site_address" name="site_address" placeholder="Street, city" className="input" />
          </div>
          <div>
            <label htmlFor="description" className="label">
              Description <span className="font-normal text-subtle">· optional</span>
            </label>
            <textarea id="description" name="description" rows={3} placeholder="Size, number of rooms, anything bidders should know" className="textarea" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="currency" className="label">
                Currency
              </label>
              <select id="currency" name="currency" className="input" defaultValue={settings.default_currency}>
                <option value="USD">US dollar ($)</option>
                <option value="GBP">British pound (£)</option>
              </select>
            </div>
            <div>
              <label htmlFor="units" className="label">
                Measurements
              </label>
              <select id="units" name="units" className="input" defaultValue={settings.default_units}>
                <option value="imperial">Imperial (sq ft, ft)</option>
                <option value="metric">Metric (m², m)</option>
              </select>
            </div>
          </div>
          {isOwner ? (
            <p className="rounded-xl border border-border bg-surface-2 px-4 py-3 text-[13px] text-muted">
              <span className="font-semibold text-foreground">Northline Builders</span> will prepare your quote.
            </p>
          ) : (
            <div>
              <label htmlFor="other_email" className="label">
                Client&apos;s email <span className="font-normal text-subtle">· optional</span>
              </label>
              <input id="other_email" name="other_email" type="email" className="input" />
              <p className="mt-1.5 text-xs text-muted">Your client sees the project and your final quote when they log in with this email.</p>
            </div>
          )}

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface-2 p-4 transition has-[:checked]:border-select has-[:checked]:bg-select-bg">
            <input type="checkbox" name="template" defaultChecked className="mt-1 size-4 accent-[var(--select-dot)]" />
            <span className="flex-1">
              <span className="flex items-center gap-1.5 text-sm font-semibold">
                <Sparkles className="size-4" /> Start with a standard new-build work list
              </span>
              <span className="mt-0.5 block text-[13px] text-muted">19 common items from site prep to finishes. Edit or delete any of them.</span>
            </span>
          </label>
        </div>

        <div className="flex justify-end gap-2.5 border-t border-border bg-surface-2 px-6 py-4">
          <Link href="/dashboard" className="btn-secondary">
            Cancel
          </Link>
          <SubmitButton pendingText="Creating…">Create project</SubmitButton>
        </div>
      </form>

      <aside className="space-y-4">
        <div className="card p-5">
          <p className="eyebrow mb-4">How it works</p>
          <ol className="space-y-5">
            {steps.map((s, i) => (
              <li key={s.title} className="flex gap-3.5">
                <IconTile icon={s.icon} tone={i === 0 ? "brand" : "neutral"} />
                <div>
                  <p className="text-sm font-semibold">
                    {i + 1}. {s.title}
                  </p>
                  <p className="mt-0.5 text-[13px] text-muted">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className="hero-panel flex gap-3 rounded-[14px] p-5 text-sm">
          <EyeOff className="mt-0.5 size-4 shrink-0 text-hero-num" />
          <p>
            <span className="font-semibold text-hero-num">Private by design.</span>{" "}
            {isOwner ? "You see one final price per line." : "Clients never see your sub-contractors or their rates."}
          </p>
        </div>
      </aside>
    </div>
  );
}
