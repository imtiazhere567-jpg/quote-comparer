import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ClipboardList, Lock, Plus, Settings2, Sparkles } from "lucide-react";
import { withProfile } from "@/lib/auth";
import { getJob, getScope } from "@/lib/queries";
import { STAGES, UNITS } from "@/lib/scope-templates";
import type { Job } from "@/lib/types";
import { addScopeItem, addTemplateItems, updateJobDetails } from "@/lib/actions/jobs";
import { ItemFields, WorkListView } from "./work-list-view";
import { SubmitButton } from "@/components/submit-button";
import { Callout, Empty } from "@/components/ui";

export default function WorkListPage({ params }: PageProps<"/jobs/[id]">) {
  return (
    <Suspense fallback={<div className="card h-96 animate-pulse" />}>
      <WorkList params={params} />
    </Suspense>
  );
}

async function WorkList({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await withProfile(async (q, me) => {
    const job = await getJob(q, id);
    if (!job) return null;
    return { me, job, scope: await getScope(q, id) };
  });
  if (!data) notFound();
  const { me, job, scope } = data;

  const isContractor = me.id === job.contractor_id;
  const sent = Boolean(job.details?.submitted_at);
  const canEdit = isContractor ? ["draft", "bidding", "awarding"].includes(job.status) : job.status === "draft" && !sent;
  const canEditDetails = isContractor || job.status === "draft";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-4">
        {!canEdit && (
          <Callout tone="info">
            <span className="inline-flex items-center gap-1.5">
              <Lock className="size-3.5" />
              {isContractor
                ? "The quote has been sent, so the work list is locked."
                : "You sent this list to Northline Builders, so it is locked. Ask them if something needs to change."}
            </span>
          </Callout>
        )}
        {canEdit && isContractor && job.status !== "draft" && (
          <Callout tone="warning">Bids are already out. If you change a line, ask the sub-contractors to re-check their price for it.</Callout>
        )}

        {scope.length === 0 ? (
          <Empty
            icon={ClipboardList}
            title="No work items yet"
            action={
              canEdit ? (
                <form action={addTemplateItems}>
                  <input type="hidden" name="job_id" value={job.id} />
                  <SubmitButton variant="ghost" pendingText="Adding…">
                    <Sparkles /> Add standard new-build items
                  </SubmitButton>
                </form>
              ) : null
            }
          >
            List everything that needs doing with quantities. Sub-contractors will price each line.
          </Empty>
        ) : (
          <WorkListView items={scope} canEdit={canEdit} units={UNITS[job.units]} />
        )}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        {canEdit && (
          <form id="add-item" action={addScopeItem} className="card scroll-mt-24 p-5" data-step-target>
            <h2 className="mb-4 flex items-center gap-2 font-semibold tracking-tight">
              <span className="flex size-7 items-center justify-center rounded-md bg-brand-soft text-brand-soft-fg">
                <Plus className="size-4" />
              </span>
              Add an item
            </h2>
            <input type="hidden" name="job_id" value={job.id} />
            <ItemFields units={UNITS[job.units]} stacked />
            <SubmitButton className="mt-4 w-full" pendingText="Adding…">
              <Plus /> Add to work list
            </SubmitButton>
          </form>
        )}
        {canEditDetails && <JobDetails job={job} isContractor={isContractor} />}
      </aside>

      <datalist id="stages">
        {STAGES.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </div>
  );
}

function JobDetails({ job, isContractor }: { job: Job; isContractor: boolean }) {
  const otherJoined = isContractor ? job.owner_id : job.contractor_id;
  const otherEmail = isContractor ? job.owner_email : job.contractor_email;
  return (
    <details className="card group">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-4 font-semibold tracking-tight">
        <span className="flex size-7 items-center justify-center rounded-md bg-surface-2 text-muted ring-1 ring-border">
          <Settings2 className="size-4" />
        </span>
        Project details
        <span className="ml-auto text-xs font-normal text-muted group-open:hidden">Edit</span>
      </summary>
      <form action={updateJobDetails} className="space-y-3 border-t border-border p-5">
        <input type="hidden" name="job_id" value={job.id} />
        <div>
          <label className="label">Project name</label>
          <input name="title" defaultValue={job.title} required className="input" />
        </div>
        <div>
          <label className="label">Site address</label>
          <input name="site_address" defaultValue={job.site_address ?? ""} className="input" />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea name="description" rows={3} defaultValue={job.description ?? ""} className="textarea" />
        </div>
        {!otherJoined && (
          <div>
            <label className="label">{isContractor ? "Client's email" : "Contractor's email"}</label>
            <input name="other_email" type="email" defaultValue={otherEmail ?? ""} className="input" />
          </div>
        )}
        <SubmitButton variant="ghost" className="w-full">Save details</SubmitButton>
      </form>
    </details>
  );
}
