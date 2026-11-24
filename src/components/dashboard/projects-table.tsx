"use client";

import { useMemo, useState } from "react";
import { ChevronRight, ClipboardList, Search } from "lucide-react";
import { money, shortDate } from "@/lib/format";
import { JOB_STATUS_LABEL, type JobStatus } from "@/lib/types";
import { Avatar, MiniProgress, StatusPill } from "@/components/ui";
import { Pagination, usePaged } from "@/components/pagination";
import type { BidRow, ProjectRow } from "./types";
import { ProjectPreview } from "./project-preview";

const PAGE = 8;

const TABS: { id: string; label: string; match: (s: JobStatus) => boolean }[] = [
  { id: "all", label: "All", match: () => true },
  { id: "draft", label: "Draft", match: (s) => s === "draft" },
  { id: "bidding", label: "Collecting bids", match: (s) => s === "bidding" },
  { id: "awarding", label: "Comparing", match: (s) => s === "awarding" },
  { id: "quoted", label: "Quote sent", match: (s) => s === "quoted" },
  { id: "accepted", label: "Accepted", match: (s) => s === "accepted" || s === "in_progress" || s === "completed" },
];

export function ProjectsTable({ projects, bids, role }: { projects: ProjectRow[]; bids: BidRow[]; role: "owner" | "contractor" }) {
  const [tab, setTab] = useState("all");
  const [preview, setPreview] = useState<ProjectRow | null>(null);
  const [term, setTerm] = useState("");
  const filtered = useMemo(() => {
    const t = TABS.find((x) => x.id === tab)!;
    const q = term.trim().toLowerCase();
    return projects.filter((p) => t.match(p.status) && (!q || `${p.title} ${p.client ?? ""} ${p.address ?? ""}`.toLowerCase().includes(q)));
  }, [projects, tab, term]);
  const paged = usePaged(filtered, PAGE);

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="text-base font-semibold tracking-tight">All projects</h2>
          <p className="text-[13px] text-muted">{projects.length} projects</p>
        </div>
        <label className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
          <input
            value={term}
            onChange={(e) => {
              setTerm(e.target.value);
              paged.setPage(1);
            }}
            placeholder="Search projects or clients…"
            className="input h-9 pl-9"
            aria-label="Search projects"
          />
        </label>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-border px-4 py-2" role="tablist">
        {TABS.map((t) => {
          const count = projects.filter((p) => t.match(p.status)).length;
          const on = tab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={on}
              onClick={() => {
                setTab(t.id);
                paged.setPage(1);
              }}
              className={`flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold transition ${
                on ? "bg-hero text-hero-num" : "text-muted hover:bg-surface-2 hover:text-foreground"
              }`}
            >
              {t.label}
              <span className={`num rounded-full px-1.5 text-[11px] ${on ? "bg-white/15" : "bg-surface-2 ring-1 ring-border"}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {paged.rows.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-14 text-center">
          <ClipboardList className="size-7 text-subtle" />
          <p className="mt-3 font-semibold">No projects here</p>
          <p className="mt-1 text-sm text-muted">{term ? `Nothing matches “${term}”.` : "Try another tab."}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="border-b border-border bg-surface-2 px-5 py-2.5 font-medium">Project</th>
                <th className="border-b border-border bg-surface-2 px-3 py-2.5 font-medium">{role === "contractor" ? "Client" : "Builder"}</th>
                <th className="border-b border-border bg-surface-2 px-3 py-2.5 font-medium">Progress</th>
                {role === "contractor" && <th className="border-b border-border bg-surface-2 px-3 py-2.5 text-right font-medium">Bids</th>}
                <th className="border-b border-border bg-surface-2 px-3 py-2.5 text-right font-medium">Quote</th>
                <th className="border-b border-border bg-surface-2 px-3 py-2.5 font-medium">Updated</th>
                <th className="w-10 border-b border-border bg-surface-2" />
              </tr>
            </thead>
            <tbody>
              {paged.rows.map((p) => (
                <tr
                  key={p.id}
                  className="group cursor-pointer"
                  onClick={() => setPreview(p)}
                >
                  <td className="border-b border-border px-5 py-3 group-hover:bg-surface-2/70">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreview(p);
                      }}
                      className="text-left font-semibold hover:underline"
                    >
                      {p.title}
                    </button>
                    <p className="truncate text-xs text-subtle">{p.address ?? "No address"}</p>
                  </td>
                  <td className="border-b border-border px-3 py-3 group-hover:bg-surface-2/70">
                    {p.client ? (
                      <span className="flex items-center gap-2">
                        <Avatar name={p.client} size="sm" />
                        <span className="truncate">{p.client}</span>
                      </span>
                    ) : (
                      <span className="text-subtle">—</span>
                    )}
                  </td>
                  <td className="border-b border-border px-3 py-3 group-hover:bg-surface-2/70">
                    <div className="flex flex-col items-start gap-1.5">
                      <MiniProgress status={p.status} />
                      <StatusPill status={p.status}>{JOB_STATUS_LABEL[p.status]}</StatusPill>
                    </div>
                  </td>
                  {role === "contractor" && (
                    <td className="num border-b border-border px-3 py-3 text-right group-hover:bg-surface-2/70">
                      {p.bidsOut ? (
                        <>
                          <span className="font-semibold">{p.bidsIn}</span>
                          <span className="text-subtle">/{p.bidsOut}</span>
                        </>
                      ) : (
                        <span className="text-subtle">—</span>
                      )}
                    </td>
                  )}
                  <td className="num border-b border-border px-3 py-3 text-right font-semibold group-hover:bg-surface-2/70">
                    {p.quoteTotal != null && p.quoteStatus !== "draft" ? money(p.quoteTotal, p.currency) : <span className="font-normal text-subtle">—</span>}
                  </td>
                  <td className="border-b border-border px-3 py-3 text-[13px] whitespace-nowrap text-muted group-hover:bg-surface-2/70">{shortDate(p.updatedAt)}</td>
                  <td className="border-b border-border pr-4 group-hover:bg-surface-2/70">
                    <span className="flex size-8 items-center justify-center rounded-lg text-subtle group-hover:bg-surface group-hover:text-foreground" aria-hidden>
                      <ChevronRight className="size-4" />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {preview && (
        <ProjectPreview project={preview} bids={bids.filter((b) => b.jobId === preview.id)} role={role} onClose={() => setPreview(null)} />
      )}

      <div className="border-t border-border bg-surface-2 px-5 py-3">
        <Pagination page={paged.page} pageCount={paged.pageCount} total={paged.total} pageSize={PAGE} onChange={paged.setPage} noun="projects" />
      </div>
    </section>
  );
}
