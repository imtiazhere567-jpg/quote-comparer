"use client";

import { useEffect, useState } from "react";
import { ArrowDown, Send } from "lucide-react";
import { NextStepAction } from "./next-step";

const FORM_ID = "request-bids-form";

/**
 * Live button for the "Request bids" step: it submits the form on the page and
 * shows how many sub-contractors are ticked.
 */
export function RequestBidsAction({ jobId }: { jobId: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const form = document.getElementById(FORM_ID) as HTMLFormElement | null;
    if (!form) return;
    const update = () => setCount(form.querySelectorAll('input[name="sub_ids"]:checked').length);
    update();
    form.addEventListener("change", update);
    form.addEventListener("reset", () => setTimeout(update));
    return () => form.removeEventListener("change", update);
  }, []);

  return (
    <NextStepAction path={`/jobs/${jobId}/bids`}>
      {count > 0 ? (
        <button type="submit" form={FORM_ID} className="btn-primary">
          <Send /> Send bid requests to {count} sub-contractor{count === 1 ? "" : "s"}
        </button>
      ) : (
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            const form = document.getElementById(FORM_ID);
            form?.scrollIntoView({ behavior: "smooth", block: "center" });
            form?.querySelector<HTMLInputElement>('input[name="sub_ids"]')?.focus();
          }}
        >
          <ArrowDown /> Tick sub-contractors below
        </button>
      )}
    </NextStepAction>
  );
}

export const REQUEST_BIDS_FORM_ID = FORM_ID;
