import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CircleCheck, CircleDashed, Clock, LoaderCircle, Activity } from "lucide-react";
import { withProfile } from "@/lib/auth";
import { getJob } from "@/lib/queries";
import { qty, shortDate } from "@/lib/format";
import { Avatar, Badge, Empty } from "@/components/ui";

export default function ProgressPage({ params }: PageProps<"/jobs/[id]/progress">) {
  return (
    <Suspense fallback={<div className="card h-96 animate-pulse" />}>
      <Progress params={params} />
    </Suspense>
  );
}

type TaskRow = {
  id: string;
  stage: string;
  description: string;
  quantity: number;
  unit: string;
  status: "not_started" | "in_progress" | "done";
  started_at: string | null;
  done_at: string | null;
  sub_name: string | null;
  sub_company: string | null;
};

const STATUS = {
  not_started: { label: "Not started", tone: "neutral" as const, icon: CircleDashed },
  in_progress: { label: "In progress", tone: "info" as const, icon: LoaderCircle },
  done: { label: "Done", tone: "success" as const, icon: CircleCheck },
};

async function Progress({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await withProfile(async (q, me) => {
    const job = await getJob(q, id);
    if (!job) return null;
    const isContractor = job.contractor_id === me.id;
    // Owners can't read bid_invites/subcontractors (RLS), so names come back null for them.
    const tasks = await q<TaskRow>(
      `select t.id, t.stage, t.description, t.quantity::float8 as quantity, t.unit, t.status, t.started_at, t.done_at,
              s.name as sub_name, s.company_name as sub_company
         from work_tasks t
         left join bid_invites i on i.id = t.invite_id
         left join subcontractors s on s.id = i.subcontractor_id
        where t.job_id = $1
        order by t.sort_order`,
      [id],
    );
    const feed = isContractor
      ? await q<{ actor_label: string | null; action: string; created_at: string; description: string | null }>(
          `select a.actor_label, a.action, a.created_at, t.description
             from audit_log a left join work_tasks t on t.id = (a.details->>'task_id')::uuid
            where a.job_id = $1 and (a.action like 'task_%' or a.action in ('owner_quote_accepted'))
            order by a.created_at desc limit 12`,
          [id],
        )
      : [];
    return { job, isContractor, tasks, feed };
  });
  if (!data) notFound();
  const { isContractor, tasks, feed } = data;

  if (tasks.length === 0) {
    return (
      <Empty icon={Clock} title="No work assigned yet">
        Tasks appear here once the client accepts the quote and the work is handed out.
      </Empty>
    );
  }

  const done = tasks.filter((t) => t.status === "done").length;
  const active = tasks.filter((t) => t.status === "in_progress").length;
  const pct = Math.round((done / tasks.length) * 100);
  const groups = isContractor
    ? [...new Set(tasks.map((t) => t.sub_name ?? "Sub-contractor"))].map((name) => ({ name, tasks: tasks.filter((t) => (t.sub_name ?? "Sub-contractor") === name) }))
    : [...new Set(tasks.map((t) => t.stage))].map((name) => ({ name, tasks: tasks.filter((t) => t.stage === name) }));

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-5">
        {/* overall */}
        <div className="hero-panel relative overflow-hidden rounded-[14px] px-5 py-5">
          <span className="absolute inset-y-0 left-0 w-1 bg-hero-num" />
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs opacity-75">Overall progress</p>
              <p className="num text-[32px] leading-tight font-bold text-hero-num">{pct}%</p>
              <p className="text-sm opacity-80">
                {done} of {tasks.length} tasks done · {active} in progress
              </p>
            </div>
          </div>
          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-hero-num transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {groups.map((g) => {
          const gDone = g.tasks.filter((t) => t.status === "done").length;
          return (
            <section key={g.name} className="card overflow-hidden">
              <div className="flex items-center gap-3 border-b border-border px-5 py-3.5">
                {isContractor && <Avatar name={g.name} />}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{g.name}</p>
                  <p className="text-xs text-muted">
                    {gDone} of {g.tasks.length} done
                  </p>
                </div>
                <div className="h-2 w-28 overflow-hidden rounded-full bg-surface-2 ring-1 ring-border ring-inset">
                  <div className="h-full rounded-full bg-success" style={{ width: `${(gDone / g.tasks.length) * 100}%` }} />
                </div>
              </div>
              <ol className="divide-y divide-border">
                {g.tasks.map((t) => {
                  const s = STATUS[t.status];
                  return (
                    <li key={t.id} className="flex items-center gap-3.5 px-5 py-3">
                      <s.icon className={`size-5 shrink-0 ${t.status === "done" ? "text-success" : t.status === "in_progress" ? "text-info" : "text-subtle"}`} />
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-medium ${t.status === "done" ? "text-muted line-through decoration-border-strong" : ""}`}>{t.description}</p>
                        <p className="text-xs text-subtle">
                          {isContractor ? t.stage : null}
                          {isContractor ? " · " : ""}
                          {qty(t.quantity)} {t.unit}
                          {t.started_at && ` · started ${shortDate(t.started_at)}`}
                          {t.done_at && ` · done ${shortDate(t.done_at)}`}
                        </p>
                      </div>
                      <Badge tone={s.tone}>{s.label}</Badge>
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}
      </div>

      <aside className="card overflow-hidden lg:sticky lg:top-24">
        <div className="flex items-center gap-2 border-b border-border px-5 py-4">
          <Activity className="size-4 text-muted" />
          <h2 className="text-base font-semibold tracking-tight">{isContractor ? "Latest updates" : "How it works"}</h2>
        </div>
        {isContractor ? (
          feed.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted">No updates yet. Sub-contractors mark tasks as started and done from their link.</p>
          ) : (
            <ol className="space-y-4 px-5 py-4">
              {feed.map((f, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className={`mt-1.5 size-2 shrink-0 rounded-full ${f.action === "task_done" ? "bg-success" : f.action === "task_in_progress" ? "bg-info" : "bg-brand"}`} />
                  <div>
                    <p>
                      <span className="font-semibold">{f.actor_label ?? "Client"}</span>{" "}
                      {f.action === "task_done"
                        ? "finished"
                        : f.action === "task_in_progress"
                          ? "started"
                          : f.action === "task_not_started"
                            ? "reset"
                            : "accepted the quote"}
                      {f.description ? <span className="text-muted"> {f.description}</span> : null}
                    </p>
                    <p className="text-xs text-subtle">{shortDate(f.created_at)}</p>
                  </div>
                </li>
              ))}
            </ol>
          )
        ) : (
          <p className="px-5 py-4 text-sm text-muted">
            The trades mark each part of the work as started and done. This page updates as they go.
          </p>
        )}
      </aside>
    </div>
  );
}
