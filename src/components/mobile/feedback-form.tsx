"use client";

import { useState, useTransition } from "react";
import { LoaderCircle, Star } from "lucide-react";
import { submitFeedback } from "@/lib/actions/owner";

export type FeedbackPart = { inviteId: string; label: string; tasks: string[] };

const LOW_REASONS = ["Poor quality", "Finished late", "Messy site", "Hard to reach", "Didn't follow the plan"];
const WORDS = ["", "Very poor", "Poor", "Okay", "Good", "Excellent"];

/** Homeowner rates each part of the work (by trade, never by sub-contractor name). */
export function FeedbackForm({ jobId, parts, threshold = 4, company }: { jobId: string; parts: FeedbackPart[]; threshold?: number; company: string }) {
  const [stars, setStars] = useState<Record<string, number>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [chips, setChips] = useState<Record<string, string[]>>({});
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const reasonFor = (id: string) => [(chips[id] ?? []).join(", "), (reasons[id] ?? "").trim()].filter(Boolean).join(". ");
  const rated = parts.filter((p) => stars[p.inviteId]);
  const missingReason = rated.some((p) => stars[p.inviteId] < threshold && !reasonFor(p.inviteId));

  function send() {
    setError(null);
    start(async () => {
      const res = await submitFeedback({
        jobId,
        comment,
        ratings: parts.map((p) => ({ inviteId: p.inviteId, stars: stars[p.inviteId] ?? 0, reason: reasonFor(p.inviteId) })),
      });
      if (res.error) setError(res.error);
    });
  }

  return (
    <section className="card overflow-hidden ring-2 ring-brand">
      <div className="bg-brand-soft px-4 py-4">
        <p className="text-[17px] font-bold text-brand-soft-fg">How was the work?</p>
        <p className="mt-0.5 text-[13px] text-muted">Rate each part. It helps {company} choose the best trades.</p>
      </div>

      <ul className="divide-y divide-border">
        {parts.map((p) => {
          const s = stars[p.inviteId] ?? 0;
          const low = s > 0 && s < threshold;
          return (
            <li key={p.inviteId} className="px-4 py-4">
              <p className="font-semibold">{p.label}</p>
              <p className="mt-0.5 line-clamp-2 text-xs text-muted">{p.tasks.join(" · ")}</p>
              <div className="mt-2.5 flex items-center gap-1" role="radiogroup" aria-label={`Rating for ${p.label}`}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={s === n}
                    aria-label={`${n} star${n > 1 ? "s" : ""}`}
                    onClick={() => setStars((cur) => ({ ...cur, [p.inviteId]: n }))}
                    className="p-0.5 transition active:scale-90"
                  >
                    <Star className={`size-8 ${n <= s ? "fill-warning text-warning" : "text-border-strong"}`} strokeWidth={1.6} />
                  </button>
                ))}
                {s > 0 && <span className={`ml-2 text-sm font-semibold ${low ? "text-danger" : "text-success"}`}>{WORDS[s]}</span>}
              </div>

              {low && (
                <div className="animate-step-in mt-3 space-y-2.5 rounded-2xl bg-surface-2 p-3">
                  <p className="text-sm font-semibold">What went wrong? *</p>
                  <div className="flex flex-wrap gap-1.5">
                    {LOW_REASONS.map((c) => {
                      const on = (chips[p.inviteId] ?? []).includes(c);
                      return (
                        <button
                          key={c}
                          type="button"
                          aria-pressed={on}
                          onClick={() =>
                            setChips((cur) => {
                              const list = cur[p.inviteId] ?? [];
                              return { ...cur, [p.inviteId]: on ? list.filter((x) => x !== c) : [...list, c] };
                            })
                          }
                          className={`rounded-full border px-3 py-1 text-xs font-medium ${
                            on ? "border-select bg-select-bg text-foreground" : "border-border-strong bg-surface text-muted"
                          }`}
                        >
                          {c}
                        </button>
                      );
                    })}
                  </div>
                  <textarea
                    rows={2}
                    value={reasons[p.inviteId] ?? ""}
                    onChange={(e) => setReasons((cur) => ({ ...cur, [p.inviteId]: e.target.value }))}
                    placeholder="Tell us a bit more"
                    aria-label={`Reason for ${p.label}`}
                    className="w-full rounded-xl border border-border-strong bg-surface px-3 py-2 text-[14px] outline-none focus:border-select"
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="space-y-3 border-t border-border p-4">
        <textarea
          rows={2}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Anything else? (optional)"
          aria-label="Other comments"
          className="w-full rounded-2xl border border-border-strong bg-surface px-4 py-3 text-[15px] outline-none focus:border-select"
        />
        {error && <p className="text-sm font-medium text-danger">{error}</p>}
        <button
          type="button"
          onClick={send}
          disabled={pending || rated.length === 0 || missingReason}
          className="btn-primary h-12 w-full justify-center rounded-2xl text-[15px]"
        >
          {pending ? <LoaderCircle className="animate-spin" /> : <Star />}
          {rated.length === 0 ? "Tap the stars to rate" : missingReason ? "Add a reason for low ratings" : "Send feedback"}
        </button>
      </div>
    </section>
  );
}
