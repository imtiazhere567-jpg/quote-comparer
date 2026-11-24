import { OWNER_STEPS } from "@/lib/owner-status";

/** Five small bars showing the homeowner's progress (done = green, now = brand). */
export function OwnerMiniProgress({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-1" aria-label={`Step ${Math.min(step + 1, 5)} of 5: ${OWNER_STEPS[Math.min(step, 4)]}`}>
      {OWNER_STEPS.map((s, i) => (
        <span key={s} className={`h-1.5 w-7 rounded-full ${i < step ? "bg-success" : i === step ? "bg-brand" : "bg-border-strong"}`} />
      ))}
    </div>
  );
}
