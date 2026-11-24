"use client";

import { Check } from "lucide-react";
import { respondToQuote } from "@/lib/actions/jobs";
import { NextStepAction } from "./next-step";
import { SubmitButton } from "./submit-button";

/** "Accept quote · $X" in the owner's Next step box on the quote page. */
export function OwnerQuoteAction({ jobId, quoteId, label }: { jobId: string; quoteId: string; label: string }) {
  return (
    <NextStepAction path={`/jobs/${jobId}/quote`}>
      <form action={respondToQuote}>
        <input type="hidden" name="quote_id" value={quoteId} />
        <SubmitButton name="status" value="accepted" variant="success" pendingText="Accepting…">
          <Check /> {label}
        </SubmitButton>
      </form>
    </NextStepAction>
  );
}
