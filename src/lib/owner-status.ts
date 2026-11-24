import type { Job } from "@/lib/types";

type JobLike = Pick<Job, "status" | "contractor_id" | "contractor_email"> & { details?: Record<string, unknown> | null };

/**
 * The homeowner's timeline. It only shows what matters to them,
 * never the contractor's internal steps (getting trade prices, awarding).
 */
export const OWNER_STEPS = ["Project created", "Your builder reviews it", "Quote being prepared", "Review your quote", "Work starts"] as const;

/** Index of the current step in OWNER_STEPS (5 = everything done). */
export function ownerStep(job: JobLike, quoteStatus: string | null): number {
  if (job.status === "accepted" || job.status === "in_progress") return 4;
  if (job.status === "completed") return 5;
  if (quoteStatus === "sent") return 3;
  if (!job.contractor_id) return 1;
  return 2;
}

/** Plain-language status for the homeowner, plus whether it needs their attention. */
export function ownerStatus(job: JobLike, quoteStatus: string | null, co = "Northline Builders") {
  if (quoteStatus === "sent") return { text: "Your quote is ready to review", highlight: true };
  switch (job.status) {
    case "draft":
    case "bidding":
    case "awarding":
    case "quoted":
      if (!job.contractor_id) return { text: `${co} will review it soon`, highlight: false };
      if (quoteStatus === "changes_requested") return { text: `${co} is updating your quote`, highlight: false };
      if (quoteStatus === "rejected") return { text: "You turned down the last quote", highlight: false };
      return { text: `${co} is preparing your quote`, highlight: false };
    case "accepted":
      return { text: "Quote accepted · work can start", highlight: false };
    case "in_progress":
      return { text: "Work in progress", highlight: false };
    case "completed":
      return { text: "Work completed", highlight: false };
    default:
      return { text: "Closed", highlight: false };
  }
}
